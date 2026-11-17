export type TraitKey =
  | 'tempo'
  | 'energy'
  | 'danceability'
  | 'valence'
  | 'acousticness'
  | 'instrumentalness'
  | 'speechiness';

export interface AudioFeatures7D {
  /** Beats per minute (typically 60 - 190) */
  bpm: number;
  /** 0.0 - 1.0 intensity & perceptual loudness */
  energy: number;
  /** 0.0 - 1.0 rhythmic stability & groove */
  danceability: number;
  /** 0.0 - 1.0 musical positiveness / mood */
  valence: number;
  /** 0.0 - 1.0 organic vs synthesized timbre */
  acousticness: number;
  /** 0.0 - 1.0 absence of lead vocals */
  instrumentalness: number;
  /** 0.0 - 1.0 presence of spoken rhythmic cadence */
  speechiness: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: number;
  genre: string;
  language?: string;
  clusterId: number;
  clusterLabel: string;
  coverArt: string;
  accentHex: string;
  durationSec: number;
  previewUrl?: string;
  features: AudioFeatures7D;
  isSynthesized?: boolean;
}

export interface RecommendedTrack extends Track {
  similarityPct: number;
  dominantTraitMatch: string;
}

export type AppStage = 'search' | 'analyzing' | 'results';

export interface AudioTraitMeta {
  key: TraitKey;
  label: string;
  shortLabel: string;
  description: string;
}
