import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { Readable } from 'stream';
import { TRACK_CATALOG } from './src/data/catalog.ts';
import {
  CLUSTER_META,
  derive7DFeaturesFromMetadata,
  detectTrackLanguage,
  rankRecommendations,
} from './src/shared/dnaMath.ts';
import type { Track } from './src/types/music.ts';

interface ITunesSongResult {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  previewUrl?: string;
  artworkUrl100?: string;
}

interface ITunesResponse {
  resultCount?: number;
  results?: ITunesSongResult[];
}

// Simple LRU-style in-memory cache so repeated searches & sample pills feel instant
const searchCache = new Map<string, { ts: number; tracks: Track[] }>();
const CACHE_TTL_MS = 1000 * 60 * 15;

function mapITunesToTrack(item: ITunesSongResult): Track | null {
  if (
    item.kind !== 'song' ||
    !item.trackId ||
    !item.trackName ||
    !item.artistName ||
    !item.previewUrl
  ) {
    return null;
  }

  const title = item.trackName.trim();
  const artist = item.artistName.trim();
  const genre = (item.primaryGenreName || 'Pop').trim();
  const album = (item.collectionName || 'Single').trim();
  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : 2024;
  const durationSec = item.trackTimeMillis
    ? Math.max(60, Math.round(item.trackTimeMillis / 1000))
    : 210;

  const { features, clusterId, clusterLabel } = derive7DFeaturesFromMetadata(
    title,
    artist,
    genre
  );
  const language = detectTrackLanguage(title, artist, genre, album);

  const highResArt = item.artworkUrl100
    ? item.artworkUrl100.replace(/100x100bb\.(jpg|png)/i, '600x600bb.$1')
    : CLUSTER_META[clusterId]?.fallbackCover ??
      '/src/assets/images/album_synth_night_1794915755115.jpg';

  return {
    id: `itunes-${item.trackId}`,
    title,
    artist,
    album,
    year: Number.isFinite(year) ? year : 2024,
    genre,
    language,
    clusterId,
    clusterLabel,
    coverArt: highResArt,
    accentHex: CLUSTER_META[clusterId]?.accentHex ?? '#1DB954',
    durationSec,
    previewUrl: item.previewUrl,
    features,
  };
}

