import {
  CLUSTER_META,
  derive7DFeaturesFromMetadata,
  detectTrackLanguage,
  rankRecommendations,
} from '../shared/dnaMath.ts';
import type { AudioFeatures7D, AudioTraitMeta, RecommendedTrack, Track } from '../types/music.ts';

export const AUDIO_TRAITS_META: AudioTraitMeta[] = [
  {
    key: 'tempo',
    label: 'Tempo',
    shortLabel: 'BPM',
    description: 'Normalized rhythmic pulse velocity across 60–190 BPM.',
  },
  {
    key: 'energy',
    label: 'Energy',
    shortLabel: 'NRG',
    description: 'Perceptual intensity, dynamic density, and harmonic drive.',
  },
  {
    key: 'danceability',
    label: 'Danceability',
    shortLabel: 'DNC',
    description: 'Beat regularity, groove lock, and rhythmic stability.',
  },
  {
    key: 'valence',
    label: 'Valence',
    shortLabel: 'VAL',
    description: 'Emotional brightness ranging from melancholic to euphoric.',
  },
  {
    key: 'acousticness',
    label: 'Acousticness',
    shortLabel: 'ACO',
    description: 'Ratio of organic resonance versus analog/digital synthesis.',
  },
  {
    key: 'instrumentalness',
    label: 'Instrumentalness',
    shortLabel: 'INS',
    description: 'Spectral dominance of melodic instrumentation over vocals.',
  },
  {
    key: 'speechiness',
    label: 'Speechiness',
    shortLabel: 'SPC',
    description: 'Presence of rhythmic spoken phrasing and vocal cadence.',
  },
];

interface SeedEntry {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: number;
  genre: string;
  clusterId: number;
  durationSec: number;
  features?: Partial<AudioFeatures7D>;
}

