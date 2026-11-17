import type { AudioFeatures7D, RecommendedTrack, Track } from '../types/music.ts';

export const CLUSTER_META: Record<
  number,
  { label: string; fallbackCover: string; accentHex: string }
> = {
  1: {
    label: 'Velvet Nocturne R&B',
    fallbackCover: '/src/assets/images/album_velvet_rnb_1794915756582.jpg',
    accentHex: '#1DB954',
  },
  2: {
    label: 'High-Energy Synth',
    fallbackCover: '/src/assets/images/album_synth_night_1794915755115.jpg',
    accentHex: '#1ED760',
  },
  3: {
    label: 'Kinetic Nu-Disco & Pop',
    fallbackCover: '/src/assets/images/album_groove_pop_1794915757412.jpg',
    accentHex: '#1DB954',
  },
  4: {
    label: 'Deep Cosmic Electronic',
    fallbackCover: '/src/assets/images/album_cosmic_electronic_1794915755233.jpg',
    accentHex: '#10B981',
  },
  5: {
    label: 'Atmospheric Indie & Alt',
    fallbackCover: '/src/assets/images/album_indie_acoustic_1794915756277.jpg',
    accentHex: '#34D399',
  },
};

export function normalizeFeatureVector(f: AudioFeatures7D): number[] {
  const normTempo = Math.min(1, Math.max(0, (f.bpm - 60) / 130));
  return [
    normTempo,
    f.energy,
    f.danceability,
    f.valence,
    f.acousticness,
    f.instrumentalness,
    f.speechiness,
  ];
}

export function computeCosineSimilarity(a: AudioFeatures7D, b: AudioFeatures7D): number {
  const va = normalizeFeatureVector(a);
  const vb = normalizeFeatureVector(b);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i];
    magA += va[i] * va[i];
    magB += vb[i] * vb[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function findDominantTraitMatch(a: AudioFeatures7D, b: AudioFeatures7D): string {
  const va = normalizeFeatureVector(a);
  const vb = normalizeFeatureVector(b);
  const labels = [
    'Tempo Lock',
    'Energy Profile',
    'Groove Cadence',
    'Mood Valence',
    'Timbre Texture',
    'Instrumental Balance',
    'Vocal Presence',
  ];
  let bestIdx = 0;
  let smallestDiff = Infinity;
  for (let i = 0; i < va.length; i++) {
    const diff = Math.abs(va[i] - vb[i]);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      bestIdx = i;
    }
  }
  return labels[bestIdx];
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRand(seed: number, step: number): number {
  const x = Math.sin(seed + step * 97.13) * 10000;
  return x - Math.floor(x);
}

/**
 * Detect primary track language from script, genre, and linguistic markers.
 */
export function detectTrackLanguage(
  title: string,
  artist: string,
  genre = '',
  album = ''
): string {
  const combined = `${title} ${artist} ${album}`.trim();
  const lower = combined.toLowerCase();
  const g = genre.toLowerCase();

  // 1. Non-Latin script detection
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(combined)) return 'Japanese';
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(combined)) return 'Korean';
  if (/[\u4E00-\u9FFF]/.test(combined)) return 'Chinese';
  if (/[\u0900-\u097F]/.test(combined)) return 'Hindi';
  if (/[\u0600-\u06FF]/.test(combined)) return 'Arabic';
  if (/[\u0400-\u04FF]/.test(combined)) return 'Russian';
  if (/[\u0E00-\u0E7F]/.test(combined)) return 'Thai';

  // 2. Genre cues
  if (g.includes('j-pop') || g.includes('enka') || g.includes('anime')) return 'Japanese';
  if (g.includes('k-pop')) return 'Korean';
  if (g.includes('mandopop') || g.includes('cantopop')) return 'Chinese';
  if (
    g.includes('bollywood') ||
    g.includes('hindi') ||
    g.includes('indian') ||
    g.includes('punjabi') ||
    g.includes('filmi')
  ) {
    return 'Hindi';
  }
  if (
    g.includes('latin') ||
    g.includes('reggaeton') ||
    g.includes('urbano') ||
    g.includes('mexicana') ||
    g.includes('salsa') ||
    g.includes('bachata') ||
    g.includes('español')
  ) {
    return 'Spanish';
  }
  if (g.includes('mpb') || g.includes('sertanejo') || g.includes('bossa nova') || g.includes('brazilian')) {
    return 'Portuguese';
  }
  if (g.includes('french') || g.includes('chanson')) return 'French';
  if (g.includes('german') || g.includes('schlager')) return 'German';
  if (g.includes('italian')) return 'Italian';
  if (g.includes('arabic')) return 'Arabic';

  // 3. Romanized / diacritic cues
  if (/[ñ¿¡]/.test(lower) || /\b(corazón|amor|noche|canción|contigo|conmigo|siempre|quiero|pero|para|como|estoy|eres|beso|fuego|cielo|vida|sola|solo|tú|mí|tití|preguntó)\b/i.test(lower)) {
    return 'Spanish';
  }
  if (/[ãõ]/.test(lower) || /\b(você|não|saudade|coração|meu|minha|beijo|paixão|brasil)\b/i.test(lower)) {
    return 'Portuguese';
  }
  if (/[œ]/.test(lower) || /\b(amour|nuit|coeur|cœur|toujours|jamais|bonjour|merci|avec|pour|dans|mon|ton|je t'aime|stromae|angèle)\b/i.test(lower)) {
    return 'French';
  }
  if (/[ßäöü]/.test(lower) || /\b(liebe|nacht|herz|ich|dich|nicht|und|oder|welt|stern)\b/i.test(lower)) {
    return 'German';
  }
  if (/\b(amore|notte|cuore|sempre|perché|bellissima|ciao|sono|ti amo|måneskin)\b/i.test(lower)) {
    return 'Italian';
  }
  if (/\b(tum|tere|mere|tera|mera|dil|pyaar|pyar|ishq|jaan|mohabbat|zindagi|raat|arijit|pritam|shreya|atif|bollywood)\b/i.test(lower)) {
    return 'Hindi';
  }
  if (/\b(bts|blackpink|newjeans|stray kids|seventeen|aespa|twice|jung kook|jimin|taeyeon)\b/i.test(lower)) {
    return 'Korean';
  }
  if (/\b(yoasobi|kenshi yonezu|fujii kaze|radwimps|hikaru utada|one ok rock|vaundy)\b/i.test(lower)) {
    return 'Japanese';
  }

  return 'English';
}

