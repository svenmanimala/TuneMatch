import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzePoolAudio, analyzeTrackAudio } from './audio/acousticDsp';
import { audioController, PlaybackMode } from './audio/audioController';
import { HeroSearchView } from './components/HeroSearchView';
import { MiniAudioPlayer } from './components/MiniAudioPlayer';
import { NeuralCurationVisualizer } from './components/NeuralCurationVisualizer';
import { ResultsDashboard } from './components/ResultsDashboard';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { TopNavBar } from './components/TopNavBar';
import { recommendTracksForSeed, resolveOrSynthesizeTrack } from './data/catalog';
import { rankRecommendations } from './shared/dnaMath';
import { AppStage, MatchMode, Track } from './types/music';

const MIN_CURATION_DURATION_MS = 2750;

export interface DspAnalysisProgress {
  completed: number;
  total: number;
  isAnalyzing: boolean;
}

export default function App() {
  const [stage, setStage] = useState<AppStage>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [analyzingLabel, setAnalyzingLabel] = useState('');
  const [analyzingCover, setAnalyzingCover] = useState('');
  const [analyzingTitle, setAnalyzingTitle] = useState('');
  const [seedTrack, setSeedTrack] = useState<Track | null>(null);
  const [candidatePool, setCandidatePool] = useState<Track[]>([]);
  const [matchMode, setMatchMode] = useState<MatchMode>('balanced');
  const [dspProgress, setDspProgress] = useState<DspAnalysisProgress>({
    completed: 0,
    total: 0,
    isAnalyzing: false,
  });
  const [isComparing, setIsComparing] = useState(false);

  // Audio Preview State
  const [activeAudioTrack, setActiveAudioTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('audio');
  const [progressSec, setProgressSec] = useState(0);
  const [previewDurationSec, setPreviewDurationSec] = useState(30);
  const [volume, setVolume] = useState(0.7);

  const analysisNonceRef = useRef(0);
  const dspAbortRef = useRef<AbortController | null>(null);
  const isComparingRef = useRef(false);
  const deferredPoolRef = useRef<Track[] | null>(null);

  useEffect(() => {
    isComparingRef.current = isComparing;
    if (!isComparing && deferredPoolRef.current) {
      setCandidatePool(deferredPoolRef.current);
      deferredPoolRef.current = null;
    }
  }, [isComparing]);

  // Wire unified real-audio + synth-fallback controller
  useEffect(() => {
    audioController.setCallbacks({
      onProgress: (current, duration) => {
        setProgressSec(current);
        setPreviewDurationSec(duration);
      },
      onEnded: () => {
        setIsPlaying(false);
        setProgressSec(0);
      },
      onModeChange: (mode) => {
        setPlaybackMode(mode);
      },
      onErrorFallback: () => {
        setPlaybackMode('synth');
      },
    });

    return () => {
      dspAbortRef.current?.abort();
      audioController.stop();
    };
  }, []);

  const recommendations = useMemo(() => {
    if (!seedTrack || candidatePool.length === 0) return [];
    return rankRecommendations(seedTrack, candidatePool, 55, {
      ignoreLanguageBoost: matchMode === 'sound-only',
    });
  }, [seedTrack, candidatePool, matchMode]);

  const startDspAnalysisForPool = useCallback(
    (initialSeed: Track, pool: Track[], nonce: number) => {
      dspAbortRef.current?.abort();
      const controller = new AbortController();
      dspAbortRef.current = controller;
      deferredPoolRef.current = null;

      let livePool = [...pool];
      let hasMountedResults = false;

      const finishSeedAndPool = async (): Promise<{
        seed: Track;
        poolSnapshot: Track[];
        completed: number;
      }> => {
        const analyzedSeed = await analyzeTrackAudio(initialSeed, controller.signal);
        if (controller.signal.aborted || analysisNonceRef.current !== nonce) {
          return { seed: initialSeed, poolSnapshot: livePool, completed: 0 };
        }

        if (hasMountedResults) {
          setSeedTrack(analyzedSeed);
        }

        let completedCount = 0;
        const poolPromise = analyzePoolAudio(
          pool,
          (updated, completed, total) => {
            if (controller.signal.aborted || analysisNonceRef.current !== nonce) return;
            livePool = updated;
            completedCount = completed;

            if (hasMountedResults) {
              setDspProgress({
                completed,
                total,
                isAnalyzing: completed < total,
              });
              if (completed === total || completed % 10 === 0) {
                if (isComparingRef.current) {
                  deferredPoolRef.current = updated;
                } else {
                  setCandidatePool(updated);
                }
              }
            }
          },
          controller.signal,
          6
        ).then((finalPool) => {
          if (controller.signal.aborted || analysisNonceRef.current !== nonce) return;
          livePool = finalPool;
          if (hasMountedResults) {
            setDspProgress({
              completed: finalPool.length,
              total: finalPool.length,
              isAnalyzing: false,
            });
            if (isComparingRef.current) {
              deferredPoolRef.current = finalPool;
            } else {
              setCandidatePool(finalPool);
            }
          }
        });

        // Give waveform decoding up to ~1100ms during the neural visualizer flight before mounting results
        await Promise.race([
          poolPromise,
          new Promise<void>((resolve) => window.setTimeout(resolve, 1100)),
        ]);

        return { seed: analyzedSeed, poolSnapshot: livePool, completed: completedCount };
      };

      const markMounted = () => {
        hasMountedResults = true;
      };

      return { finishSeedAndPool, markMounted };
    },
    []
  );

  const startAnalysis = useCallback(
    async (query: string, explicitTrack?: Track) => {
      const currentNonce = ++analysisNonceRef.current;
      dspAbortRef.current?.abort();
      deferredPoolRef.current = null;

      const immediateSeed = explicitTrack ?? resolveOrSynthesizeTrack(query);

      setSearchQuery(query);
      setAnalyzingLabel(
        explicitTrack ? `${explicitTrack.title} · ${explicitTrack.artist}` : query
      );
      setAnalyzingCover(immediateSeed.coverArt);
      setAnalyzingTitle(immediateSeed.title);
      setIsComparing(false);
      setStage('analyzing');

      const minDelayPromise = new Promise<void>((resolve) => {
        window.setTimeout(resolve, MIN_CURATION_DURATION_MS);
      });

      const curatePromise = (async (): Promise<{
        seedTrack: Track;
        pool: Track[];
      }> => {
        try {
          const res = await fetch('/api/music/curate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              seedCandidate: explicitTrack,
            }),
          });
          if (!res.ok) throw new Error('Curate request failed');
          const payload = (await res.json()) as {
            seedTrack?: Track;
            recommendations?: Track[];
            candidatePool?: Track[];
          };
          const pool = payload.candidatePool ?? payload.recommendations;
          if (payload.seedTrack && pool && pool.length > 0) {
            if (analysisNonceRef.current === currentNonce && payload.seedTrack.coverArt) {
              setAnalyzingCover(payload.seedTrack.coverArt);
              setAnalyzingTitle(payload.seedTrack.title);
            }
            return {
              seedTrack: payload.seedTrack,
              pool,
            };
          }
        } catch {
          // Fall through cleanly to local catalog
        }

        const fallbackSeed = explicitTrack ?? resolveOrSynthesizeTrack(query);
        return {
          seedTrack: fallbackSeed,
          pool: recommendTracksForSeed(fallbackSeed, 50),
        };
      })();

      const curated = await curatePromise;
      if (analysisNonceRef.current !== currentNonce) return;

      const { finishSeedAndPool, markMounted } = startDspAnalysisForPool(
        curated.seedTrack,
        curated.pool,
        currentNonce
      );

      const [dspSnapshot] = await Promise.all([finishSeedAndPool(), minDelayPromise]);
      if (analysisNonceRef.current !== currentNonce) return;

      markMounted();
      setSeedTrack(dspSnapshot.seed);
      setCandidatePool(dspSnapshot.poolSnapshot);
      const alreadyDone = dspSnapshot.poolSnapshot.filter(
        (t) => t.analysisSource === 'audio-dsp'
      ).length;
      setDspProgress({
        completed: alreadyDone,
        total: dspSnapshot.poolSnapshot.length,
        isAnalyzing: alreadyDone < dspSnapshot.poolSnapshot.length,
      });
      setStage('results');
    },
    [startDspAnalysisForPool]
  );

  const handleResetSearch = useCallback(() => {
    analysisNonceRef.current += 1;
    dspAbortRef.current?.abort();
    deferredPoolRef.current = null;
    audioController.stop();
    setIsPlaying(false);
    setActiveAudioTrack(null);
    setProgressSec(0);
    setIsComparing(false);
    setDspProgress({ completed: 0, total: 0, isAnalyzing: false });
    setStage('search');
  }, []);

  const handleTogglePlayTrack = useCallback(
    (track: Track) => {
      if (activeAudioTrack?.id === track.id) {
        if (isPlaying) {
          audioController.pause();
          setIsPlaying(false);
        } else {
          audioController.resume();
          setIsPlaying(true);
        }
        return;
      }

      setActiveAudioTrack(track);
      setProgressSec(0);
      setPreviewDurationSec(30);
      setIsPlaying(true);
      audioController.setVolume(volume);
      void audioController.play(track);
    },
    [activeAudioTrack, isPlaying, volume]
  );

  const handleTogglePlayerBarPlay = useCallback(() => {
    if (!activeAudioTrack) return;
    if (isPlaying) {
      audioController.pause();
      setIsPlaying(false);
    } else {
      audioController.resume();
      setIsPlaying(true);
    }
  }, [activeAudioTrack, isPlaying]);

  const handleSeek = useCallback((sec: number) => {
    setProgressSec(sec);
    audioController.seek(sec);
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol);
    audioController.setVolume(vol);
  }, []);

  const handleClosePlayer = useCallback(() => {
    audioController.stop();
    setIsPlaying(false);
    setActiveAudioTrack(null);
    setProgressSec(0);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#09090B] text-zinc-50">
      {/* Subtle Ambient Radial Emerald Lighting */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-[-140px] h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-[#1DB954]/[0.09] blur-[140px]" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[420px] w-[520px] rounded-full bg-[#1ED760]/[0.05] blur-[150px]" />
      </div>

      {/* Persistent Minimalist Top Navbar */}
      <TopNavBar onLogoClick={handleResetSearch} showResetHint={stage !== 'search'} />

      {/* Top-Middle Floating Back-to-Top Button on Scroll */}
      <ScrollToTopButton hidden={isComparing} />

      {/* Main Animated 3-State Stage */}
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {stage === 'search' && (
            <HeroSearchView
              initialQuery={searchQuery}
              onAnalyzeTrack={(q, track) => void startAnalysis(q, track)}
            />
          )}

          {stage === 'analyzing' && (
            <NeuralCurationVisualizer
              queryLabel={analyzingLabel}
              coverArt={analyzingCover}
              trackTitle={analyzingTitle}
            />
          )}

          {stage === 'results' && seedTrack && (
            <ResultsDashboard
              seedTrack={seedTrack}
              recommendations={recommendations}
              matchMode={matchMode}
              onMatchModeChange={setMatchMode}
              dspProgress={dspProgress}
              activeTrackId={activeAudioTrack?.id ?? null}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlayTrack}
              onReseedTrack={(track) => void startAnalysis(track.title, track)}
              onResetSearch={handleResetSearch}
              onComparisonChange={setIsComparing}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Persistent Bottom Interactive Audio Mini Player */}
      <AnimatePresence>
        {activeAudioTrack && !isComparing && (
          <MiniAudioPlayer
            track={activeAudioTrack}
            isPlaying={isPlaying}
            playbackMode={playbackMode}
            progressSec={progressSec}
            previewDurationSec={previewDurationSec}
            volume={volume}
            onTogglePlay={handleTogglePlayerBarPlay}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onClose={handleClosePlayer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
