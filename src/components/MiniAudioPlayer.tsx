import { Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { motion } from 'motion/react';
import { PlaybackMode } from '../audio/audioController';
import { formatDuration } from '../data/catalog';
import { Track } from '../types/music';

interface MiniAudioPlayerProps {
  track: Track;
  isPlaying: boolean;
  playbackMode: PlaybackMode;
  progressSec: number;
  previewDurationSec: number;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (sec: number) => void;
  onVolumeChange: (vol: number) => void;
  onClose: () => void;
}

export function MiniAudioPlayer({
  track,
  isPlaying,
  playbackMode,
  progressSec,
  previewDurationSec,
  volume,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onClose,
}: MiniAudioPlayerProps) {
  const safeDuration = Math.max(1, previewDurationSec);
  const progressPct = Math.min(100, Math.max(0, (progressSec / safeDuration) * 100));

  return (
    <motion.aside
      initial={{ y: 88, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 88, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Audio preview player"
      className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 rounded-2xl border border-white/[0.1] bg-[#121212]/95 px-3.5 py-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:bottom-4 sm:w-[calc(100%-2rem)] sm:px-4 sm:py-3"
    >
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        {/* Track Info with Full-Title Hover Tooltip */}
        <div
          className="group/track relative flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3"
          title={`${track.title} — ${track.artist}`}
        >
          <img
            src={track.coverArt}
            alt={`${track.title} cover`}
            referrerPolicy="no-referrer"
            className="h-10 w-10 shrink-0 rounded-lg border border-white/10 object-cover sm:h-11 sm:w-11"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-semibold text-zinc-50 sm:text-sm">
                {track.title}
              </span>
              <span className="hidden sm:inline-block shrink-0 font-mono text-[10px] font-medium text-[#1ED760]">
                {playbackMode === 'audio' ? '30S SONG PREVIEW' : 'SYNTH PREVIEW'}
              </span>
            </div>
            <div className="truncate text-[11px] text-zinc-400 sm:text-xs">
              {track.artist} · <span className="font-mono">{track.features.bpm} BPM</span>
            </div>
          </div>

          {/* Floating Full-Title Tooltip on Hover */}
          <div
            role="tooltip"
            className="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-3 w-max max-w-[min(85vw,380px)] translate-y-1 rounded-xl border border-[#1DB954]/35 bg-[#121212]/96 px-3.5 py-2 opacity-0 shadow-[0_16px_40px_rgba(0,0,0,0.88)] backdrop-blur-xl transition-all duration-150 group-hover/track:visible group-hover/track:translate-y-0 group-hover/track:opacity-100"
          >
            <div className="text-xs font-semibold leading-snug text-zinc-50 break-words">
              {track.title}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-400 break-words">
              {track.artist}
            </div>
          </div>
        </div>

        {/* Center Play/Pause + Scrub Timeline */}
        <div className="flex items-center gap-2 sm:flex-[1.3] sm:flex-col sm:gap-1.5">
          <div className="flex items-center gap-3">
            {/* Reactive Waveform Indicator */}
            <div className="hidden sm:flex h-4 items-end gap-0.5" aria-hidden="true">
              {[0.55, 0.95, 0.7, 1, 0.6].map((h, i) => (
                <motion.span
                  key={i}
                  className="w-0.5 rounded-full bg-[#1DB954]"
                  animate={
                    isPlaying
                      ? { scaleY: [0.35, h, 0.4, 0.9, 0.35] }
                      : { scaleY: 0.25 }
                  }
                  transition={
                    isPlaying
                      ? {
                          duration: 0.75 + i * 0.1,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }
                      : { duration: 0.2 }
                  }
                  style={{ height: '14px', originY: 1 }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause song preview' : 'Play song preview'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1DB954] text-[#09090B] shadow-[0_0_20px_rgba(29,185,84,0.4)] transition-transform duration-150 hover:scale-105 hover:bg-[#1ED760] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 translate-x-0.5 fill-current" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Desktop Scrubber Bar */}
          <div className="hidden w-full max-w-xs items-center gap-2 sm:flex">
            <span className="w-8 text-right font-mono text-[10px] tabular-nums text-zinc-400">
              {formatDuration(progressSec)}
            </span>
            <input
              type="range"
              min={0}
              max={safeDuration}
              step={0.25}
              value={progressSec}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Preview progress"
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#1DB954]"
              style={{
                background: `linear-gradient(to right, #1DB954 ${progressPct}%, rgba(255,255,255,0.14) ${progressPct}%)`,
              }}
            />
            <span className="w-8 font-mono text-[10px] tabular-nums text-zinc-500">
              {formatDuration(safeDuration)}
            </span>
          </div>
        </div>

        {/* Right Volume & Close */}
        <div className="flex items-center justify-end gap-1.5 sm:flex-1 sm:gap-2.5">
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.7)}
              aria-label={volume === 0 ? 'Unmute audio' : 'Mute audio'}
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-[#1DB954]"
            >
              {volume === 0 ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Preview volume"
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/15 accent-[#1DB954]"
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close mini audio player"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-[#1DB954]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Compact Mobile Scrubber Bar */}
      <div className="mt-2 flex items-center gap-2 sm:hidden">
        <span className="w-7 text-right font-mono text-[10px] tabular-nums text-zinc-400">
          {formatDuration(progressSec)}
        </span>
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.25}
          value={progressSec}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Mobile preview progress"
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#1DB954]"
          style={{
            background: `linear-gradient(to right, #1DB954 ${progressPct}%, rgba(255,255,255,0.14) ${progressPct}%)`,
          }}
        />
        <span className="w-7 font-mono text-[10px] tabular-nums text-zinc-500">
          {formatDuration(safeDuration)}
        </span>
      </div>
    </motion.aside>
  );
}