/**
 * Derive realistic, genre-calibrated 7D Audio DNA features and K-Means cluster assignment
 * from a track's metadata (genre, title, artist).
 */
export function derive7DFeaturesFromMetadata(
  title: string,
  artist: string,
  genre: string
): { features: AudioFeatures7D; clusterId: number; clusterLabel: string } {
  const g = genre.toLowerCase();
  const seed = hashString(`${title.toLowerCase()}|${artist.toLowerCase()}|${g}`);

  let clusterId = 3;
  let base: AudioFeatures7D = {
    bpm: 118,
    energy: 0.72,
    danceability: 0.68,
    valence: 0.62,
    acousticness: 0.14,
    instrumentalness: 0.04,
    speechiness: 0.07,
  };

  if (
    g.includes('r&b') ||
    g.includes('soul') ||
    g.includes('hip-hop') ||
    g.includes('rap')
  ) {
    clusterId = 1;
    const isRap = g.includes('hip-hop') || g.includes('rap');
    base = {
      bpm: isRap ? 98 : 104,
      energy: isRap ? 0.68 : 0.54,
      danceability: isRap ? 0.78 : 0.69,
      valence: isRap ? 0.45 : 0.41,
      acousticness: isRap ? 0.12 : 0.24,
      instrumentalness: 0.02,
      speechiness: isRap ? 0.28 : 0.12,
    };
  } else if (
    g.includes('synth') ||
    g.includes('new wave') ||
    g.includes('rock') ||
    g.includes('metal') ||
    g.includes('punk')
  ) {
    clusterId = 2;
    const isHeavy = g.includes('rock') || g.includes('metal') || g.includes('punk');
    base = {
      bpm: isHeavy ? 136 : 128,
      energy: isHeavy ? 0.85 : 0.79,
      danceability: isHeavy ? 0.52 : 0.64,
      valence: isHeavy ? 0.44 : 0.46,
      acousticness: isHeavy ? 0.06 : 0.04,
      instrumentalness: 0.09,
      speechiness: 0.06,
    };
  } else if (
    g.includes('electronic') ||
    g.includes('dance') ||
    g.includes('house') ||
    g.includes('techno') ||
    g.includes('trance') ||
    g.includes('ambient')
  ) {
    clusterId = 4;
    base = {
      bpm: 122,
      energy: 0.71,
      danceability: 0.70,
      valence: 0.36,
      acousticness: 0.09,
      instrumentalness: 0.68,
      speechiness: 0.05,
    };
  } else if (
    g.includes('indie') ||
    g.includes('alternative') ||
    g.includes('folk') ||
    g.includes('singer') ||
    g.includes('acoustic') ||
    g.includes('jazz') ||
    g.includes('classical') ||
    g.includes('soundtrack')
  ) {
    clusterId = 5;
    const isAcoustic =
      g.includes('folk') ||
      g.includes('acoustic') ||
      g.includes('jazz') ||
      g.includes('classical') ||
      g.includes('singer');
    base = {
      bpm: isAcoustic ? 106 : 124,
      energy: isAcoustic ? 0.36 : 0.54,
      danceability: isAcoustic ? 0.44 : 0.53,
      valence: isAcoustic ? 0.32 : 0.35,
      acousticness: isAcoustic ? 0.76 : 0.38,
      instrumentalness: g.includes('classical') || g.includes('jazz') ? 0.78 : 0.24,
      speechiness: 0.04,
    };
  } else if (g.includes('pop') || g.includes('disco') || g.includes('funk') || g.includes('latin')) {
    clusterId = 3;
    base = {
      bpm: 116,
      energy: 0.76,
      danceability: 0.75,
      valence: 0.74,
      acousticness: 0.11,
      instrumentalness: 0.02,
      speechiness: 0.07,
    };
  }

  const jitter = (val: number, span: number, step: number, min = 0.01, max = 0.97) =>
    Number(Math.min(max, Math.max(min, val + (seededRand(seed, step) - 0.5) * span)).toFixed(2));

  const features: AudioFeatures7D = {
    bpm: Math.round(Math.min(188, Math.max(66, base.bpm + (seededRand(seed, 1) - 0.5) * 34))),
    energy: jitter(base.energy, 0.20, 2),
    danceability: jitter(base.danceability, 0.20, 3),
    valence: jitter(base.valence, 0.26, 4),
    acousticness: jitter(base.acousticness, 0.20, 5),
    instrumentalness: jitter(base.instrumentalness, 0.24, 6, 0.0, 0.95),
    speechiness: jitter(base.speechiness, 0.08, 7, 0.02, 0.48),
  };

  return {
    features,
    clusterId,
    clusterLabel: CLUSTER_META[clusterId]?.label ?? 'Sonic Cluster',
  };
}

