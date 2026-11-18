import type { AudioDspTelemetry, AudioFeatures7D, Track } from '../types/music';

export const TIMBRE_BAND_LABELS = [
  '40–80Hz',
  '80–140Hz',
  '140–230Hz',
  '230–380Hz',
  '380–600Hz',
  '600–950Hz',
  '950–1.5k',
  '1.5–2.4k',
  '2.4–3.8k',
  '3.8–6.2k',
  '6.2–10k',
  '10–16k',
] as const;

const LOG_BAND_EDGES_HZ = [
  40, 80, 140, 230, 380, 600, 950, 1500, 2400, 3800, 6200, 10000, 16000,
];

interface DspAnalysisResult {
  features: AudioFeatures7D;
  dsp: AudioDspTelemetry;
}

const dspResultCache = new Map<string, DspAnalysisResult>();
const inFlightRequests = new Map<string, Promise<DspAnalysisResult | null>>();

let decodeCtx: AudioContext | null = null;

function getDecodeAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!decodeCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    decodeCtx = new AudioCtx();
  }
  return decodeCtx;
}

function getProxiedAudioUrl(previewUrl: string): string {
  const normalized = previewUrl.startsWith('http://audio-ssl.itunes.apple.com/')
    ? previewUrl.replace('http://', 'https://')
    : previewUrl;
  if (normalized.startsWith('https://audio-ssl.itunes.apple.com/')) {
    return `/api/music/audio?url=${encodeURIComponent(normalized)}`;
  }
  return normalized;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Iterative in-place Radix-2 Cooley-Tukey FFT.
 * Requires `re.length === im.length` and power-of-two length.
 */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const evenIdx = start + k;
        const oddIdx = evenIdx + halfLen;
        const oddRe = re[oddIdx] * wRe - im[oddIdx] * wIm;
        const oddIm = re[oddIdx] * wIm + im[oddIdx] * wRe;

        re[oddIdx] = re[evenIdx] - oddRe;
        im[oddIdx] = im[evenIdx] - oddIm;
        re[evenIdx] += oddRe;
        im[evenIdx] += oddIm;

        const nextWRe = wRe * wStepRe - wIm * wStepIm;
        wIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextWRe;
      }
    }
  }
}

