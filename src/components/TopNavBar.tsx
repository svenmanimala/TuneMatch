import { AudioWaveform } from 'lucide-react';
import { motion } from 'motion/react';

interface TopNavBarProps {
  onLogoClick: () => void;
  showResetHint: boolean;
}

export function TopNavBar({ onLogoClick, showResetHint }: TopNavBarProps) {
  return (
    <header className="relative z-30 w-full border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:gap-8 sm:px-6">
        {/* Brand Zone */}
        <button
          type="button"
          onClick={onLogoClick}
          className="group flex items-center gap-2.5 rounded-lg py-1 pr-2 text-left transition-opacity sm:gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1DB954]"
          aria-label="TuneMatch Home"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1DB954]/30 bg-[#1DB954]/10 shadow-[0_0_20px_rgba(29,185,84,0.22)] transition-transform duration-200 group-hover:scale-105 sm:h-9 sm:w-9">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4 text-[#1ED760] sm:h-5 sm:w-5"
              aria-hidden="true"
            >
              <motion.path
                d="M3 12h2.5l2-5.5L10.5 18l3-12 2.5 9 2-3H21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0.85, opacity: 0.9 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6 }}
              />
            </svg>
          </span>
          <span className="text-base font-bold tracking-tight text-zinc-50 whitespace-nowrap shrink-0 sm:text-lg">
            TuneMatch
          </span>
        </button>

        {/* Right Actions & Catalog Status */}
        <div className="flex items-center gap-3 shrink-0 sm:gap-4">
          {showResetHint && (
            <button
              type="button"
              onClick={onLogoClick}
              className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954] rounded-md"
            >
              New Analysis
            </button>
          )}

          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#18181B]/90 px-2.5 py-1 text-[11px] font-medium text-zinc-300 whitespace-nowrap shrink-0 sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-xs">
            <AudioWaveform className="h-3.5 w-3.5 text-[#1DB954] shrink-0" aria-hidden="true" />
            <span className="hidden xs:inline sm:inline">Global Audio Catalog Ready</span>
            <span className="xs:hidden sm:hidden">Catalog Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
}
