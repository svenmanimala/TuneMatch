import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

const SCROLL_THRESHOLD_PX = 240;

interface ScrollToTopButtonProps {
  hidden?: boolean;
}

export function ScrollToTopButton({ hidden = false }: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(window.scrollY > SCROLL_THRESHOLD_PX);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {isVisible && !hidden && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleScrollToTop}
            aria-label="Back to top of page"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#1DB954]/45 bg-[#121212]/90 px-4 py-2 text-xs font-semibold text-zinc-100 shadow-[0_12px_36px_rgba(0,0,0,0.75),0_0_24px_rgba(29,185,84,0.22)] backdrop-blur-xl transition-colors hover:border-[#1ED760] hover:bg-[#18181B] hover:text-white active:scale-[0.97] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954]"
          >
            <ArrowUp className="h-3.5 w-3.5 text-[#1ED760]" aria-hidden="true" />
            <span>Back to Top</span>
          </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}
