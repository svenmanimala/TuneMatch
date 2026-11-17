import { Track } from '../types/music';
import { synthEngine } from './synthEngine';

export type PlaybackMode = 'audio' | 'synth';

interface AudioControllerCallbacks {
  onProgress: (currentSec: number, durationSec: number) => void;
  onEnded: () => void;
  onModeChange: (mode: PlaybackMode) => void;
  onErrorFallback: () => void;
}

/**
 * Unified 30-second preview controller:
 * - Plays the official 30-second song preview through our same-origin `/api/music/audio` proxy
 *   (ensuring proper `audio/mp4` MIME headers and byte-range seeking).
 * - Seamlessly falls back to the Web Audio procedural synth engine if a track lacks a preview URL or fails to load.
 */
class UnifiedAudioController {
  private audioEl: HTMLAudioElement | null = null;
  private synthTimer: number | null = null;
  private mode: PlaybackMode = 'audio';
  private activeTrack: Track | null = null;
  private isPlaying = false;
  private volume = 0.7;
  private synthProgress = 0;
  private playNonce = 0;
  private callbacks: AudioControllerCallbacks | null = null;

  public setCallbacks(cb: AudioControllerCallbacks): void {
    this.callbacks = cb;
  }

  private getProxiedAudioUrl(previewUrl: string): string {
    const normalized = previewUrl.startsWith('http://audio-ssl.itunes.apple.com/')
      ? previewUrl.replace('http://', 'https://')
      : previewUrl;
    if (normalized.startsWith('https://audio-ssl.itunes.apple.com/')) {
      return `/api/music/audio?url=${encodeURIComponent(normalized)}`;
    }
    return normalized;
  }

  private ensureAudioElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioEl) {
      const el = new Audio();
      el.preload = 'auto';
      el.loop = false;
      el.volume = this.volume;

      el.addEventListener('timeupdate', () => {
        if (this.mode === 'audio' && this.isPlaying) {
          const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 30;
          this.callbacks?.onProgress(el.currentTime, dur);
        }
      });

      el.addEventListener('loadedmetadata', () => {
        if (this.mode === 'audio') {
          const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 30;
          this.callbacks?.onProgress(el.currentTime, dur);
        }
      });

      el.addEventListener('ended', () => {
        if (this.mode === 'audio') {
          this.isPlaying = false;
          el.currentTime = 0;
          const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 30;
          this.callbacks?.onProgress(0, dur);
          this.callbacks?.onEnded();
        }
      });

      el.addEventListener('error', () => {
        if (this.mode === 'audio' && this.activeTrack && this.isPlaying && el.error) {
          this.fallbackToSynth(this.activeTrack);
        }
      });

      this.audioEl = el;
    }
    return this.audioEl;
  }

  private clearSynthTimer(): void {
    if (this.synthTimer !== null) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
  }

  private fallbackToSynth(track: Track): void {
    this.clearSynthTimer();
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.mode = 'synth';
    this.callbacks?.onModeChange('synth');
    this.callbacks?.onErrorFallback();
    this.synthProgress = 0;
    synthEngine.setVolume(this.volume);
    synthEngine.start(track);
    this.isPlaying = true;
    this.callbacks?.onProgress(0, 30);

    this.synthTimer = window.setInterval(() => {
      if (!this.isPlaying || this.mode !== 'synth') return;
      this.synthProgress += 0.25;
      if (this.synthProgress >= 30) {
        this.isPlaying = false;
        this.synthProgress = 0;
        this.clearSynthTimer();
        synthEngine.pause();
        this.callbacks?.onProgress(0, 30);
        this.callbacks?.onEnded();
        return;
      }
      this.callbacks?.onProgress(this.synthProgress, 30);
    }, 250);
  }

  public async play(track: Track): Promise<void> {
    const currentNonce = ++this.playNonce;
    const isSameTrack = this.activeTrack?.id === track.id;
    this.activeTrack = track;

    if (track.previewUrl) {
      this.clearSynthTimer();
      synthEngine.stop();
      const el = this.ensureAudioElement();
      if (!el) return;

      this.mode = 'audio';
      this.callbacks?.onModeChange('audio');

      const srcUrl = this.getProxiedAudioUrl(track.previewUrl);
      if (!isSameTrack || !el.src.endsWith(srcUrl)) {
        el.src = srcUrl;
        el.currentTime = 0;
      }
      el.loop = false;
      el.volume = this.volume;
      this.isPlaying = true;

      try {
        await el.play();
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (
          !isAbort &&
          this.playNonce === currentNonce &&
          this.isPlaying &&
          this.activeTrack?.id === track.id
        ) {
          this.fallbackToSynth(track);
        }
      }
      return;
    }

    this.fallbackToSynth(track);
  }

  public pause(): void {
    this.playNonce += 1;
    this.isPlaying = false;
    this.clearSynthTimer();
    if (this.mode === 'audio' && this.audioEl) {
      this.audioEl.pause();
    } else {
      synthEngine.pause();
    }
  }

  public resume(): void {
    if (!this.activeTrack) return;
    const track = this.activeTrack;
    const currentNonce = ++this.playNonce;
    if (this.mode === 'audio' && this.audioEl) {
      this.isPlaying = true;
      void this.audioEl.play().catch((err) => {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (
          !isAbort &&
          this.playNonce === currentNonce &&
          this.isPlaying &&
          this.activeTrack?.id === track.id
        ) {
          this.fallbackToSynth(track);
        }
      });
    } else {
      void this.play(track);
    }
  }

  public seek(sec: number): void {
    if (this.mode === 'audio' && this.audioEl) {
      const dur =
        Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0
          ? this.audioEl.duration
          : 30;
      const clamped = Math.max(0, Math.min(dur, sec));
      this.audioEl.currentTime = clamped;
      this.callbacks?.onProgress(clamped, dur);
    } else {
      this.synthProgress = Math.max(0, Math.min(30, sec));
      this.callbacks?.onProgress(this.synthProgress, 30);
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
    synthEngine.setVolume(this.volume);
  }

  public stop(): void {
    this.playNonce += 1;
    this.isPlaying = false;
    this.activeTrack = null;
    this.synthProgress = 0;
    this.clearSynthTimer();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
    }
    synthEngine.stop();
  }
}

export const audioController = new UnifiedAudioController();
