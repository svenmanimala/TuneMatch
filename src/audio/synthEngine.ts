import { Track } from '../types/music';

/**
 * Lightweight Web Audio API procedural synthesizer tuned to a Track's 7D Audio DNA.
 * Generates warm pad chords, rhythmic bass, melodic arpeggios, and subtle percussive pulse
 * so every track preview sounds distinct and reflects its BPM, energy, valence, and acousticness.
 */
class ProceduralSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private schedulerId: number | null = null;
  private stepIndex = 0;
  private currentTrack: Track | null = null;
  private volume = 0.65;
  private playing = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume * 0.38;

      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 1800;
      this.filterNode.Q.value = 1.2;

      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolume(nextVol: number): void {
    this.volume = Math.max(0, Math.min(1, nextVol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.38, this.ctx.currentTime, 0.04);
    }
  }

  public start(track: Track): void {
    this.stopScheduler();
    const ctx = this.ensureContext();
    if (!ctx || !this.filterNode) return;

    this.currentTrack = track;
    this.playing = true;
    this.stepIndex = 0;

    // Shape filter brightness from energy & acousticness
    const cutoff =
      900 + track.features.energy * 2400 - track.features.acousticness * 550;
    this.filterNode.frequency.setTargetAtTime(
      Math.max(650, cutoff),
      ctx.currentTime,
      0.08
    );

    const eighthNoteMs = Math.max(140, Math.min(420, (60 / track.features.bpm / 2) * 1000));

    // Fire immediately, then schedule at BPM-locked interval
    this.triggerStep();
    this.schedulerId = window.setInterval(() => {
      if (this.playing) {
        this.triggerStep();
      }
    }, eighthNoteMs);
  }

  public pause(): void {
    this.playing = false;
    this.stopScheduler();
  }

  public stop(): void {
    this.playing = false;
    this.currentTrack = null;
    this.stopScheduler();
  }

  private stopScheduler(): void {
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private triggerStep(): void {
    if (!this.ctx || !this.filterNode || !this.currentTrack) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const track = this.currentTrack;
    const { valence, energy, acousticness, danceability, instrumentalness } = track.features;

    // Deterministic root note from track id so different tracks sit in distinct keys
    let idHash = 0;
    for (let i = 0; i < track.id.length; i++) {
      idHash = (idHash * 31 + track.id.charCodeAt(i)) % 12;
    }
    const baseMidi = 48 + (idHash % 7); // C3 - F#3 range

    // Major/Lydian scale for high valence, Dorian/Minor for moody tracks
    const scale =
      valence >= 0.52
        ? [0, 2, 4, 7, 9, 12, 14, 16]
        : [0, 3, 5, 7, 10, 12, 15, 17];

    const barStep = this.stepIndex % 16;
    const chordProgression = valence >= 0.52 ? [0, 5, 3, 4] : [0, 3, 5, 4];
    const chordIdx = chordProgression[Math.floor(barStep / 4) % chordProgression.length];
    const chordRootMidi = baseMidi + scale[chordIdx % scale.length];

    // 1. Warm Bass / Pad on downbeats
    if (barStep % 4 === 0) {
      this.playTone(
        this.midiToFreq(chordRootMidi - 12),
        now,
        0.55,
        acousticness > 0.35 ? 'triangle' : 'sawtooth',
        0.22 + energy * 0.14
      );
    }

    // 2. Chord stab / pad shimmer
    if (barStep % 8 === 0) {
      const third = chordRootMidi + (valence >= 0.52 ? 4 : 3);
      const fifth = chordRootMidi + 7;
      this.playTone(this.midiToFreq(third), now, 0.9, 'sine', 0.12);
      this.playTone(this.midiToFreq(fifth), now, 0.9, 'triangle', 0.10);
    }

    // 3. Melodic Arpeggio Lead
    const arpPattern = [0, 2, 4, 3, 5, 4, 2, 1];
    const arpDegree = arpPattern[this.stepIndex % arpPattern.length];
    const shouldPlayArp =
      instrumentalness > 0.25 || barStep % 2 === 0 || energy > 0.68;

    if (shouldPlayArp) {
      const leadMidi =
        baseMidi + 12 + scale[(chordIdx + arpDegree) % scale.length];
      const leadWave: OscillatorType =
        acousticness > 0.4 ? 'sine' : energy > 0.72 ? 'triangle' : 'sine';
      this.playTone(
        this.midiToFreq(leadMidi),
        now,
        0.26,
        leadWave,
        0.13 + instrumentalness * 0.08
      );
    }

    // 4. Soft Pulse Kick & Groove Shaker on high-danceability tracks
    if (danceability >= 0.45 && barStep % 4 === 0) {
      this.playSubKick(now, 0.28 + energy * 0.2);
    }
    if (danceability >= 0.58 && barStep % 2 === 1) {
      this.playSoftHat(now, 0.045 + energy * 0.03);
    }

    this.stepIndex += 1;
  }

  private playTone(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    peakGain: number
  ): void {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
  }

  private playSubKick(startTime: number, peakGain: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.14);

    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.2);
  }

  private playSoftHat(startTime: number, peakGain: number): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain);

    noise.start(startTime);
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}

export const synthEngine = new ProceduralSynthEngine();