async function fetchITunesSongs(term: string, limit = 15): Promise<Track[]> {
  const cleanTerm = term.trim();
  if (!cleanTerm) return [];

  const cacheKey = `${cleanTerm.toLowerCase()}::${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.tracks;
  }

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    cleanTerm
  )}&entity=song&media=music&country=US&limit=${limit}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ITunesResponse;
    const mapped = (data.results ?? [])
      .map(mapITunesToTrack)
      .filter((t): t is Track => t !== null);

    // Deduplicate by normalized title + artist
    const seen = new Set<string>();
    const deduped: Track[] = [];
    for (const track of mapped) {
      const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(track);
      }
    }

    if (searchCache.size > 200) {
      const firstKey = searchCache.keys().next().value;
      if (firstKey) searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, { ts: Date.now(), tracks: deduped });
    return deduped;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function getPeerSearchTerms(seed: Track): string[] {
  const genre = seed.genre.toLowerCase();
  const lang =
    seed.language ?? detectTrackLanguage(seed.title, seed.artist, seed.genre, seed.album);
  const terms = new Set<string>();

  const primaryArtist = seed.artist.split(/[,&]/)[0]?.trim();
  if (primaryArtist) {
    if (lang !== 'English' && primaryArtist.length <= 6) {
      terms.add(`${primaryArtist} ${lang}`);
    } else {
      terms.add(primaryArtist);
    }
  }

  // Prioritize same-language candidates when seed is non-English, while keeping 1 genre-matched peer query for strong cross-language fits
  if (lang === 'Spanish') {
    terms.add('bad bunny rauw alejandro');
    terms.add('karol g feid');
    terms.add('shakira rosalia');
    terms.add('musica latina reggaeton');
    terms.add('luis fonsi daddy yankee');
    terms.add('j balvin maluma');
  } else if (lang === 'Korean') {
    terms.add('newjeans aespa');
    terms.add('bts jung kook');
    terms.add('blackpink ive');
    terms.add('stray kids seventeen');
    terms.add('iu taeyeon');
    terms.add('k-pop hits');
  } else if (lang === 'Japanese') {
    terms.add('yoasobi kenshi yonezu');
    terms.add('fujii kaze ado');
    terms.add('vaundy official hige dandism');
    terms.add('radwimps king gnu');
    terms.add('aimyon back number');
    terms.add('j-pop hits');
  } else if (lang === 'Malayalam') {
    terms.add('malayalam hits');
    terms.add('sushin shyam malayalam');
    terms.add('vineeth sreenivasan');
    terms.add('shaan rahman');
    terms.add('hesham abdul wahab malayalam');
    terms.add('vijay yesudas malayalam');
    terms.add('gopi sundar malayalam');
  } else if (lang === 'Tamil') {
    terms.add('anirudh ravichander tamil');
    terms.add('ar rahman tamil');
    terms.add('yuvan shankar raja');
    terms.add('harris jayaraj tamil');
    terms.add('gv prakash tamil');
    terms.add('tamil hits');
  } else if (lang === 'Telugu') {
    terms.add('thaman s telugu');
    terms.add('devi sri prasad telugu');
    terms.add('mm keeravani telugu');
    terms.add('sid sriram telugu');
    terms.add('telugu hits');
  } else if (lang === 'Kannada') {
    terms.add('kannada hits');
    terms.add('vijay prakash kannada');
    terms.add('ajaneesh loknath kannada');
    terms.add('ravi basrur kannada');
    terms.add('sanjith hegde kannada');
  } else if (lang === 'Punjabi') {
    terms.add('diljit dosanjh');
    terms.add('ap dhillon');
    terms.add('karan aujla');
    terms.add('sidhu moose wala');
    terms.add('shubh punjabi');
    terms.add('punjabi hits');
  } else if (lang === 'Marathi') {
    terms.add('ajay atul marathi');
    terms.add('marathi hits');
    terms.add('shankar mahadevan marathi');
    terms.add('swapnil bandodkar');
    terms.add('bela shende marathi');
  } else if (lang === 'Bengali') {
    terms.add('anupam roy bengali');
    terms.add('rupam islam fossils');
    terms.add('bengali hits');
    terms.add('arijit singh bengali');
    terms.add('shreya ghoshal bengali');
  } else if (lang === 'Gujarati') {
    terms.add('aditya gadhvi');
    terms.add('kirtidan gadhvi');
    terms.add('kinjal dave gujarati');
    terms.add('geeta rabari gujarati');
    terms.add('gujarati garba hits');
  } else if (lang === 'Bhojpuri') {
    terms.add('pawan singh bhojpuri');
    terms.add('khesari lal yadav');
    terms.add('shilpi raj bhojpuri');
    terms.add('bhojpuri hits');
  } else if (lang === 'Odia') {
    terms.add('humane sagar odia');
    terms.add('aseema panda odia');
    terms.add('odia hits');
  } else if (lang === 'Assamese') {
    terms.add('zubeen garg assamese');
    terms.add('papon assamese');
    terms.add('assamese bihu hits');
  } else if (lang === 'Haryanvi') {
    terms.add('masoom sharma haryanvi');
    terms.add('raju punjabi haryanvi');
    terms.add('haryanvi hits');
  } else if (lang === 'Urdu') {
    terms.add('coke studio pakistan');
    terms.add('rahat fateh ali khan');
    terms.add('ali sethi kaifi khalil');
    terms.add('nusrat fateh ali khan');
    terms.add('urdu hits');
  } else if (lang === 'Turkish') {
    terms.add('tarkan turkish');
    terms.add('mabel matiz sezen aksu');
    terms.add('ezhel duman');
    terms.add('turkish pop');
  } else if (lang === 'Indonesian') {
    terms.add('tulus nadin amizah');
    terms.add('mahalini tiara andini');
    terms.add('sheila on 7 dewa 19');
    terms.add('indonesian pop');
  } else if (lang === 'Vietnamese') {
    terms.add('son tung mtp');
    terms.add('hoang thuy linh vpop');
    terms.add('bich phuong den vau');
    terms.add('vietnamese pop');
  } else if (lang === 'Tagalog') {
    terms.add('ben&ben opm');
    terms.add('moira dela torre zack tabudlo');
    terms.add('sb19 bini opm');
    terms.add('opm tagalog hits');
  } else if (lang === 'Polish') {
    terms.add('dawid podsiadlo sanah');
    terms.add('taco hemingway mata');
    terms.add('polish pop');
  } else if (lang === 'Hindi') {
    terms.add('arijit singh pritam');
    terms.add('anirudh shreya ghoshal');
    terms.add('atif aslam bollywood');
    terms.add('arman malik sachin jigar');
    terms.add('hindi romantic hits');
  } else if (lang === 'French') {
    terms.add('stromae angele');
    terms.add('aya nakamura indila');
    terms.add('french pop chanson');
    terms.add('gims vianney');
  } else if (lang === 'Portuguese') {
    terms.add('anitta ludmilla');
    terms.add('seu jorge djavan');
    terms.add('mpb brasil');
    terms.add('sertanejo brasil');
  } else if (lang === 'Arabic') {
    terms.add('amr diab elissa');
    terms.add('nancy ajram tamer hosny');
    terms.add('sherine assala');
    terms.add('arabic pop');
  } else if (lang === 'Chinese') {
    terms.add('jay chou eric chou');
    terms.add('mandopop hits');
    terms.add('cantopop eason chan');
    terms.add('jj lin gem');
  } else if (lang === 'German') {
    terms.add('apache 207 nena');
    terms.add('mark forster cro');
    terms.add('german pop');
  } else if (lang === 'Italian') {
    terms.add('maneskin mahmood');
    terms.add('lazza geolier');
    terms.add('italian pop');
  } else if (lang === 'Russian') {
    terms.add('russian pop');
    terms.add('miyagi & andy panda');
    terms.add('monetochka zivert');
  }

  // Add English/global genre peer queries only for English seeds or when language-specific queries are sparse
  if (lang === 'English' || terms.size < 4) {
    if (genre.includes('r&b') || genre.includes('soul')) {
      terms.add('the weeknd after hours');
      terms.add('frank ocean blonde');
      terms.add('sza snooze');
    } else if (genre.includes('hip-hop') || genre.includes('rap')) {
      terms.add('kendrick lamar');
      terms.add('travis scott');
      terms.add('drake');
    } else if (genre.includes('rock') || genre.includes('alternative')) {
      terms.add('tame impala currents');
      terms.add('arctic monkeys am');
      terms.add('radiohead');
    } else if (genre.includes('electronic') || genre.includes('dance')) {
      terms.add('daft punk discovery');
      terms.add('rufus du sol');
      terms.add('odesza');
    } else if (genre.includes('indie') || genre.includes('folk')) {
      terms.add('beach house space song');
      terms.add('bon iver');
      terms.add('phoebe bridgers');
    } else if (genre.includes('jazz')) {
      terms.add('miles davis');
      terms.add('kamasi washington');
    } else {
      terms.add('dua lipa future nostalgia');
      terms.add('the weeknd blinding lights');
      terms.add('billie eilish');
    }
  }

  return Array.from(terms).slice(0, 8);
}

const UNWANTED_TITLE_RE =
  /\b(remix|live|karaoke|tribute|cover|instrumental|lullaby|club edit|8-bit|sped up|slowed)\b/i;
const UNWANTED_ARTIST_RE =
  /\b(kidz bop|twinkle twinkle|rockabye|piano dreamers|string quartet|vitamin string|karaoke|tribute)\b/i;

function pickBestSeedHit(
  hits: Track[],
  queryTitle: string,
  queryArtist?: string
): Track | undefined {
  if (hits.length === 0) return undefined;
  const q = queryTitle.toLowerCase().trim();
  const a = queryArtist?.toLowerCase().trim();
  const wantsSpecial = UNWANTED_TITLE_RE.test(q);

  const scored = hits.map((hit) => {
    const titleLower = hit.title.toLowerCase();
    const artistLower = hit.artist.toLowerCase();
    let score = 0;

    if (titleLower === q) score += 50;
    else if (titleLower.startsWith(q)) score += 30;
    else if (titleLower.includes(q)) score += 15;

    if (a) {
      const primaryA = a.split(/[,&]/)[0]?.trim() ?? a;
      if (artistLower === a || artistLower === primaryA) {
        score += 80;
      } else if (artistLower.includes(primaryA) || primaryA.includes(artistLower)) {
        score += 55;
      } else {
        score -= 80;
      }
    }

    if (!wantsSpecial && UNWANTED_TITLE_RE.test(titleLower)) {
      score -= 35;
    }
    if (UNWANTED_ARTIST_RE.test(artistLower)) {
      score -= 60;
    }
    if (hit.previewUrl) score += 10;
    return { hit, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return undefined;
  if (a && best.score < 20) return undefined;
  return best.hit;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Live global song search endpoint
  app.get('/api/music/search', async (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(25, Math.max(1, Number(req.query.limit) || 10));
    if (!q) {
      res.json({ tracks: [] });
      return;
    }

    const rawTracks = await fetchITunesSongs(q, Math.min(25, Math.max(limit * 2, 16)));
    const qLower = q.toLowerCase();
    const wantsSpecial = UNWANTED_TITLE_RE.test(qLower);

    // Deprioritize karaoke/kidz-bop/cover clutter unless explicitly searched
    const sorted = [...rawTracks].sort((a, b) => {
      const penaltyA =
        (!wantsSpecial && UNWANTED_TITLE_RE.test(a.title) ? 1 : 0) +
        (UNWANTED_ARTIST_RE.test(a.artist) ? 2 : 0);
      const penaltyB =
        (!wantsSpecial && UNWANTED_TITLE_RE.test(b.title) ? 1 : 0) +
        (UNWANTED_ARTIST_RE.test(b.artist) ? 2 : 0);
      return penaltyA - penaltyB;
    });

    res.json({ tracks: sorted.slice(0, limit) });
  });

  // Resolve seed track + fetch real candidate pool + compute 7D cosine recommendations
  app.post('/api/music/curate', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      query?: string;
      seedCandidate?: Track;
    };

    const query = String(body.query ?? '').trim();
    let seed = body.seedCandidate;

    if (!seed && query) {
      const qLower = query.toLowerCase();
      const catalogHit = TRACK_CATALOG.find(
        (t) =>
          t.title.toLowerCase() === qLower ||
          `${t.title} ${t.artist}`.toLowerCase() === qLower
      );
      if (catalogHit) {
        seed = catalogHit;
      }
    }

    // If seed has no live previewUrl yet (e.g. came from local catalog or typed text), resolve via iTunes
    if (!seed || !seed.previewUrl) {
      const lookupTerm = seed ? `${seed.title} ${seed.artist}` : query;
      const hits = await fetchITunesSongs(lookupTerm, 15);
      const liveHit = pickBestSeedHit(
        hits,
        seed ? seed.title : query,
        seed ? seed.artist : undefined
      );
      if (liveHit) {
        seed = seed
          ? {
              ...seed,
              previewUrl: liveHit.previewUrl,
              coverArt: liveHit.coverArt || seed.coverArt,
              durationSec: liveHit.durationSec || seed.durationSec,
            }
          : liveHit;
      } else if (!seed) {
        // Fallback to any direct query match if artist-strict check wasn't applicable
        const broadHits = await fetchITunesSongs(query, 10);
        if (broadHits[0]) {
          seed = broadHits[0];
        }
      }
    }

    if (!seed) {
      res.status(404).json({ error: 'No matching song found in global catalog.' });
      return;
    }

    if (!seed.language) {
      seed = {
        ...seed,
        language: detectTrackLanguage(seed.title, seed.artist, seed.genre, seed.album),
      };
    }

    // Gather a deep real playable candidate pool in parallel
    const peerTerms = getPeerSearchTerms(seed);
    const results = await Promise.all(peerTerms.map((term) => fetchITunesSongs(term, 25)));
    const livePool = results.flat();

    // Only include static catalog items if live iTunes returned fewer than 60 tracks
    const candidatePool =
      livePool.length >= 60 ? livePool : [...livePool, ...TRACK_CATALOG];

    let recommendations = rankRecommendations(seed, candidatePool, 65);

    // Enrich any remaining recommendations that lack previewUrl or real album art
    const enrichedRecommendations = await Promise.all(
      recommendations.map(async (rec) => {
        if (rec.previewUrl && !rec.coverArt.startsWith('/src/')) return rec;
        const hits = await fetchITunesSongs(`${rec.title} ${rec.artist}`, 10);
        const match = pickBestSeedHit(hits, rec.title, rec.artist);
        if (!match) return rec;
        return {
          ...rec,
          previewUrl: match.previewUrl,
          coverArt: match.coverArt || rec.coverArt,
          durationSec: match.durationSec || rec.durationSec,
        };
      })
    );

    // Prefer 100% real playable tracks with official cover art whenever available
    const verifiedPlayable = enrichedRecommendations.filter(
      (rec) => Boolean(rec.previewUrl) && !rec.coverArt.startsWith('/src/')
    );

    recommendations =
      verifiedPlayable.length >= 20
        ? verifiedPlayable.slice(0, 55)
        : enrichedRecommendations.slice(0, 55);

    res.json({
      seedTrack: seed,
      recommendations,
    });
  });

  // Same-origin streaming audio proxy for official iTunes 30-second previews
  app.get('/api/music/audio', async (req: Request, res: Response) => {
    let rawUrl = String(req.query.url ?? '').trim();
    if (rawUrl.startsWith('http://audio-ssl.itunes.apple.com/')) {
      rawUrl = rawUrl.replace('http://', 'https://');
    }
    if (!rawUrl.startsWith('https://audio-ssl.itunes.apple.com/')) {
      res.status(400).json({ error: 'Invalid audio preview URL' });
      return;
    }

    const headers: Record<string, string> = {
      Accept: 'audio/mp4, audio/*;q=0.9, */*;q=0.8',
    };
    if (typeof req.headers.range === 'string') {
      headers.Range = req.headers.range;
    }

    const abortController = new AbortController();
    let clientClosed = false;
    res.on('close', () => {
      clientClosed = true;
      abortController.abort();
    });

    try {
      const upstream = await fetch(rawUrl, {
        headers,
        signal: abortController.signal,
      });
      if (!upstream.ok && upstream.status !== 206) {
        if (!res.headersSent) res.status(upstream.status).end();
        return;
      }

      if (clientClosed) return;

      res.status(upstream.status);
      // Apple serves audio/x-m4p which some browsers refuse; audio/mp4 is standard AAC-in-MP4
      res.setHeader('Content-Type', 'audio/mp4');
      res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);

      if (upstream.body) {
        const nodeStream = Readable.fromWeb(
          upstream.body as Parameters<typeof Readable.fromWeb>[0]
        );
        nodeStream.on('error', () => {
          if (!res.writableEnded) res.end();
        });
        res.on('close', () => {
          nodeStream.destroy();
        });
        nodeStream.pipe(res);
      } else {
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (!clientClosed) res.send(buf);
      }
    } catch {
      if (!clientClosed && !res.headersSent) {
        res.status(502).end();
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TuneMatch server running on http://localhost:${PORT}`);
  });
}

void startServer();