export function extractDspFromAudioBuffer(buffer: AudioBuffer): DspAnalysisResult | null {
  const sampleRate = buffer.sampleRate;
  const totalSamples = buffer.length;
  if (totalSamples < sampleRate * 1.5) return null;

  const ch0 = buffer.getChannelData(0);
  const hasStereo = buffer.numberOfChannels > 1;
  const ch1 = hasStereo ? buffer.getChannelData(1) : ch0;

  // Analyze up to 22 seconds from the core of the clip (skipping tiny 0.5s fade-in if long enough)
  const startSample = totalSamples > sampleRate * 8 ? Math.floor(sampleRate * 0.5) : 0;
  const maxAnalyzeSamples = Math.min(totalSamples - startSample, Math.floor(sampleRate * 22));

  const fftSize = 512;
  const hopSize = 512;
  const halfBins = fftSize >> 1;
  const binHz = sampleRate / fftSize;

  // Precompute Hann window
  const hann = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  // Precompute bin -> 12-band index lookup
  const binBand = new Int8Array(halfBins);
  for (let b = 0; b < halfBins; b++) {
    const freq = b * binHz;
    let bandIdx = -1;
    for (let band = 0; band < 12; band++) {
      if (freq >= LOG_BAND_EDGES_HZ[band] && freq < LOG_BAND_EDGES_HZ[band + 1]) {
        bandIdx = band;
        break;
      }
    }
    binBand[b] = bandIdx;
  }

  const numFrames = Math.floor((maxAnalyzeSamples - fftSize) / hopSize);
  if (numFrames < 24) return null;

  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  const prevMag = new Float32Array(halfBins);

  const frameRmsDb: number[] = [];
  const onsetFlux = new Float32Array(numFrames);
  const vocalEnv = new Float32Array(numFrames);
  const consonantEnv = new Float32Array(numFrames);
  const zcrPerFrame = new Float32Array(numFrames);

  const timbreSums = new Float64Array(12);
  let totalWeight = 0;
  let centroidSum = 0;
  let flatnessSum = 0;
  let activeFrames = 0;
  let midEnergySum = 0;
  let sideEnergySum = 0;
  let highFreqSum = 0;
  let subSynthSum = 0;
  let totalSpecSum = 0;
  let peakSample = 0;

  for (let f = 0; f < numFrames; f++) {
    const offset = startSample + f * hopSize;
    let frameSq = 0;
    let zcr = 0;
    let prevSign = 0;
    let midSq = 0;
    let sideSq = 0;

    for (let i = 0; i < fftSize; i++) {
      const l = ch0[offset + i];
      const r = ch1[offset + i];
      const mono = 0.5 * (l + r);
      const absM = Math.abs(mono);
      if (absM > peakSample) peakSample = absM;

      frameSq += mono * mono;
      midSq += mono * mono;
      if (hasStereo) {
        const side = 0.5 * (l - r);
        sideSq += side * side;
      }

      const sign = mono >= 0 ? 1 : -1;
      if (i > 0 && sign !== prevSign && absM > 0.008) {
        zcr++;
      }
      prevSign = sign;

      re[i] = mono * hann[i];
      im[i] = 0;
    }

    const rms = Math.sqrt(frameSq / fftSize);
    const db = rms > 1e-6 ? 20 * Math.log10(rms) : -90;
    zcrPerFrame[f] = zcr / fftSize;

    fftInPlace(re, im);

    let frameFlux = 0;
    let frameVocal = 0;
    let frameConsonant = 0;
    let frameSpecSum = 0;
    let frameWeightedFreq = 0;
    let logMagSum = 0;
    let arithMagSum = 0;
    let specCount = 0;

    for (let b = 1; b < halfBins; b++) {
      const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
      const freq = b * binHz;

      // Spectral flux emphasized on kick/bass (40-260Hz) and snare/percussion (1.8k-8kHz)
      const diff = mag - prevMag[b];
      if (diff > 0) {
        const percWeight =
          freq >= 40 && freq <= 260 ? 1.5 : freq >= 1800 && freq <= 8000 ? 1.2 : 0.7;
        frameFlux += diff * percWeight;
      }
      prevMag[b] = mag;

      if (freq >= 300 && freq <= 3200) {
        frameVocal += mag;
      }
      if (freq >= 1200 && freq <= 4500) {
        frameConsonant += mag;
      }

      if (rms > 0.004) {
        const band = binBand[b];
        if (band >= 0) {
          timbreSums[band] += mag;
        }
        frameSpecSum += mag;
        frameWeightedFreq += freq * mag;
        if (freq > 6000) highFreqSum += mag;
        if (freq >= 25 && freq <= 75) subSynthSum += mag;
        totalSpecSum += mag;

        if (freq >= 80 && freq <= 12000) {
          logMagSum += Math.log(mag + 1e-6);
          arithMagSum += mag + 1e-6;
          specCount++;
        }
      }
    }

    onsetFlux[f] = frameFlux;
    vocalEnv[f] = frameVocal;
    consonantEnv[f] = frameConsonant;

    if (rms > 0.004) {
      activeFrames++;
      frameRmsDb.push(db);
      midEnergySum += midSq;
      sideEnergySum += sideSq;

      if (frameSpecSum > 1e-6) {
        centroidSum += frameWeightedFreq / frameSpecSum;
        totalWeight += 1;
      }
      if (specCount > 0 && arithMagSum > 0) {
        const geomMean = Math.exp(logMagSum / specCount);
        const arithMean = arithMagSum / specCount;
        flatnessSum += geomMean / arithMean;
      }
    }
  }

  if (activeFrames < 15 || totalWeight === 0) return null;

  // 1. Dynamic range & mean loudness
  frameRmsDb.sort((a, b) => a - b);
  const p20 = frameRmsDb[Math.floor(frameRmsDb.length * 0.2)] ?? -26;
  const p95 = frameRmsDb[Math.floor(frameRmsDb.length * 0.95)] ?? -8;
  const dynamicRangeDb = Number(clamp(p95 - p20, 1.5, 32).toFixed(1));
  const meanDb = frameRmsDb.reduce((acc, v) => acc + v, 0) / frameRmsDb.length;

  // 2. Normalize 12-band timbre vector (L2 unit vector)
  const timbreRaw = Array.from(timbreSums);
  const timbreNorm = Math.sqrt(timbreRaw.reduce((acc, v) => acc + v * v, 0)) || 1;
  const timbreBands = timbreRaw.map((v) => Number((v / timbreNorm).toFixed(4)));

  // 3. Spectral descriptors
  const spectralCentroidHz = Math.round(centroidSum / totalWeight);
  const meanFlatness = flatnessSum / Math.max(1, totalWeight);
  const highFreqRatio = totalSpecSum > 0 ? highFreqSum / totalSpecSum : 0.15;
  const subSynthRatio = totalSpecSum > 0 ? subSynthSum / totalSpecSum : 0.08;
  const stereoWidth = midEnergySum > 0 ? Math.sqrt(sideEnergySum / midEnergySum) : 0.35;

  // 4. Real BPM & groove periodicity via adaptive onset autocorrelation
  const fps = sampleRate / hopSize;
  const adaptiveFlux = new Float32Array(numFrames);
  const winHalf = Math.max(4, Math.round(fps * 0.2));
  for (let i = 0; i < numFrames; i++) {
    let localSum = 0;
    let count = 0;
    const s = Math.max(0, i - winHalf);
    const e = Math.min(numFrames - 1, i + winHalf);
    for (let k = s; k <= e; k++) {
      localSum += onsetFlux[k];
      count++;
    }
    const avg = count > 0 ? localSum / count : 0;
    adaptiveFlux[i] = Math.max(0, onsetFlux[i] - avg * 1.05);
  }

  const minBpm = 64;
  const maxBpm = 186;
  const minLag = Math.max(4, Math.floor((60 * fps) / maxBpm));
  const maxLag = Math.min(Math.floor(numFrames / 3), Math.ceil((60 * fps) / minBpm));

  let fluxZeroLag = 0;
  for (let i = 0; i < numFrames; i++) {
    fluxZeroLag += adaptiveFlux[i] * adaptiveFlux[i];
  }

  let bestLag = Math.round((60 * fps) / 116);
  let bestWeightedCorr = -1;
  let bestRawCorr = 0;
  let corrMeanSum = 0;
  let corrCount = 0;

  if (fluxZeroLag > 1e-8) {
    for (let lag = minLag; lag <= maxLag; lag++) {
      let ac = 0;
      const limit = numFrames - lag;
      for (let i = 0; i < limit; i++) {
        ac += adaptiveFlux[i] * adaptiveFlux[i + lag];
      }
      const normCorr = ac / fluxZeroLag;
      corrMeanSum += normCorr;
      corrCount++;

      // Sub-beat harmonic reinforcement (half-lag & double-lag) helps lock true rhythmic meter
      const halfLag = Math.round(lag / 2);
      let harmBoost = 0;
      if (halfLag >= 3) {
        let hac = 0;
        for (let i = 0; i < numFrames - halfLag; i++) {
          hac += adaptiveFlux[i] * adaptiveFlux[i + halfLag];
        }
        harmBoost = 0.28 * (hac / fluxZeroLag);
      }

      const candidateBpm = (60 * fps) / lag;
      // Gentle human tempo preference curve around 114 BPM to avoid 2x/0.5x octave flips
      const octavePrior = Math.exp(-Math.pow(Math.log2(candidateBpm / 114), 2) / 0.72);
      const weighted = (normCorr + harmBoost) * (0.72 + 0.28 * octavePrior);

      if (weighted > bestWeightedCorr) {
        bestWeightedCorr = weighted;
        bestRawCorr = normCorr;
        bestLag = lag;
      }
    }
  }

  const bpm = Math.round(clamp((60 * fps) / bestLag, 64, 188));
  const meanCorr = corrCount > 0 ? corrMeanSum / corrCount : 0.05;
  const beatProminence = meanCorr > 0 ? bestRawCorr / meanCorr : 1;

  // 5. Vocal band modulation & syllabic cadence for instrumentalness + speechiness
  let vocalMean = 0;
  let specMean = 0;
  for (let i = 0; i < numFrames; i++) {
    vocalMean += vocalEnv[i];
    specMean += Math.max(1e-6, onsetFlux[i]);
  }
  vocalMean /= numFrames;

  let vocalModSq = 0;
  let vocalDiffSum = 0;
  let zcrMean = 0;
  for (let i = 0; i < numFrames; i++) {
    zcrMean += zcrPerFrame[i];
    const d = vocalEnv[i] - vocalMean;
    vocalModSq += d * d;
    if (i > 0) {
      vocalDiffSum += Math.abs(consonantEnv[i] - consonantEnv[i - 1]);
    }
  }
  zcrMean /= numFrames;

  let zcrVar = 0;
  for (let i = 0; i < numFrames; i++) {
    const dz = zcrPerFrame[i] - zcrMean;
    zcrVar += dz * dz;
  }
  const zcrStd = Math.sqrt(zcrVar / numFrames);
  const vocalCv = vocalMean > 1e-6 ? Math.sqrt(vocalModSq / numFrames) / vocalMean : 0.2;
  const syllabicRate =
    vocalMean > 1e-6 ? vocalDiffSum / (numFrames * vocalMean) : 0.15;

  // 6. Map DSP metrics into calibrated 7D audio vector
  const crestFactor = meanDb < -4 ? clamp((20 * Math.log10(Math.max(peakSample, 1e-4)) - meanDb) / 20, 0, 1) : 0.4;

  // Energy: loudness (-26dB .. -6dB) + dynamic compression + bright HF content
  const loudnessNorm = clamp((meanDb + 26) / 19, 0, 1);
  const energy = Number(
    clamp(loudnessNorm * 0.68 + highFreqRatio * 1.15 + (1 - crestFactor) * 0.14, 0.06, 0.98).toFixed(2)
  );

  // Danceability: periodic beat strength + low-end groove energy + mid-tempo sweet spot
  const grooveTempoFactor = Math.exp(-Math.pow((bpm - 116) / 38, 2));
  const lowGrooveEnergy = clamp((timbreBands[0] + timbreBands[1] + timbreBands[2]) * 0.85, 0, 1);
  const periodicityScore = clamp((beatProminence - 1.1) / 2.2, 0, 1);
  const danceability = Number(
    clamp(
      periodicityScore * 0.52 + lowGrooveEnergy * 0.26 + grooveTempoFactor * 0.22,
      0.12,
      0.96
    ).toFixed(2)
  );

  // Valence: spectral brightness (centroid) + energetic lift + major-like upper-mid clarity vs muddy sub-heavy darkness
  const brightnessNorm = clamp((spectralCentroidHz - 1000) / 3000, 0, 1);
  const tempoLift = clamp((bpm - 72) / 90, 0, 1);
  const valence = Number(
    clamp(
      brightnessNorm * 0.45 + tempoLift * 0.26 + energy * 0.22 + (1 - subSynthRatio * 2.2) * 0.08,
      0.08,
      0.95
    ).toFixed(2)
  );

  // Acousticness: natural dynamic range + low sustained sub-bass synth + smooth HF rolloff + lower flatness
  const acousticDr = clamp((dynamicRangeDb - 4) / 14, 0, 1);
  const smoothHf = clamp(1 - highFreqRatio * 2.3, 0, 1);
  const lowSubSynth = clamp(1 - subSynthRatio * 4.8, 0, 1);
  const acousticness = Number(
    clamp(
      acousticDr * 0.36 + smoothHf * 0.28 + lowSubSynth * 0.24 + (1 - clamp(meanFlatness * 2.2, 0, 1)) * 0.12,
      0.02,
      0.95
    ).toFixed(2)
  );

  // Instrumentalness: tracks with low vocal-band dominance, wide stereo spacing, and flat vocal modulation
  const midVocalShare = clamp(
    timbreBands[4] + timbreBands[5] + timbreBands[6] + timbreBands[7],
    0,
    1.8
  );
  const vocalFocus = clamp((midVocalShare - 0.55) / 0.85, 0, 1);
  const modPresence = clamp((vocalCv - 0.18) / 0.55, 0, 1);
  const wideFactor = clamp((stereoWidth - 0.28) / 0.5, 0, 1);
  const instrumentalness = Number(
    clamp((1 - vocalFocus * 0.6 - modPresence * 0.3) * 0.72 + wideFactor * 0.22 - (specMean > 0 ? 0 : 0), 0.01, 0.94).toFixed(2)
  );

  // Speechiness: rapid syllabic consonant transients + high ZCR variance
  const zcrBurst = clamp((zcrStd - 0.015) / 0.075, 0, 1);
  const syllabicBurst = clamp((syllabicRate - 0.18) / 0.55, 0, 1);
  const speechiness = Number(
    clamp(zcrBurst * 0.52 + syllabicBurst * 0.38 + (1 - instrumentalness) * 0.05, 0.02, 0.62).toFixed(2)
  );

  return {
    features: {
      bpm,
      energy,
      danceability,
      valence,
      acousticness,
      instrumentalness,
      speechiness,
    },
    dsp: {
      spectralCentroidHz,
      dynamicRangeDb,
      timbreBands,
    },
  };
}

