import { ArrowRight, Loader2, Search, Sparkles, Volume2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TRACK_CATALOG } from '../data/catalog';
import { Track } from '../types/music';

interface HeroSearchViewProps {
  initialQuery: string;
  onAnalyzeTrack: (query: string, matchedTrack?: Track) => void;
}

export function HeroSearchView({ initialQuery, onAnalyzeTrack }: HeroSearchViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remoteMatches, setRemoteMatches] = useState<Track[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only match local catalog once the user starts typing
  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return TRACK_CATALOG.filter(
      (track) =>
        track.title.toLowerCase().includes(q) ||
        track.artist.toLowerCase().includes(q) ||
        track.genre.toLowerCase().includes(q)
    ).slice(0, 4);
  }, [query]);

  // Live global search against /api/music/search as the user types
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setRemoteMatches([]);
      setIsSearchingRemote(false);
      return;
    }

    let cancelled = false;
    setIsSearchingRemote(true);

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/music/search?q=${encodeURIComponent(trimmed)}&limit=8`
        );
        if (!res.ok) throw new Error('Search failed');
        const data = (await res.json()) as { tracks?: Track[] };
        if (!cancelled) {
          setRemoteMatches(data.tracks ?? []);
        }
      } catch {
        if (!cancelled) {
          setRemoteMatches([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearchingRemote(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  // Prioritize live global search hits; fall back to local catalog only if remote search returns nothing
  const combinedMatches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    if (remoteMatches.length > 0) {
      return remoteMatches.slice(0, 8);
    }

    if (isSearchingRemote) {
      return [];
    }

    return localMatches.slice(0, 8);
  }, [query, remoteMatches, localMatches, isSearchingRemote]);

  const hasQuery = query.trim().length > 0;
  const showDropdown = isFocused && hasQuery;
  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    return combinedMatches.some((t) => t.title.toLowerCase() === q);
  }, [query, combinedMatches]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    if (activeIndex >= 0 && activeIndex < combinedMatches.length) {
      const selected = combinedMatches[activeIndex];
      setIsFocused(false);
      onAnalyzeTrack(selected.title, selected);
      return;
    }
    const topMatch = combinedMatches[0];
    setIsFocused(false);
    if (
      topMatch &&
      (topMatch.title.toLowerCase().includes(trimmed.toLowerCase()) ||
        trimmed.toLowerCase().includes(topMatch.title.toLowerCase()))
    ) {
      onAnalyzeTrack(topMatch.title, topMatch);
      return;
    }
    onAnalyzeTrack(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    const showCustomOption = hasQuery && !hasExactMatch;
    const totalItems = combinedMatches.length + (showCustomOption ? 1 : 0);
    if (totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      setActiveIndex(-1);
    }
  };

  return (
    <motion.section
      key="hero-search"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col items-center justify-center px-4 py-12 sm:px-6"
    >
      {/* Hero Copy */}
      <div className="mb-10 text-center">
        <p className="mb-4 text-xs font-medium tracking-widest text-[#1ED760] uppercase font-mono">
          7-Dimensional Acoustic Vector Engine
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1] [text-wrap:balance]">
          Discover music by its mathematical DNA.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-[17px]">
          Type any song in any language to deconstruct its seven normalized acoustic
          dimensions, uncover cosine-matched tracks, and listen to 30-second previews.
        </p>
      </div>

      {/* Glassmorphic Search Bar + Typing-Triggered Autocomplete */}
      <div ref={containerRef} className="relative z-20 w-full max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className={`relative flex flex-col gap-2 rounded-2xl border bg-[#18181B]/75 p-2 backdrop-blur-xl transition-all duration-200 sm:flex-row sm:items-center ${
            isFocused
              ? 'border-[#1DB954]/60 shadow-[0_0_0_1px_rgba(29,185,84,0.3),0_20px_50px_-12px_rgba(29,185,84,0.22)]'
              : 'border-white/[0.09] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.75)] hover:border-white/[0.16]'
          }`}
        >
          <div className="flex flex-1 items-center gap-3 pl-3 pr-2">
            {isSearchingRemote ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#1ED760]" aria-hidden="true" />
            ) : (
              <Search
                className={`h-5 w-5 shrink-0 transition-colors duration-200 ${
                  isFocused ? 'text-[#1ED760]' : 'text-zinc-500'
                }`}
                aria-hidden="true"
              />
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
              onFocus={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Start typing any song or artist in any language..."
              aria-label="Search any song to analyze its 7D audio DNA"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
              className="h-11 w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none sm:text-[15px]"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1DB954] px-5 text-sm font-semibold text-[#09090B] shadow-[0_0_24px_rgba(29,185,84,0.38)] transition-all duration-150 hover:bg-[#1ED760] hover:shadow-[0_0_32px_rgba(30,215,96,0.52)] active:scale-[0.98] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span>Analyze &amp; Curate</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        </form>

        {/* Live Search Results Dropdown (Only shown as user starts typing) */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.99 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              role="listbox"
              aria-label="Matching songs"
              className="absolute left-0 right-0 top-[calc(100%+8px)] max-h-[300px] overflow-y-auto rounded-xl border border-white/[0.09] bg-[#121212]/96 shadow-2xl backdrop-blur-xl sm:max-h-[340px]"
            >
              {combinedMatches.length > 0 && (
                <div className="py-1.5">
                  <div className="flex items-center justify-between px-3.5 py-1.5 text-[11px] font-medium tracking-wider text-zinc-500 uppercase">
                    <span>Matching Songs</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {combinedMatches.length} found
                    </span>
                  </div>

                  {combinedMatches.map((track, idx) => (
                    <button
                      key={track.id}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setQuery(track.title);
                        setIsFocused(false);
                        onAnalyzeTrack(track.title, track);
                      }}
                      className={`flex w-full items-center justify-between gap-4 px-3.5 py-2.5 text-left transition-colors ${
                        activeIndex === idx ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={track.coverArt}
                          alt={`${track.title} cover`}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 shrink-0 rounded-md border border-white/10 object-cover"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-100">
                            {track.title}
                          </div>
                          <div className="truncate text-xs text-zinc-400">
                            {track.artist} · {track.genre} · {track.language ?? 'English'}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        {track.previewUrl && (
                          <Volume2
                            className="h-3.5 w-3.5 text-[#1DB954]"
                            aria-label="Audio preview available"
                          />
                        )}
                        <span className="font-mono text-xs tabular-nums text-zinc-400">
                          {track.features.bpm} BPM
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {hasQuery && !hasExactMatch && (
                <button
                  type="button"
                  role="option"
                  aria-selected={activeIndex === combinedMatches.length}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsFocused(false);
                    onAnalyzeTrack(query.trim());
                  }}
                  className={`flex w-full items-center justify-between gap-3 border-t border-white/[0.06] px-3.5 py-3 text-left transition-colors ${
                    activeIndex === combinedMatches.length
                      ? 'bg-[#1DB954]/15'
                      : 'hover:bg-[#1DB954]/10'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#1DB954]/30 bg-[#1DB954]/15 text-[#1ED760]">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-100">
                        Search &amp; Analyze &ldquo;{query.trim()}&rdquo;
                      </div>
                      <div className="text-xs text-zinc-400">
                        Find matching audio track or synthesize custom 7D vector
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-[#1ED760]">Analyze</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
