import { Disc3, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AlbumArtworkProps {
  src: string;
  alt: string;
  title: string;
  accentHex?: string;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  sizeClass?: string;
  alwaysShowPlayOnActive?: boolean;
}

export function AlbumArtwork({
  src,
  alt,
  title,
  accentHex = '#1DB954',
  isPlaying = false,
  onTogglePlay,
  sizeClass = 'w-full aspect-square',
  alwaysShowPlayOnActive = true,
}: AlbumArtworkProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  return (
    <div
      className={`group/art relative overflow-hidden rounded-lg border border-white/[0.08] bg-[#121212] select-none ${sizeClass}`}
    >
      {!imgError ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover/art:scale-105"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center"
          style={{
            background: `radial-gradient(circle at 30% 25%, ${accentHex}28, #121212 72%)`,
          }}
        >
          <Disc3 className="h-8 w-8 text-[#1DB954]/80" aria-hidden="true" />
          <span className="line-clamp-1 text-[11px] font-medium text-zinc-400">
            {title}
          </span>
        </div>
      )}

      {/* Subtle bottom scrim for contrast */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-60 transition-opacity duration-200 group-hover/art:opacity-90"
        aria-hidden="true"
      />

      {/* Active audio equalizer bars in bottom-left */}
      {isPlaying && (
        <div
          className="pointer-events-none absolute bottom-2.5 left-2.5 flex items-end gap-0.5 rounded bg-black/70 px-1.5 py-1 backdrop-blur-sm"
          aria-hidden="true"
        >
          <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-[#1ED760]" />
          <span className="h-3.5 w-0.5 animate-pulse rounded-full bg-[#1ED760] [animation-delay:150ms]" />
          <span className="h-2 w-0.5 animate-pulse rounded-full bg-[#1ED760] [animation-delay:300ms]" />
        </div>
      )}

      {/* Hover-reveal / active Play/Pause button */}
      {onTogglePlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          aria-label={
            isPlaying ? `Pause preview of ${title}` : `Play 30-second preview of ${title}`
          }
          className={`absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954] text-[#09090B] shadow-[0_8px_24px_rgba(29,185,84,0.45)] transition-all duration-200 hover:scale-105 hover:bg-[#1ED760] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-11 sm:w-11 ${
            isPlaying && alwaysShowPlayOnActive
              ? 'translate-y-0 opacity-100'
              : 'translate-y-0 opacity-95 sm:translate-y-2 sm:opacity-0 sm:group-hover/art:translate-y-0 sm:group-hover/art:opacity-100 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100'
          }`}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4 translate-x-0.5 fill-current" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