export async function analyzeTrackAudio(
  track: Track,
  signal?: AbortSignal
): Promise<Track> {
  if (!track.previewUrl) return track;

  const cacheKey = track.previewUrl;
  const cached = dspResultCache.get(cacheKey);
  if (cached) {
    return {
      ...track,
      features: cached.features,
      dsp: cached.dsp,
      analysisSource: 'audio-dsp',
    };
  }

  let pending = inFlightRequests.get(cacheKey);
  if (!pending) {
    pending = (async (): Promise<DspAnalysisResult | null> => {
      try {
        const ctx = getDecodeAudioContext();
        if (!ctx) return null;

        const res = await fetch(getProxiedAudioUrl(track.previewUrl!), { signal });
        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        if (signal?.aborted) return null;

        const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
        if (signal?.aborted) return null;

        const extracted = extractDspFromAudioBuffer(audioBuf);
        if (extracted) {
          if (dspResultCache.size > 400) {
            const firstKey = dspResultCache.keys().next().value;
            if (firstKey) dspResultCache.delete(firstKey);
          }
          dspResultCache.set(cacheKey, extracted);
        }
        return extracted;
      } catch {
        return null;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, pending);
  }

  const result = await pending;
  if (!result) return track;

  return {
    ...track,
    features: result.features,
    dsp: result.dsp,
    analysisSource: 'audio-dsp',
  };
}

export async function analyzePoolAudio(
  tracks: Track[],
  onBatchProgress: (updatedTracks: Track[], completedCount: number, totalCount: number) => void,
  signal?: AbortSignal,
  concurrency = 6
): Promise<Track[]> {
  const total = tracks.length;
  if (total === 0) return [];

  const results = [...tracks];
  let cursor = 0;
  let completed = 0;
  let lastEmitCount = 0;

  const worker = async () => {
    while (true) {
      if (signal?.aborted) return;
      const idx = cursor++;
      if (idx >= total) return;

      const updated = await analyzeTrackAudio(tracks[idx], signal);
      if (signal?.aborted) return;

      results[idx] = updated;
      completed++;

      const shouldEmit =
        completed === total ||
        completed === 1 ||
        completed - lastEmitCount >= 5;
      if (shouldEmit) {
        lastEmitCount = completed;
        onBatchProgress([...results], completed, total);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
  return results;
}
