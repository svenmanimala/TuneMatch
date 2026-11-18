import { ArrowLeftRight, ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { TIMBRE_BAND_LABELS } from '../audio/acousticDsp';
import { AUDIO_TRAITS_META } from '../data/catalog';
import { normalizeFeatureVector } from '../shared/dnaMath';
import { RecommendedTrack, Track, TraitKey } from '../types/music';

interface VectorComparisonModalProps {
  seedTrack: Track;
  selectedNeighbor: RecommendedTrack;
  allNeighbors: RecommendedTrack[];
  activeTrackId: string | null;
  isPlaying: boolean;
  onSelectNeighbor: (neighbor: RecommendedTrack) => void;
  onTogglePlay: (track: Track) => void;
  onReseedTrack: (track: Track) => void;
  onClose: () => void;
}

const RADAR_WIDTH = 440;
const RADAR_HEIGHT = 310;
const CENTER_X = RADAR_WIDTH / 2;
const CENTER_Y = 158;
const MAX_RADIUS = 94;

function getRawDisplay(track: Track, key: TraitKey): string {
  const f = track.features;
  switch (key) {
    case 'tempo':
      return `${f.bpm} BPM`;
    case 'energy':
      return f.energy.toFixed(2);
    case 'danceability':
      return f.danceability.toFixed(2);
    case 'valence':
      return f.valence.toFixed(2);
    case 'acousticness':
      return f.acousticness.toFixed(2);
    case 'instrumentalness':
      return f.instrumentalness.toFixed(2);
    case 'speechiness':
      return f.speechiness.toFixed(2);
  }
}

function getDeltaDisplay(seed: Track, neighbor: Track, key: TraitKey, normA: number, normB: number): string {
  if (key === 'tempo') {
    const diff = neighbor.features.bpm - seed.features.bpm;
    return `${diff >= 0 ? '+' : ''}${diff} BPM`;
  }
  const diff = normB - normA;
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`;
}

function buildPolygonPoints(values: number[]): string {
  return values
    .map((val, idx) => {
      const angle = -Math.PI / 2 + (idx * Math.PI * 2) / values.length;
      const r = Math.max(0.06, Math.min(1, val)) * MAX_RADIUS;
      const x = CENTER_X + Math.cos(angle) * r;
      const y = CENTER_Y + Math.sin(angle) * r;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function VectorComparisonModal({
  seedTrack,
  selectedNeighbor,
  allNeighbors,
  activeTrackId,
  isPlaying,
  onSelectNeighbor,
  onTogglePlay,
  onReseedTrack,
  onClose,
}: VectorComparisonModalProps) {
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        const cur = allNeighbors.findIndex((n) => n.id === selectedNeighbor.id);
        if (cur >= 0) {
          onSelectNeighbor(allNeighbors[(cur + 1) % allNeighbors.length]);
        }
      } else if (e.key === 'ArrowLeft') {
        const cur = allNeighbors.findIndex((n) => n.id === selectedNeighbor.id);
        if (cur >= 0) {
          onSelectNeighbor(
            allNeighbors[(cur - 1 + allNeighbors.length) % allNeighbors.length]
          );
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allNeighbors, selectedNeighbor.id, onSelectNeighbor, onClose]);

  const seedVector = useMemo(
    () => normalizeFeatureVector(seedTrack.features),
    [seedTrack.features]
  );
  const neighborVector = useMemo(
    () => normalizeFeatureVector(selectedNeighbor.features),
    [selectedNeighbor.features]
  );

  const seedPoints = useMemo(() => buildPolygonPoints(seedVector), [seedVector]);
  const neighborPoints = useMemo(
    () => buildPolygonPoints(neighborVector),
    [neighborVector]
  );

  const currentIdx = allNeighbors.findIndex((n) => n.id === selectedNeighbor.id);
  const handlePrev = () => {
    if (allNeighbors.length === 0) return;
    const prevIdx = (currentIdx - 1 + allNeighbors.length) % allNeighbors.length;
    onSelectNeighbor(allNeighbors[prevIdx]);
  };
  const handleNext = () => {
    if (allNeighbors.length === 0) return;
    const nextIdx = (currentIdx + 1) % allNeighbors.length;
    onSelectNeighbor(allNeighbors[nextIdx]);
  };

  const seedPlaying = activeTrackId === seedTrack.id && isPlaying;
  const neighborPlaying = activeTrackId === selectedNeighbor.id && isPlaying;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`7D vector comparison between ${seedTrack.title} and ${selectedNeighbor.title}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#121212] p-4 shadow-[0_32px_90px_rgba(0,0,0,0.9)] sm:p-6"
      >
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[11px] font-medium tracking-wider text-[#1ED760] uppercase">
                Acoustic Vector &amp; Timbre Comparison
              </span>
              <span aria-hidden="true" className="text-zinc-600">
                ·
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums text-[#1ED760]">
                {selectedNeighbor.similarityPct.toFixed(1)}% Overall Match
              </span>
              {selectedNeighbor.timbreSimilarityPct !== undefined && (
                <>
                  <span aria-hidden="true" className="text-zinc-600">
                    ·
                  </span>
                  <span className="font-mono text-xs font-medium tabular-nums text-zinc-300">
                    {selectedNeighbor.timbreSimilarityPct.toFixed(1)}% Timbre Spectrum
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-zinc-600">
                ·
              </span>
              <span className="text-xs text-zinc-400">
                Strongest overlap: {selectedNeighbor.dominantTraitMatch}
              </span>
            </div>

            <h3 className="mt-1.5 text-xl font-bold tracking-tight text-zinc-50">
              {seedTrack.title} <span className="text-zinc-500 font-normal">vs.</span>{' '}
              {selectedNeighbor.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#18181B] text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-[#1DB954]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* A/B Track Lockups with Direct Play Controls */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Seed Track Card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1DB954]/30 bg-[#18181B]/80 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={seedTrack.coverArt}
                alt={seedTrack.title}
                referrerPolicy="no-referrer"
                className="h-11 w-11 shrink-0 rounded-lg border border-white/10 object-cover"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#1ED760]" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#1ED760]">
                    Initial Seed
                  </span>
                </div>
                <div className="truncate text-sm font-semibold text-zinc-50">
                  {seedTrack.title}
                </div>
                <div className="truncate text-xs text-zinc-400">
                  {seedTrack.artist} · {seedTrack.language ?? 'English'} ·{' '}
                  {seedTrack.analysisSource === 'audio-dsp' ? 'Audio Waveform' : 'Metadata Est.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onTogglePlay(seedTrack)}
              aria-label={seedPlaying ? `Pause ${seedTrack.title}` : `Play ${seedTrack.title}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1DB954] text-[#09090B] transition-transform hover:scale-105 hover:bg-[#1ED760]"
            >
              {seedPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 translate-x-0.5 fill-current" />
              )}
            </button>
          </div>

          {/* Neighbor Track Card */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#38BDF8]/35 bg-[#18181B]/80 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={selectedNeighbor.coverArt}
                alt={selectedNeighbor.title}
                referrerPolicy="no-referrer"
                className="h-11 w-11 shrink-0 rounded-lg border border-white/10 object-cover"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#38BDF8]" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#38BDF8]">
                    Selected Neighbor #{currentIdx + 1}
                  </span>
                </div>
                <div className="truncate text-sm font-semibold text-zinc-50">
                  {selectedNeighbor.title}
                </div>
                <div className="truncate text-xs text-zinc-400">
                  {selectedNeighbor.artist} · {selectedNeighbor.language ?? 'English'} ·{' '}
                  {selectedNeighbor.analysisSource === 'audio-dsp'
                    ? 'Audio Waveform'
                    : 'Metadata Est.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onTogglePlay(selectedNeighbor)}
              aria-label={
                neighborPlaying
                  ? `Pause ${selectedNeighbor.title}`
                  : `Play ${selectedNeighbor.title}`
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#38BDF8] text-[#09090B] transition-transform hover:scale-105 hover:bg-[#7DD3FC]"
            >
              {neighborPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 translate-x-0.5 fill-current" />
              )}
            </button>
          </div>
        </div>

        {/* Main Split: 7-Axis Spider Radar Chart + Vector Coordinate Table */}
        <div className="mt-5 grid grid-cols-1 items-center gap-6 lg:grid-cols-[400px_1fr]">
          {/* 7-Axis Radar SVG */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-[#09090B]/80 p-3">
            <svg
              viewBox={`0 0 ${RADAR_WIDTH} ${RADAR_HEIGHT}`}
              className="h-auto w-full max-w-[380px]"
              role="img"
              aria-label="7-axis acoustic radar chart"
            >
              {/* Concentric Heptagonal Grid Rings (25%, 50%, 75%, 100%) */}
              {[0.25, 0.5, 0.75, 1].map((level) => {
                const ringPts = Array.from({ length: 7 }, (_, idx) => {
                  const angle = -Math.PI / 2 + (idx * Math.PI * 2) / 7;
                  const r = level * MAX_RADIUS;
                  return `${(CENTER_X + Math.cos(angle) * r).toFixed(1)},${(
                    CENTER_Y +
                    Math.sin(angle) * r
                  ).toFixed(1)}`;
                }).join(' ');
                return (
                  <polygon
                    key={level}
                    points={ringPts}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Radial Axis Spokes & Full-Word Labels */}
              {AUDIO_TRAITS_META.map((trait, idx) => {
                const angle = -Math.PI / 2 + (idx * Math.PI * 2) / 7;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                const x2 = CENTER_X + cosA * MAX_RADIUS;
                const y2 = CENTER_Y + sinA * MAX_RADIUS;
                const labelX = CENTER_X + cosA * (MAX_RADIUS + 14);
                const labelY = CENTER_Y + sinA * (MAX_RADIUS + 16);
                const textAnchor =
                  cosA > 0.22 ? 'start' : cosA < -0.22 ? 'end' : 'middle';
                const dyOffset = sinA > 0.5 ? 8 : sinA < -0.5 ? -4 : 3;
                const isActive = highlightedIdx === idx;

                return (
                  <g key={trait.key}>
                    <line
                      x1={CENTER_X}
                      y1={CENTER_Y}
                      x2={x2}
                      y2={y2}
                      stroke={
                        isActive ? 'rgba(30,215,96,0.5)' : 'rgba(255,255,255,0.08)'
                      }
                      strokeWidth={isActive ? '1.5' : '1'}
                    />
                    <text
                      x={labelX}
                      y={labelY + dyOffset}
                      textAnchor={textAnchor}
                      className={`text-[11px] font-medium transition-colors ${
                        isActive ? 'fill-[#1ED760]' : 'fill-zinc-300'
                      }`}
                    >
                      {trait.label}
                    </text>
                  </g>
                );
              })}

              {/* Seed Track Polygon (Emerald) */}
              <motion.polygon
                animate={{ points: seedPoints }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                fill="rgba(29, 185, 84, 0.2)"
                stroke="#1ED760"
                strokeWidth="2"
                strokeLinejoin="round"
              />

              {/* Selected Neighbor Polygon (Laser Cyan) */}
              <motion.polygon
                animate={{ points: neighborPoints }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                fill="rgba(56, 189, 248, 0.16)"
                stroke="#38BDF8"
                strokeWidth="2"
                strokeLinejoin="round"
              />

              {/* Vertex Dots */}
              {seedVector.map((val, idx) => {
                const angle = -Math.PI / 2 + (idx * Math.PI * 2) / 7;
                const rA = Math.max(0.06, val) * MAX_RADIUS;
                const rB = Math.max(0.06, neighborVector[idx]) * MAX_RADIUS;
                return (
                  <g key={`dots-${idx}`}>
                    <circle
                      cx={CENTER_X + Math.cos(angle) * rA}
                      cy={CENTER_Y + Math.sin(angle) * rA}
                      r={highlightedIdx === idx ? 4.5 : 3}
                      fill="#1ED760"
                    />
                    <circle
                      cx={CENTER_X + Math.cos(angle) * rB}
                      cy={CENTER_Y + Math.sin(angle) * rB}
                      r={highlightedIdx === idx ? 4.5 : 3}
                      fill="#38BDF8"
                    />
                  </g>
                );
              })}
            </svg>

            {/* 12-Band Spectral Timbre Fingerprint Comparison */}
            {seedTrack.dsp && selectedNeighbor.dsp && (
              <div className="mt-2 w-full border-t border-white/[0.07] pt-3">
                <div className="mb-2 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>12-Band Frequency Timbre</span>
                  <span className="tabular-nums text-zinc-300">
                    {seedTrack.dsp.spectralCentroidHz} Hz vs {selectedNeighbor.dsp.spectralCentroidHz} Hz
                  </span>
                </div>
                <div className="grid h-16 grid-cols-12 items-end gap-1">
                  {TIMBRE_BAND_LABELS.map((bandLabel, bIdx) => {
                    const seedVal = seedTrack.dsp?.timbreBands[bIdx] ?? 0;
                    const neighVal = selectedNeighbor.dsp?.timbreBands[bIdx] ?? 0;
                    const maxBand = Math.max(
                      ...(seedTrack.dsp?.timbreBands ?? [0.5]),
                      ...(selectedNeighbor.dsp?.timbreBands ?? [0.5]),
                      0.1
                    );
                    const seedH = Math.max(8, Math.round((seedVal / maxBand) * 100));
                    const neighH = Math.max(8, Math.round((neighVal / maxBand) * 100));
                    return (
                      <div
                        key={bandLabel}
                        title={`${bandLabel}: Seed ${(seedVal * 100).toFixed(0)}% / Neighbor ${(neighVal * 100).toFixed(0)}%`}
                        className="flex h-full items-end justify-center gap-0.5"
                      >
                        <div
                          className="w-1.5 rounded-t bg-[#1ED760]/85 transition-all duration-300"
                          style={{ height: `${seedH}%` }}
                        />
                        <div
                          className="w-1.5 rounded-t bg-[#38BDF8]/85 transition-all duration-300"
                          style={{ height: `${neighH}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between font-mono text-[9px] text-zinc-500">
                  <span>40 Hz Sub</span>
                  <span>Vocal Mid</span>
                  <span>16 kHz Air</span>
                </div>
              </div>
            )}
          </div>

          {/* 7-Dimension Side-by-Side Vector Delta List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1 text-[11px] font-mono text-zinc-500 uppercase">
              <span>Acoustic Dimension</span>
              <span>Seed vs. Neighbor (Δ)</span>
            </div>

            {AUDIO_TRAITS_META.map((trait, idx) => {
              const normA = seedVector[idx];
              const normB = neighborVector[idx];
              const rawA = getRawDisplay(seedTrack, trait.key);
              const rawB = getRawDisplay(selectedNeighbor, trait.key);
              const delta = getDeltaDisplay(
                seedTrack,
                selectedNeighbor,
                trait.key,
                normA,
                normB
              );

              return (
                <div
                  key={trait.key}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  onMouseLeave={() => setHighlightedIdx(null)}
                  className={`rounded-lg border px-3 py-2 transition-colors ${
                    highlightedIdx === idx
                      ? 'border-white/20 bg-white/[0.04]'
                      : 'border-white/[0.06] bg-[#18181B]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-zinc-200">{trait.label}</span>
                    <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span className="text-[#1ED760]">{rawA}</span>
                      <span className="text-zinc-600">/</span>
                      <span className="text-[#38BDF8]">{rawB}</span>
                      <span className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-300">
                        {delta}
                      </span>
                    </div>
                  </div>

                  {/* Dual Overlaid Comparison Bars */}
                  <div className="mt-1.5 space-y-1">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-[#1ED760] transition-all duration-300"
                        style={{ width: `${Math.max(4, normA * 100)}%` }}
                      />
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-[#38BDF8] transition-all duration-300"
                        style={{ width: `${Math.max(4, normB * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Neighbor Stepper & Pivot Action */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#18181B] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Prev Match</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#18181B] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
            >
              <span>Next Match</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onReseedTrack(selectedNeighbor);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1DB954] px-4 py-2 text-xs font-semibold text-[#09090B] transition-colors hover:bg-[#1ED760]"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Analyze {selectedNeighbor.title} as Seed</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