const RAW_CURATED_TRACKS: SeedEntry[] = [
  // Cluster 2: High-Energy Synth & Rock
  {
    id: 'blinding-lights',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    year: 2020,
    genre: 'Synthwave Pop',
    clusterId: 2,
    durationSec: 200,
    features: { bpm: 171, energy: 0.80, danceability: 0.51, valence: 0.33, acousticness: 0.01, instrumentalness: 0.02, speechiness: 0.06 },
  },
  {
    id: 'take-my-breath',
    title: 'Take My Breath',
    artist: 'The Weeknd',
    album: 'Dawn FM',
    year: 2022,
    genre: 'Synth-Disco',
    clusterId: 2,
    durationSec: 220,
    features: { bpm: 121, energy: 0.82, danceability: 0.74, valence: 0.48, acousticness: 0.02, instrumentalness: 0.04, speechiness: 0.05 },
  },
  {
    id: 'midnight-city',
    title: 'Midnight City',
    artist: 'M83',
    album: "Hurry Up, We're Dreaming",
    year: 2011,
    genre: 'Electronic Synth',
    clusterId: 2,
    durationSec: 243,
    features: { bpm: 105, energy: 0.78, danceability: 0.53, valence: 0.39, acousticness: 0.03, instrumentalness: 0.14, speechiness: 0.04 },
  },
  {
    id: 'nightcall',
    title: 'Nightcall',
    artist: 'Kavinsky',
    album: 'OutRun',
    year: 2010,
    genre: 'Outrun Synthwave',
    clusterId: 2,
    durationSec: 258,
    features: { bpm: 91, energy: 0.74, danceability: 0.62, valence: 0.24, acousticness: 0.04, instrumentalness: 0.28, speechiness: 0.05 },
  },
  {
    id: 'physical',
    title: 'Physical',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    year: 2020,
    genre: 'Electro-Pop',
    clusterId: 2,
    durationSec: 193,
    features: { bpm: 147, energy: 0.84, danceability: 0.65, valence: 0.74, acousticness: 0.01, instrumentalness: 0.01, speechiness: 0.05 },
  },
  {
    id: 'less-i-know',
    title: 'The Less I Know The Better',
    artist: 'Tame Impala',
    album: 'Currents',
    year: 2015,
    genre: 'Psychedelic Synth',
    clusterId: 2,
    durationSec: 216,
    features: { bpm: 117, energy: 0.74, danceability: 0.64, valence: 0.78, acousticness: 0.02, instrumentalness: 0.05, speechiness: 0.03 },
  },
  { id: 'mr-brightside', title: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', year: 2004, genre: 'Alternative Rock', clusterId: 2, durationSec: 222 },
  { id: 'do-i-wanna-know', title: 'Do I Wanna Know?', artist: 'Arctic Monkeys', album: 'AM', year: 2013, genre: 'Indie Rock', clusterId: 2, durationSec: 272 },
  { id: 'viva-la-vida', title: 'Viva La Vida', artist: 'Coldplay', album: 'Viva La Vida', year: 2008, genre: 'Alt Pop Rock', clusterId: 2, durationSec: 242 },
  { id: 'bohemian-rhapsody', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', year: 1975, genre: 'Classic Rock', clusterId: 2, durationSec: 354 },
  { id: 'dreams-fleetwood', title: 'Dreams', artist: 'Fleetwood Mac', album: 'Rumours', year: 1977, genre: 'Classic Rock', clusterId: 2, durationSec: 257 },
  { id: 'running-up-that-hill', title: 'Running Up That Hill', artist: 'Kate Bush', album: 'Hounds of Love', year: 1985, genre: 'Art Synth-Pop', clusterId: 2, durationSec: 298 },

  // Cluster 1: Velvet Nocturne R&B & Hip-Hop
  {
    id: 'starboy',
    title: 'Starboy',
    artist: 'The Weeknd, Daft Punk',
    album: 'Starboy',
    year: 2016,
    genre: 'Dark R&B',
    clusterId: 1,
    durationSec: 230,
    features: { bpm: 186, energy: 0.59, danceability: 0.68, valence: 0.49, acousticness: 0.14, instrumentalness: 0.01, speechiness: 0.28 },
  },
  {
    id: 'after-hours',
    title: 'After Hours',
    artist: 'The Weeknd',
    album: 'After Hours',
    year: 2020,
    genre: 'Alt R&B',
    clusterId: 1,
    durationSec: 361,
    features: { bpm: 109, energy: 0.57, danceability: 0.66, valence: 0.15, acousticness: 0.08, instrumentalness: 0.07, speechiness: 0.04 },
  },
  {
    id: 'nights',
    title: 'Nights',
    artist: 'Frank Ocean',
    album: 'Blonde',
    year: 2016,
    genre: 'Experimental R&B',
    clusterId: 1,
    durationSec: 307,
    features: { bpm: 90, energy: 0.55, danceability: 0.46, valence: 0.43, acousticness: 0.43, instrumentalness: 0.01, speechiness: 0.16 },
  },
  {
    id: 'redbone',
    title: 'Redbone',
    artist: 'Childish Gambino',
    album: 'Awaken, My Love!',
    year: 2016,
    genre: 'Psychedelic Soul',
    clusterId: 1,
    durationSec: 326,
    features: { bpm: 80, energy: 0.35, danceability: 0.74, valence: 0.59, acousticness: 0.20, instrumentalness: 0.02, speechiness: 0.11 },
  },
  { id: 'snooze', title: 'Snooze', artist: 'SZA', album: 'SOS', year: 2022, genre: 'Contemporary R&B', clusterId: 1, durationSec: 201 },
  { id: 'kill-bill', title: 'Kill Bill', artist: 'SZA', album: 'SOS', year: 2022, genre: 'Alt R&B', clusterId: 1, durationSec: 153 },
  { id: 'luther', title: 'luther', artist: 'Kendrick Lamar, SZA', album: 'GNX', year: 2024, genre: 'Hip-Hop / R&B', clusterId: 1, durationSec: 177 },
  { id: 'humble', title: 'HUMBLE.', artist: 'Kendrick Lamar', album: 'DAMN.', year: 2017, genre: 'Hip-Hop / Rap', clusterId: 1, durationSec: 177 },
  { id: 'sicko-mode', title: 'SICKO MODE', artist: 'Travis Scott', album: 'ASTROWORLD', year: 2018, genre: 'Hip-Hop / Rap', clusterId: 1, durationSec: 312 },
  { id: 'passionfruit', title: 'Passionfruit', artist: 'Drake', album: 'More Life', year: 2017, genre: 'Dancehall R&B', clusterId: 1, durationSec: 298 },
  { id: 'pink-white', title: 'Pink + White', artist: 'Frank Ocean', album: 'Blonde', year: 2016, genre: 'Neo-Soul', clusterId: 1, durationSec: 184 },

  // Cluster 3: Kinetic Nu-Disco & Global Pop
  {
    id: 'levitating',
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    year: 2020,
    genre: 'Nu-Disco Pop',
    clusterId: 3,
    durationSec: 203,
    features: { bpm: 103, energy: 0.83, danceability: 0.70, valence: 0.91, acousticness: 0.01, instrumentalness: 0.00, speechiness: 0.06 },
  },
  {
    id: 'get-lucky',
    title: 'Get Lucky',
    artist: 'Daft Punk, Pharrell Williams',
    album: 'Random Access Memories',
    year: 2013,
    genre: 'French Disco',
    clusterId: 3,
    durationSec: 248,
    features: { bpm: 116, energy: 0.81, danceability: 0.79, valence: 0.86, acousticness: 0.04, instrumentalness: 0.01, speechiness: 0.04 },
  },
  { id: 'instant-crush', title: 'Instant Crush', artist: 'Daft Punk, Julian Casablancas', album: 'Random Access Memories', year: 2013, genre: 'Synth-Funk', clusterId: 3, durationSec: 337 },
  { id: 'espresso', title: 'Espresso', artist: 'Sabrina Carpenter', album: "Short n' Sweet", year: 2024, genre: 'Pop', clusterId: 3, durationSec: 175 },
  { id: 'cruel-summer', title: 'Cruel Summer', artist: 'Taylor Swift', album: 'Lover', year: 2019, genre: 'Synth-Pop', clusterId: 3, durationSec: 178 },
  { id: 'birds-of-a-feather', title: 'BIRDS OF A FEATHER', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', year: 2024, genre: 'Pop', clusterId: 3, durationSec: 210 },
  { id: 'bad-guy', title: 'bad guy', artist: 'Billie Eilish', album: 'WHEN WE ALL FALL ASLEEP', year: 2019, genre: 'Alt Pop', clusterId: 3, durationSec: 194 },
  { id: 'as-it-was', title: 'As It Was', artist: 'Harry Styles', album: "Harry's House", year: 2022, genre: 'Indie Synth-Pop', clusterId: 3, durationSec: 167 },
  { id: 'pink-pony-club', title: 'Pink Pony Club', artist: 'Chappell Roan', album: 'The Rise and Fall of a Midwest Princess', year: 2023, genre: 'Synth-Pop', clusterId: 3, durationSec: 258 },
  { id: 'say-so', title: 'Say So', artist: 'Doja Cat', album: 'Hot Pink', year: 2019, genre: 'Disco Pop', clusterId: 3, durationSec: 237 },
  { id: 'titi-me-pregunto', title: 'Tití Me Preguntó', artist: 'Bad Bunny', album: 'Un Verano Sin Ti', year: 2022, genre: 'Latin Urbano', clusterId: 3, durationSec: 243 },
  { id: 'apt', title: 'APT.', artist: 'ROSÉ, Bruno Mars', album: 'rosie', year: 2024, genre: 'Pop Rock', clusterId: 3, durationSec: 170 },

  // Cluster 4: Deep Cosmic Electronic
  {
    id: 'resonance',
    title: 'Resonance',
    artist: 'HOME',
    album: 'Odyssey',
    year: 2014,
    genre: 'Chillwave',
    clusterId: 4,
    durationSec: 212,
    features: { bpm: 100, energy: 0.54, danceability: 0.61, valence: 0.34, acousticness: 0.19, instrumentalness: 0.89, speechiness: 0.03 },
  },
  {
    id: 'innerbloom',
    title: 'Innerbloom',
    artist: 'RÜFÜS DU SOL',
    album: 'Bloom',
    year: 2016,
    genre: 'Melodic House',
    clusterId: 4,
    durationSec: 578,
    features: { bpm: 122, energy: 0.58, danceability: 0.67, valence: 0.26, acousticness: 0.07, instrumentalness: 0.74, speechiness: 0.03 },
  },
  { id: 'veridis-quo', title: 'Veridis Quo', artist: 'Daft Punk', album: 'Discovery', year: 2001, genre: 'Electronic', clusterId: 4, durationSec: 345 },
  { id: 'one-more-time', title: 'One More Time', artist: 'Daft Punk', album: 'Discovery', year: 2000, genre: 'French House', clusterId: 4, durationSec: 320 },
  { id: 'genesis', title: 'Genesis', artist: 'Grimes', album: 'Visions', year: 2012, genre: 'Dream Electronic', clusterId: 4, durationSec: 255 },
  { id: 'a-moment-apart', title: 'A Moment Apart', artist: 'ODESZA', album: 'A Moment Apart', year: 2017, genre: 'Atmospheric Electronic', clusterId: 4, durationSec: 234 },
  { id: 'delilah', title: 'Delilah (pull me out of this)', artist: 'Fred again..', album: 'Actual Life 3', year: 2022, genre: 'UK Electronic', clusterId: 4, durationSec: 250 },
  { id: 'latch', title: 'Latch', artist: 'Disclosure, Sam Smith', album: 'Settle', year: 2012, genre: 'UK Garage House', clusterId: 4, durationSec: 255 },
  { id: 'strobe', title: 'Strobe', artist: 'deadmau5', album: 'For Lack of a Better Name', year: 2009, genre: 'Progressive House', clusterId: 4, durationSec: 637 },
  { id: 'titanium', title: 'Midnight', artist: 'Lane 8', album: 'Brightest Lights', year: 2020, genre: 'Melodic Deep House', clusterId: 4, durationSec: 285 },

  // Cluster 5: Atmospheric Indie, Acoustic & Jazz
  {
    id: 'space-song',
    title: 'Space Song',
    artist: 'Beach House',
    album: 'Depression Cherry',
    year: 2015,
    genre: 'Dream Pop',
    clusterId: 5,
    durationSec: 320,
    features: { bpm: 147, energy: 0.47, danceability: 0.51, valence: 0.21, acousticness: 0.32, instrumentalness: 0.45, speechiness: 0.03 },
  },
  {
    id: 'holocene',
    title: 'Holocene',
    artist: 'Bon Iver',
    album: 'Bon Iver',
    year: 2011,
    genre: 'Indie Folk',
    clusterId: 5,
    durationSec: 337,
    features: { bpm: 148, energy: 0.30, danceability: 0.38, valence: 0.18, acousticness: 0.87, instrumentalness: 0.22, speechiness: 0.03 },
  },
  { id: 'apocalypse', title: 'Apocalypse', artist: 'Cigarettes After Sex', album: 'Cigarettes After Sex', year: 2017, genre: 'Ambient Shoegaze', clusterId: 5, durationSec: 290 },
  { id: 'motion-sickness', title: 'Motion Sickness', artist: 'Phoebe Bridgers', album: 'Stranger in the Alps', year: 2017, genre: 'Indie Rock', clusterId: 5, durationSec: 229 },
  { id: 'creep', title: 'Creep', artist: 'Radiohead', album: 'Pablo Honey', year: 1993, genre: 'Alternative Rock', clusterId: 5, durationSec: 238 },
  { id: 'chamber-of-reflection', title: 'Chamber Of Reflection', artist: 'Mac DeMarco', album: 'Salad Days', year: 2014, genre: 'Indie Psychedelic', clusterId: 5, durationSec: 231 },
  { id: 'telepatia', title: 'telepatía', artist: 'Kali Uchis', album: 'Sin Miedo', year: 2020, genre: 'Dream Soul', clusterId: 5, durationSec: 160 },
  { id: 'blue-in-green', title: 'Blue in Green', artist: 'Miles Davis', album: 'Kind of Blue', year: 1959, genre: 'Modal Jazz', clusterId: 5, durationSec: 327 },
  { id: 'cornfield-chase', title: 'Cornfield Chase', artist: 'Hans Zimmer', album: 'Interstellar', year: 2014, genre: 'Film Soundtrack', clusterId: 5, durationSec: 126 },
  { id: 'sweater-weather', title: 'Sweater Weather', artist: 'The Neighbourhood', album: 'I Love You.', year: 2013, genre: 'Alt Indie', clusterId: 5, durationSec: 240 },
];

export const TRACK_CATALOG: Track[] = RAW_CURATED_TRACKS.map((entry) => {
  const derived = derive7DFeaturesFromMetadata(entry.title, entry.artist, entry.genre);
  const clusterMeta = CLUSTER_META[entry.clusterId] ?? CLUSTER_META[derived.clusterId];
  return {
    id: entry.id,
    title: entry.title,
    artist: entry.artist,
    album: entry.album,
    year: entry.year,
    genre: entry.genre,
    language: detectTrackLanguage(entry.title, entry.artist, entry.genre, entry.album),
    clusterId: entry.clusterId,
    clusterLabel: clusterMeta.label,
    coverArt: clusterMeta.fallbackCover,
    accentHex: clusterMeta.accentHex,
    durationSec: entry.durationSec,
    features: {
      ...derived.features,
      ...entry.features,
    },
  };
});

export const SAMPLE_PILLS = [
  { id: 'blinding-lights', label: 'Blinding Lights', artist: 'The Weeknd' },
  { id: 'starboy', label: 'Starboy', artist: 'The Weeknd' },
  { id: 'midnight-city', label: 'Midnight City', artist: 'M83' },
  { id: 'resonance', label: 'Resonance', artist: 'HOME' },
];

export function resolveOrSynthesizeTrack(rawQuery: string): Track {
  const cleaned = rawQuery.trim();
  const q = cleaned.toLowerCase();

  const exact = TRACK_CATALOG.find(
    (t) =>
      t.id === q ||
      t.title.toLowerCase() === q ||
      `${t.title} ${t.artist}`.toLowerCase() === q
  );
  if (exact) return exact;

  const partial = TRACK_CATALOG.find(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q)
  );
  if (partial && q.length >= 3) return partial;

  let title = cleaned;
  let artist = 'Custom Acoustic Query';
  if (cleaned.includes(' - ')) {
    const [tPart, ...aParts] = cleaned.split(' - ');
    if (tPart.trim()) title = tPart.trim();
    if (aParts.join(' - ').trim()) artist = aParts.join(' - ').trim();
  }

  const derived = derive7DFeaturesFromMetadata(title, artist, 'Synth Pop');
  const clusterMeta = CLUSTER_META[derived.clusterId];
  const detectedLanguage = detectTrackLanguage(title, artist);

  return {
    id: `custom-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    title,
    artist,
    album: 'Synthesized 7D Profile',
    year: 2026,
    genre: clusterMeta.label,
    language: detectedLanguage,
    clusterId: derived.clusterId,
    clusterLabel: clusterMeta.label,
    coverArt: clusterMeta.fallbackCover,
    accentHex: clusterMeta.accentHex,
    durationSec: 214,
    features: derived.features,
    isSynthesized: true,
  };
}

export function recommendTracksForSeed(seed: Track, count = 50): RecommendedTrack[] {
  return rankRecommendations(seed, TRACK_CATALOG, count);
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
