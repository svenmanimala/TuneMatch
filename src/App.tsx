import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { audioController, PlaybackMode } from './audio/audioController';
import { HeroSearchView } from './components/HeroSearchView';
import { MiniAudioPlayer } from './components/MiniAudioPlayer';
import { NeuralCurationVisualizer } from './components/NeuralCurationVisualizer';
import { ResultsDashboard } from './components/ResultsDashboard';
import { ScrollToTopButton } from './components/ScrollToTopButton';
import { TopNavBar } from './components/TopNavBar';
import { recommendTracksForSeed, resolveOrSynthesizeTrack } from './data/catalog';
import { AppStage, RecommendedTrack, Track } from './types/music';

const MIN_CURATION_DURATION_MS = 2750;

export default function App() {
  const [stage, setStage] = useState<AppStage>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [analyzingLabel, setAnalyzingLabel] = useState('');
  const [analyzingCover, setAnalyzingCover] = useState('');
  const [analyzingTitle, setAnalyzingTitle] = useState('');
  const [seedTrack, setSeedTrack] = useState<Track | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedTrack[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  // Audio Preview State
  const [activeAudioTrack, setActiveAudioTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('audio');
  const [progressSec, setProgressSec] = useState(0);
  const [previewDurationSec, setPreviewDurationSec] = useState(30);
  const [volume, setVolume] = useState(0.7);

  const analysisNonceRef = useRef(0);

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
      audioController.stop();
    };
  }, []);

  const startAnalysis = useCallback(async (query: string, explicitTrack?: Track) => {
    const currentNonce = ++analysisNonceRef.current;
    const immediateSeed = explicitTrack ?? resolveOrSynthesizeTrack(query);

    setSearchQuery(query);
    setAnalyzingLabel(
      explicitTrack ? `${explicitTrack.title} · ${explicitTrack.artist}` : query
    );
    setAnalyzingCover(immediateSeed.coverArt);
    setAnalyzingTitle(immediateSeed.title);
    setIsComparing(false);
    setStage('analyzing');

    // Run live /api/music/curate concurrently with the 2.75s Neural Visualizer animation
    const minDelayPromise = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MIN_CURATION_DURATION_MS);
    });

    const curatePromise = (async (): Promise<{
      seedTrack: Track;
      recommendations: RecommendedTrack[];
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
          recommendations?: RecommendedTrack[];
        };
        if (payload.seedTrack && payload.recommendations && payload.recommendations.length > 0) {
          if (analysisNonceRef.current === currentNonce && payload.seedTrack.coverArt) {
            setAnalyzingCover(payload.seedTrack.coverArt);
            setAnalyzingTitle(payload.seedTrack.title);
          }
          return {
            seedTrack: payload.seedTrack,
            recommendations: payload.recommendations,
          };
        }
      } catch {
        // Fall through cleanly to expanded local catalog
      }

      const fallbackSeed = explicitTrack ?? resolveOrSynthesizeTrack(query);
      return {
        seedTrack: fallbackSeed,
        recommendations: recommendTracksForSeed(fallbackSeed, 50),
      };
    })();

    const [curated] = await Promise.all([curatePromise, minDelayPromise]);

    // Abort if user reset or started a newer search during animation
    if (analysisNonceRef.current !== currentNonce) return;

    setSeedTrack(curated.seedTrack);
    setRecommendations(curated.recommendations);
    setStage('results');
  }, []);

  const handleResetSearch = useCallback(() => {
    analysisNonceRef.current += 1;
    audioController.stop();
    setIsPlaying(false);
    setActiveAudioTrack(null);
    setProgressSec(0);
    setIsComparing(false);
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
