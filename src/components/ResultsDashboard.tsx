import { ArrowLeft, AudioLines, ChevronDown, ChevronUp, Radar, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { AUDIO_TRAITS_META } from '../data/catalog';
import { RecommendedTrack, Track, TraitKey } from '../types/music';
import { AlbumArtwork } from './AlbumArtwork';
import { VectorComparisonModal } from './VectorComparisonModal';

interface ResultsDashboardProps {
  seedTrack: Track;
  recommendations: RecommendedTrack[];
  activeTrackId: string | null;
  isPlaying: boolean;
  onTogglePlay: (track: Track) => void;
  onReseedTrack: (track: Track) => void;
  onResetSearch: () => void;
  onComparisonChange?: (isOpen: boolean) => void;
}

interface HoveredTraitState {
  key: TraitKey;
  x: number;
  y: number;
}

function getTraitDisplay(track: Track, key: TraitKey): { valueText: string; ratio: number } {
  const f = track.features;
  switch (key) {
    case 'tempo':
      return {
        valueText: `${f.bpm} BPM`,
        ratio: Math.min(1, Math.max(0.08, (f.bpm - 60) / 130)),
      };
    case 'energy':
      return { valueText: f.energy.toFixed(2), ratio: Math.max(0.04, f.energy) };
    case 'danceability':
      return { valueText: f.danceability.toFixed(2), ratio: Math.max(0.04, f.danceability) };
    case 'valence':
      return { valueText: f.valence.toFixed(2), ratio: Math.max(0.04, f.valence) };
    case 'acousticness':
      return { valueText: f.acousticness.toFixed(2), ratio: Math.max(0.04, f.acousticness) };
    case 'instrumentalness':
      return {
        valueText: f.instrumentalness.toFixed(2),
        ratio: Math.max(0.04, f.instrumentalness),
      };
    case 'speechiness':
      return { valueText: f.speechiness.toFixed(2), ratio: Math.max(0.04, f.speechiness) };
  }
}

function getSongTraitInsight(track: Track, key: TraitKey): string {
  const f = track.features;
  const title = track.title;
  switch (key) {
    case 'tempo': {
      const pace =
        f.bpm >= 145
          ? 'high-velocity driving pulse'
          : f.bpm >= 115
            ? 'upbeat mid-to-fast groove'
            : f.bpm >= 92
              ? 'steady mid-tempo sway'
              : 'relaxed downtempo pacing';
      return `${title} locks in at ${f.bpm} BPM (${pace}), anchoring its rhythmic alignment within ${track.clusterLabel}.`;
    }
    case 'energy': {
      const level =
        f.energy >= 0.75
          ? 'high perceptual loudness, dense layering, and bright transient punch'
          : f.energy >= 0.5
            ? 'balanced dynamic drive without harsh saturation'
            : 'intimate, restrained headroom with softer transients';
      return `At ${f.energy.toFixed(2)}, ${title} carries ${level} across its ${track.genre} arrangement.`;
    }
    case 'danceability': {
      const groove =
        f.danceability >= 0.7
          ? 'strong beat regularity and locked-in rhythmic bounce'
          : f.danceability >= 0.5
            ? 'steady, accessible pulse suited for fluid movement'
            : 'free-flowing or atmospheric phrasing over strict club percussion';
      return `A ${f.danceability.toFixed(2)} score reflects ${groove} throughout ${title}.`;
    }
    case 'valence': {
      const mood =
        f.valence >= 0.65
          ? 'bright, euphoric harmonic lift'
          : f.valence >= 0.4
            ? 'bittersweet tension balancing warmth and nocturnal mood'
            : 'moody, introspective minor-key atmosphere';
      return `Valence ${f.valence.toFixed(2)} gives ${title} a ${mood}.`;
    }
    case 'acousticness': {
      const timbre =
        f.acousticness >= 0.5
          ? 'predominantly organic, unamplified acoustic resonance'
          : f.acousticness >= 0.2
            ? 'hybrid blend of live instrumentation and studio processing'
            : 'sleek electronic synthesis and sculpted studio production';
      return `Measured at ${f.acousticness.toFixed(2)}, ${title} leans toward ${timbre}.`;
    }
    case 'instrumentalness': {
      const balance =
        f.instrumentalness >= 0.5
          ? 'expansive instrumental passages taking lead over vocals'
          : f.instrumentalness >= 0.12
            ? 'prominent synth/instrumental hooks weaving around lead vocals'
            : 'vocal-led storytelling with instrumentation in support';
      return `Score ${f.instrumentalness.toFixed(2)} indicates ${balance} in ${title}.`;
    }
    case 'speechiness': {
      const cadence =
        f.speechiness >= 0.2
          ? 'rhythmic spoken cadence and dense lyrical delivery'
          : f.speechiness >= 0.08
            ? 'conversational vocal phrasing alongside melodic hooks'
            : 'purely sung melodic lines with minimal spoken-word texture';
      return `At ${f.speechiness.toFixed(2)}, ${title} features ${cadence}.`;
    }
  }
}

interface GridConfig {
  cols: number;
  initialRows: number;
  stepRows: number;
}

function getGridConfigForViewport(): GridConfig {
  if (typeof window === 'undefined') {
    return { cols: 5, initialRows: 5, stepRows: 3 };
  }
  const w = window.innerWidth;
  if (w >= 1024) {
    return { cols: 5, initialRows: 5, stepRows: 3 }; // 5x5 = 25 initial, +15 per click
  }
  if (w >= 768) {
    return { cols: 3, initialRows: 4, stepRows: 3 }; // 3x4 = 12 initial, +9 per click
  }
  if (w >= 480) {
    return { cols: 2, initialRows: 4, stepRows: 3 }; // 2x4 = 8 initial, +6 per click
  }
  return { cols: 1, initialRows: 6, stepRows: 6 }; // 1x6 = 6 initial, +6 per click
}

export function ResultsDashboard({
  seedTrack,
  recommendations,
  activeTrackId,
  isPlaying,
  onTogglePlay,
  onReseedTrack,
  onResetSearch,
  onComparisonChange,
}: ResultsDashboardProps) {
  const [hoveredTrait, setHoveredTrait] = useState<HoveredTraitState | null>(null);
  const [selectedNeighbor, setSelectedNeighbor] = useState<RecommendedTrack | null>(null);
  const [gridConfig, setGridConfig] = useState<GridConfig>(() => getGridConfigForViewport());
  const [extraRows, setExtraRows] = useState(0);
  const seedIsPlaying = activeTrackId === seedTrack.id && isPlaying;

  useEffect(() => {
    const handleResize = () => {
      setGridConfig(getGridConfigForViewport());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setExtraRows(0);
    setSelectedNeighbor(null);
  }, [seedTrack.id]);

  useEffect(() => {
    onComparisonChange?.(Boolean(selectedNeighbor));
    return () => {
      onComparisonChange?.(false);
    };
  }, [selectedNeighbor, onComparisonChange]);

  const maxFullCount =
    Math.floor(recommendations.length / gridConfig.cols) * gridConfig.cols ||
    recommendations.length;
  const initialCount = Math.min(gridConfig.cols * gridConfig.initialRows, maxFullCount);
  const targetCount = gridConfig.cols * (gridConfig.initialRows + extraRows);
  const visibleCount = Math.min(targetCount, maxFullCount);
  const visibleRecommendations = recommendations.slice(0, visibleCount);
  const remainingCount = Math.max(0, maxFullCount - visibleCount);
  const nextBatchSize = Math.min(gridConfig.cols * gridConfig.stepRows, remainingCount);
  const hasMore = remainingCount > 0;
  const isExpanded = visibleCount > initialCount;

  const languageSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const track of visibleRecommendations) {
      const lang = track.language ?? 'English';
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([lang, count]) => `${lang} (${count})`)
      .join(', ');
  }, [visibleRecommendations]);

  const hoveredMeta = hoveredTrait
    ? AUDIO_TRAITS_META.find((t) => t.key === hoveredTrait.key)
    : null;
  const hoveredDisplay = hoveredTrait
    ? getTraitDisplay(seedTrack, hoveredTrait.key)
    : null;

  const tooltipLeft =
    hoveredTrait && typeof window !== 'undefined'
      ? Math.min(Math.max(16, hoveredTrait.x - 150), window.innerWidth - 320)
      : 0;
  const tooltipTop =
    hoveredTrait && typeof window !== 'undefined'
      ? Math.min(hoveredTrait.y + 18, window.innerHeight - 175)
      : 0;

  return (
    <motion.section
      key="results-dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: 12, transition: { duration: 0.22 } }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-7xl px-4 pb-32 pt-6 sm:px-6 sm:pb-28 sm:pt-8"
    >
      {/* Top Action Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wider text-[#1ED760] uppercase font-mono">
            Acoustic Vector Analysis
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            Curated Sonic Matches
          </h2>
        </div>

        <button
          type="button"
          onClick={onResetSearch}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-[#18181B] px-4 py-2.5 text-xs font-semibold text-zinc-200 transition-all duration-150 hover:border-[#1DB954]/50 hover:bg-[#18181B]/80 hover:text-white active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954]"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[#1ED760]" aria-hidden="true" />
          <span>Search Another Track</span>
        </button>
      </div>

      {/* Pinned Seed Track Card + 7-Trait DNA Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#18181B]/95 p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)]"
      >
        {/* Subtle top-right emerald aura */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#1DB954]/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Seed Identity */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <AlbumArtwork
              src={seedTrack.coverArt}
              alt={`${seedTrack.title} album art`}
              title={seedTrack.title}
              accentHex={seedTrack.accentHex}
              isPlaying={seedIsPlaying}
              onTogglePlay={() => onTogglePlay(seedTrack)}
              sizeClass="h-28 w-28 sm:h-32 sm:w-32 shrink-0"
            />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1DB954]/35 bg-[#1DB954]/12 px-3 py-1 font-mono text-xs font-medium text-[#1ED760] whitespace-nowrap">
                  <AudioLines className="h-3.5 w-3.5" aria-hidden="true" />
                  Cluster #{seedTrack.clusterId} · {seedTrack.clusterLabel}
                </span>
                {seedTrack.isSynthesized && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400">
                    <Sparkles className="h-3 w-3 text-[#1ED760]" aria-hidden="true" />
                    Synthesized 7D Profile
                  </span>
                )}
              </div>

              <h3 className="mt-2.5 truncate text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
                {seedTrack.title}
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                <span className="font-medium text-zinc-200">{seedTrack.artist}</span>
                <span aria-hidden="true">·</span>
                <span>{seedTrack.album}</span>
                <span aria-hidden="true">·</span>
                <span>{seedTrack.genre}</span>
                <span aria-hidden="true">·</span>
                <span className="text-zinc-300">
                  Language: {seedTrack.language ?? 'English'}
                </span>
              </div>
            </div>
          </div>

          {/* Seed Key Telemetry Summary */}
          <div className="flex items-center gap-6 border-t border-white/[0.06] pt-4 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0 shrink-0">
            <div>
              <div className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                Tempo
              </div>
              <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-zinc-50">
                {seedTrack.features.bpm}
                <span className="ml-1 text-xs font-normal text-zinc-400">BPM</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                Energy
              </div>
              <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-[#1ED760]">
                {seedTrack.features.energy.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                Valence
              </div>
              <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-zinc-50">
                {seedTrack.features.valence.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal 7-Trait Audio DNA Breakdown (Non-clickable, hover for cursor-following details) */}
        <div className="relative mt-7 border-t border-white/[0.07] pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-zinc-300">
              7-Trait Audio DNA Breakdown
            </span>
            <span className="text-xs text-zinc-500">
              Hover any trait to inspect acoustic details for {seedTrack.title}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {AUDIO_TRAITS_META.map((trait, idx) => {
              const { valueText, ratio } = getTraitDisplay(seedTrack, trait.key);
              const isHovered = hoveredTrait?.key === trait.key;
              return (
                <div
                  key={trait.key}
                  onMouseEnter={(e) =>
                    setHoveredTrait({ key: trait.key, x: e.clientX, y: e.clientY })
                  }
                  onMouseMove={(e) =>
                    setHoveredTrait({ key: trait.key, x: e.clientX, y: e.clientY })
                  }
                  onMouseLeave={() => setHoveredTrait(null)}
                  className={`flex cursor-default flex-col justify-between rounded-xl border px-3 py-2.5 text-left transition-all duration-150 select-none ${
                    isHovered
                      ? 'border-[#1DB954]/55 bg-[#1DB954]/[0.08]'
                      : 'border-white/[0.06] bg-[#121212]/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[11px] font-medium truncate transition-colors ${
                        isHovered ? 'text-zinc-100' : 'text-zinc-400'
                      }`}
                    >
                      {trait.label}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {trait.shortLabel}
                    </span>
                  </div>

                  <div className="mt-2 font-mono text-sm font-semibold tabular-nums text-zinc-100">
                    {valueText}
                  </div>

                  {/* Animated GPU-composited progress bar */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: ratio }}
                      transition={{
                        duration: 0.65,
                        delay: 0.1 + idx * 0.04,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#1DB954] to-[#1ED760]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Cursor-Following Floating Trait Tooltip */}
      {hoveredTrait && hoveredMeta && hoveredDisplay && (
        <div
          role="tooltip"
          style={{
            left: `${tooltipLeft}px`,
            top: `${tooltipTop}px`,
          }}
          className="pointer-events-none fixed z-50 w-[300px] rounded-xl border border-[#1DB954]/35 bg-[#121212]/96 p-3.5 shadow-[0_20px_45px_rgba(0,0,0,0.85)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2">
            <span className="text-xs font-semibold text-zinc-50">
              {hoveredMeta.label}
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-[#1ED760]">
              {hoveredDisplay.valueText}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
            {hoveredMeta.description}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">
            {getSongTraitInsight(seedTrack, hoveredTrait.key)}
          </p>
        </div>
      )}

      {/* Recommended Tracks Grid (5x5 = 25 on Desktop, 3x4 = 12 on Tablet, always full rows) */}
      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h3 className="text-base font-semibold text-zinc-100">
                Nearest Cosine Neighbors
              </h3>
              <span className="text-xs text-zinc-500">
                Click any match to compare 7D vectors
              </span>
            </div>
            {languageSummary && (
              <p className="mt-1 text-xs text-zinc-400">
                <span className="text-zinc-500">Languages in results:</span>{' '}
                <span className="font-medium text-zinc-300">{languageSummary}</span>
              </p>
            )}
          </div>
          <span className="font-mono text-xs text-zinc-500 tabular-nums">
            Showing {visibleRecommendations.length} of {maxFullCount} matched tracks
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {visibleRecommendations.map((track, idx) => {
            const trackPlaying = activeTrackId === track.id && isPlaying;
            const batchSize = gridConfig.cols * gridConfig.stepRows;
            const staggerIdx = idx < initialCount ? Math.min(idx, 12) : idx % batchSize;
            return (
              <motion.article
                key={track.id}
                onClick={() => setSelectedNeighbor(track)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedNeighbor(track);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Compare ${track.title} by ${track.artist} with ${seedTrack.title}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.36,
                  delay: staggerIdx * 0.03,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`group flex cursor-pointer flex-col justify-between rounded-2xl border bg-[#18181B]/90 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#18181B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954] ${
                  trackPlaying
                    ? 'border-[#1DB954]/55 shadow-[0_0_32px_-8px_rgba(29,185,84,0.3)]'
                    : 'border-white/[0.08] hover:border-[#1DB954]/40'
                }`}
              >
                <div>
                  {/* Cover Art + Floating Match Badge */}
                  <div className="relative">
                    <AlbumArtwork
                      src={track.coverArt}
                      alt={`${track.title} by ${track.artist}`}
                      title={track.title}
                      accentHex={track.accentHex}
                      isPlaying={trackPlaying}
                      onTogglePlay={() => onTogglePlay(track)}
                    />

                    {/* Prominent Glowing Green Cosine Match Badge */}
                    <div className="pointer-events-none absolute left-2 top-2 inline-flex items-center rounded-full border border-[#1ED760]/45 bg-[#09090B]/85 px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#1ED760] shadow-[0_0_18px_rgba(29,185,84,0.35)] backdrop-blur-md">
                      {track.similarityPct.toFixed(1)}% Match
                    </div>
                  </div>

                  {/* Track Title, Artist & Genre */}
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="truncate text-sm font-semibold text-zinc-50">
                        {track.title}
                      </h4>
                      <Radar
                        className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition-colors group-hover:text-[#1ED760]"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-0.5 truncate text-xs font-medium text-zinc-300">
                      {track.artist}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
                      <span className="truncate">{track.genre}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0 text-zinc-300">
                        {track.language ?? 'English'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Monospace Telemetry + Pivot Action */}
                <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                  <span className="font-mono text-[10.5px] tabular-nums text-zinc-400 truncate">
                    {track.features.bpm} BPM · NRG {track.features.energy.toFixed(2)}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReseedTrack(track);
                    }}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-[#1ED760] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954]"
                    title={`Analyze ${track.title} as the new seed track`}
                  >
                    Use Seed
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* Show More / Show Less Controls */}
        {(hasMore || isExpanded) && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {hasMore && (
              <button
                type="button"
                onClick={() => setExtraRows((prev) => prev + gridConfig.stepRows)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#1DB954]/45 bg-[#1DB954]/12 px-5 py-2.5 text-xs font-semibold text-[#1ED760] shadow-[0_0_24px_rgba(29,185,84,0.18)] transition-all duration-150 hover:border-[#1ED760] hover:bg-[#1DB954]/20 hover:text-white active:scale-[0.98] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954]"
              >
                <span>Show More Tracks</span>
                <span className="font-mono text-[11px] tabular-nums opacity-90">
                  +{nextBatchSize}
                </span>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            {isExpanded && (
              <button
                type="button"
                onClick={() => setExtraRows(0)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#18181B] px-4 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-white whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954]"
              >
                <span>Show Fewer</span>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 7D Radar & Vector Comparison Modal */}
      <AnimatePresence>
        {selectedNeighbor && (
          <VectorComparisonModal
            seedTrack={seedTrack}
            selectedNeighbor={selectedNeighbor}
            allNeighbors={recommendations}
            activeTrackId={activeTrackId}
            isPlaying={isPlaying}
            onSelectNeighbor={setSelectedNeighbor}
            onTogglePlay={onTogglePlay}
            onReseedTrack={onReseedTrack}
            onClose={() => setSelectedNeighbor(null)}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
