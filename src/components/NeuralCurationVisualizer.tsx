import { Disc3 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AUDIO_TRAITS_META } from '../data/catalog';

interface NeuralCurationVisualizerProps {
  queryLabel: string;
  coverArt: string;
  trackTitle: string;
}

const STATUS_CAPTIONS = [
  'Extracting 7D acoustic DNA...',
  'Projecting track into K-Means mood cluster...',
  'Computing cosine similarity across 25,000 vectors...',
  'Curating your sonic matches...',
];

interface ParameterFlyby {
  key: string;
  label: string;
  shortLabel: string;
  angleRad: number;
  delay: number;
  startDist: number;
  endDist: number;
}

// Radial lanes around the flight corridor so all 7 parameters zoom past from the horizon toward the foreground edges
const PARAMETER_LANES: ParameterFlyby[] = AUDIO_TRAITS_META.map((trait, idx) => {
  const anglesDeg = [-145, -35, -162, -18, 152, 28, -90];
  const angleRad = (anglesDeg[idx % anglesDeg.length] * Math.PI) / 180;
  return {
    key: trait.key,
    label: trait.label,
    shortLabel: trait.shortLabel,
    angleRad,
    delay: idx * 0.25,
    startDist: 18,
    endDist: 330,
  };
});

export function NeuralCurationVisualizer({
  queryLabel,
  coverArt,
  trackTitle,
}: NeuralCurationVisualizerProps) {
  const [captionIndex, setCaptionIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setImgError(false);
  }, [coverArt]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCaptionIndex((prev) => (prev + 1 < STATUS_CAPTIONS.length ? prev + 1 : prev));
    }, 680);
    return () => window.clearInterval(interval);
  }, []);

  // 60fps 3D perspective starfield & emerald warp-streak canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const width = 760;
    const height = 420;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const cx = width / 2;
    const cy = height * 0.5;
    const starCount = 165;

    interface Star {
      x: number;
      y: number;
      z: number;
      pz: number;
      emerald: boolean;
    }

    const stars: Star[] = Array.from({ length: starCount }, (_, i) => {
      const z = Math.random() * width;
      return {
        x: (Math.random() - 0.5) * width * 1.4,
        y: (Math.random() - 0.5) * height * 1.4,
        z,
        pz: z,
        emerald: i % 5 === 0,
      };
    });

    let rafId = 0;
    const speed = prefersReducedMotion ? 0 : 11.5;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Soft horizon radial glow at vanishing point
      const horizonGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 180);
      horizonGrad.addColorStop(0, 'rgba(30, 215, 96, 0.22)');
      horizonGrad.addColorStop(0.45, 'rgba(29, 185, 84, 0.06)');
      horizonGrad.addColorStop(1, 'rgba(9, 9, 11, 0)');
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, 0, width, height);

      for (const s of stars) {
        s.pz = s.z;
        s.z -= speed;

        if (s.z <= 4) {
          s.x = (Math.random() - 0.5) * width * 1.4;
          s.y = (Math.random() - 0.5) * height * 1.4;
          s.z = width;
          s.pz = s.z;
        }

        const k = 260 / s.z;
        const px = cx + s.x * k;
        const py = cy + s.y * k;

        const pk = 260 / s.pz;
        const prevX = cx + s.x * pk;
        const prevY = cy + s.y * pk;

        if (px < -40 || px > width + 40 || py < -40 || py > height + 40) continue;

        const depthRatio = 1 - s.z / width;
        const alpha = Math.min(0.92, Math.max(0.08, depthRatio * 1.05));

        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(px, py);
        ctx.strokeStyle = s.emerald
          ? `rgba(30, 215, 96, ${alpha.toFixed(2)})`
          : `rgba(228, 228, 231, ${(alpha * 0.72).toFixed(2)})`;
        ctx.lineWidth = s.emerald ? 1.6 * depthRatio + 0.5 : 1.1 * depthRatio + 0.4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(render);
      }
    };

    render();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Faint perspective warp rings expanding from vanishing point
  const warpRings = useMemo(() => [0, 0.7, 1.4], []);

  return (
    <motion.section
      key="neural-visualizer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.25 } }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col items-center justify-center px-6 py-10"
      aria-live="polite"
    >
      {/* Elevated Query Pill */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/[0.09] bg-[#18181B]/90 px-4 py-2 text-xs text-zinc-300 shadow-lg backdrop-blur-md"
      >
        <span className="font-mono text-[#1ED760]">SEED</span>
        <span className="h-3 w-px bg-white/10" aria-hidden="true" />
        <span className="max-w-[260px] truncate font-medium text-zinc-100">{queryLabel}</span>
      </motion.div>

      {/* Deep-Space Flight Corridor Viewport */}
      <div
        className="relative flex h-[340px] w-full max-w-[720px] items-center justify-center overflow-hidden rounded-3xl border border-white/[0.07] bg-[#09090B]/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:h-[400px]"
        role="img"
        aria-label="First-person deep-space warp animation with 7 acoustic parameters zooming past"
      >
        {/* Starfield Warp Canvas */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {/* Soft Edge Vignette */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_28%,#09090B_95%)]"
          aria-hidden="true"
        />

        {/* Subtle Glowing Vanishing Point Core */}
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1ED760]/70 blur-[6px]"
          animate={{ scale: [1, 1.35, 1], opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />

        {/* Expanding Perspective Warp Rings from Vanishing Point */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          {warpRings.map((delay, i) => (
            <motion.div
              key={`ring-${i}`}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1DB954]/30"
              initial={{ width: 24, height: 24, opacity: 0.7 }}
              animate={{ width: 520, height: 520, opacity: 0 }}
              transition={{
                duration: 2.1,
                delay,
                repeat: Infinity,
                ease: [0.35, 0, 0.8, 0.6],
              }}
            />
          ))}
        </div>

        {/* Centered Album Cover Approaching from Horizon and Fading Out */}
        <motion.div
          className="pointer-events-none relative z-10 flex items-center justify-center"
          initial={{ scale: 0.16, opacity: 0 }}
          animate={{
            scale: [0.16, 0.48, 0.96, 1.55, 2.2],
            opacity: [0, 0.88, 1, 0.85, 0],
          }}
          transition={{
            duration: 2.75,
            times: [0, 0.22, 0.62, 0.84, 1],
            ease: [0.32, 0.04, 0.68, 0.96],
          }}
        >
          <div className="relative h-36 w-36 overflow-hidden rounded-2xl border border-[#1ED760]/45 bg-[#121212] shadow-[0_0_55px_rgba(29,185,84,0.34)] sm:h-44 sm:w-44">
            {!imgError && coverArt ? (
              <img
                src={coverArt}
                alt={`${trackTitle} album artwork`}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1DB954]/25 to-[#121212]">
                <Disc3 className="h-12 w-12 text-[#1ED760]/80" aria-hidden="true" />
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15"
              aria-hidden="true"
            />
          </div>
        </motion.div>

        {/* 7 Acoustic Parameters Zooming Past From Horizon (Front) to Camera Edges (Back) */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          {PARAMETER_LANES.map((param) => {
            const startX = Math.cos(param.angleRad) * param.startDist;
            const startY = Math.sin(param.angleRad) * param.startDist * 0.72;
            const endX = Math.cos(param.angleRad) * param.endDist;
            const endY = Math.sin(param.angleRad) * param.endDist * 0.68;

            return (
              <motion.div
                key={param.key}
                className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
                initial={{
                  x: startX,
                  y: startY,
                  scale: 0.22,
                  opacity: 0,
                }}
                animate={{
                  x: [startX, endX],
                  y: [startY, endY],
                  scale: [0.22, 0.72, 1.48],
                  opacity: [0, 0.95, 1, 0],
                }}
                transition={{
                  duration: 1.75,
                  delay: param.delay,
                  repeat: Infinity,
                  repeatDelay: 0.2,
                  ease: [0.45, 0.05, 0.85, 0.55],
                  times: [0, 0.3, 0.78, 1],
                }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-[#1DB954]/45 bg-[#121212]/90 px-3 py-1 shadow-[0_0_20px_rgba(29,185,84,0.28)] backdrop-blur-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1ED760]" />
                  <span className="font-mono text-[11px] font-semibold tracking-wide text-zinc-100">
                    {param.label}
                  </span>
                  <span className="font-mono text-[10px] text-[#1ED760]">
                    {param.shortLabel}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>

      {/* Cycling Curation Status Caption */}
      <div className="mt-5 flex h-12 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={captionIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="font-mono text-sm font-medium text-[#1ED760]"
          >
            {STATUS_CAPTIONS[captionIndex]}
          </motion.p>
        </AnimatePresence>

        {/* 4-Step Emerald Progress Ticks */}
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {STATUS_CAPTIONS.map((_, idx) => (
            <span
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx <= captionIndex ? 'w-6 bg-[#1DB954]' : 'w-2 bg-white/15'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