export function rankRecommendations(
  seed: Track,
  candidates: Track[],
  count = 60
): RecommendedTrack[] {
  const seedTitleNorm = seed.title.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').trim();
  const seenKeys = new Set<string>([`${seedTitleNorm}|${seed.artist.toLowerCase()}`]);
  const seedLang =
    seed.language ?? detectTrackLanguage(seed.title, seed.artist, seed.genre, seed.album);

  interface ScoredCandidate {
    track: RecommendedTrack;
    rankScore: number;
    sameLang: boolean;
  }

  const rawScored: ScoredCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.id === seed.id) continue;
    const titleNorm = candidate.title.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const key = `${titleNorm}|${candidate.artist.toLowerCase()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const candLang =
      candidate.language ??
      detectTrackLanguage(
        candidate.title,
        candidate.artist,
        candidate.genre,
        candidate.album
      );
    const sameLang = candLang === seedLang;

    const rawCosine = computeCosineSimilarity(seed.features, candidate.features);
    const clusterBonus = candidate.clusterId === seed.clusterId ? 0.016 : 0;
    const adjusted = Math.min(0.994, rawCosine * 0.978 + clusterBonus);
    const similarityPct = Number((adjusted * 100).toFixed(1));

    // Prefer same-language tracks by default (+4.5 rank points), while allowing strong cross-language fits (>= ~94% cosine match) to surface naturally
    const langBoost = sameLang ? 4.5 : 0;

    rawScored.push({
      track: {
        ...candidate,
        language: candLang,
        similarityPct,
        dominantTraitMatch: findDominantTraitMatch(seed.features, candidate.features),
      },
      rankScore: similarityPct + langBoost,
      sameLang,
    });
  }

  rawScored.sort((a, b) => b.rankScore - a.rankScore);

  // Softly promote artist diversity in the top rows
  const artistCounts = new Map<string, number>();
  const diversePool: ScoredCandidate[] = [];
  const repeatPool: ScoredCandidate[] = [];

  for (const item of rawScored) {
    const primaryArtist =
      item.track.artist.split(/[,&]/)[0]?.trim().toLowerCase() ??
      item.track.artist.toLowerCase();
    const currentCount = artistCounts.get(primaryArtist) ?? 0;
    artistCounts.set(primaryArtist, currentCount + 1);
    if (currentCount < 2) {
      diversePool.push(item);
    } else {
      repeatPool.push(item);
    }
  }

  const combined = [...diversePool, ...repeatPool].slice(0, count);
  combined.sort((a, b) => b.rankScore - a.rankScore);
  return combined.map((c) => c.track);
}
