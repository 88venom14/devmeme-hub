import React, { useRef, useState, useCallback, useEffect } from 'react';

interface VideoPlayerProps {
  src: string;
  maxHeight?: number;
}

function videoTypeFromSrc(src: string): string | undefined {
  const path = src.split('?')[0].toLowerCase();
  if (path.endsWith('.mp4')) return 'video/mp4';
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.mov')) return 'video/quicktime';
  return undefined;
}

function fmt(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,3 20,12 6,21" />
  </svg>
);
const IconPause = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="3" width="5" height="18" rx="1" />
    <rect x="15" y="3" width="5" height="18" rx="1" />
  </svg>
);
const IconVolume = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"
      stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);
const IconMute = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconFullscreen = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);
const IconExitFullscreen = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" />
    <line x1="10" y1="14" x2="3" y2="21" /><line x1="21" y1="3" x2="14" y2="10" />
  </svg>
);

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, maxHeight = 480 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dragging, setDragging] = useState<'progress' | 'volume' | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const draggingRef = useRef<'progress' | 'volume' | null>(null);

  // Keep ref in sync for mousemove handlers
  useEffect(() => { draggingRef.current = dragging; }, [dragging]);

  // Track fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // RAF-based smooth scrubber — runs at 60fps while playing
  const startRaf = useCallback(() => {
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) {
        setCurrentTime(v.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRaf = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  // Controls auto-hide
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  }, []);

  const showAndSchedule = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else {
      scheduleHide();
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, scheduleHide]);

  // Handlers
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setPlaybackError(null);
    if (v.paused) {
      void v.play().catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : 'PlaybackError';
        setPlaying(false);
        if (name === 'NotSupportedError') {
          setPlaybackError('Этот браузер не поддерживает кодек этого видео.');
          return;
        }
        setPlaybackError('Не удалось воспроизвести видео.');
      });
    } else {
      v.pause();
    }
  }, []);

  const getProgressRatio = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    const bar = progressRef.current;
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const getVolumeRatio = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    const bar = volumeRef.current;
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const seekAt = useCallback((ratio: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = ratio * duration;
    setCurrentTime(v.currentTime);
  }, [duration]);

  const setVolAt = useCallback((ratio: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = ratio;
    v.muted = ratio === 0;
    setVolume(ratio);
    setMuted(ratio === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  }, []);

  // Global mousemove/mouseup for drag outside the bar
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current === 'progress') {
        const r = getProgressRatio(e);
        if (r !== null) seekAt(r);
      } else if (draggingRef.current === 'volume') {
        const r = getVolumeRatio(e);
        if (r !== null) setVolAt(r);
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [seekAt, setVolAt]);

  const progress = duration > 0 ? currentTime / duration : 0;
  const volDisplay = muted ? 0 : volume;

  return (
    <div
      ref={containerRef}
      onMouseMove={showAndSchedule}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
      style={{
        position: 'relative',
        background: '#000',
        borderRadius: isFullscreen ? 0 : 8,
        overflow: 'hidden',
        border: isFullscreen ? 'none' : '1px solid var(--border)',
        userSelect: 'none',
        // Fullscreen: container fills the screen as a flex column
        ...(isFullscreen ? {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
        } : {}),
      }}
    >
      <video
        ref={videoRef}
        onClick={togglePlay}
        onPlay={() => { setPlaying(true); startRaf(); }}
        onPause={() => { setPlaying(false); stopRaf(); }}
        onEnded={() => { setPlaying(false); stopRaf(); }}
        onError={() => {
          setPlaying(false);
          setPlaybackError('Этот браузер не поддерживает формат или кодек этого видео.');
        }}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        // Update time on seek while paused
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v && v.paused) setCurrentTime(v.currentTime);
        }}
        style={{
          width: '100%',
          display: 'block',
          cursor: 'pointer',
          objectFit: 'contain',
          // Normal mode: constrained height. Fullscreen: fills remaining flex space.
          ...(isFullscreen
            ? { flex: 1, minHeight: 0, maxHeight: 'none' }
            : { maxHeight: `${maxHeight}px` }),
        }}
      >
        <source src={src} type={videoTypeFromSrc(src)} />
      </video>

      {playbackError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            background: 'rgba(0,0,0,0.72)',
            color: 'rgba(255,255,255,0.88)',
            textAlign: 'center',
            fontSize: 12,
            lineHeight: 1.45,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div>
            <div>{playbackError}</div>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', display: 'inline-block', marginTop: 8 }}
              onClick={(e) => e.stopPropagation()}
            >
              открыть видео напрямую
            </a>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        style={{
          position: isFullscreen ? 'relative' : 'absolute',
          bottom: 0, left: 0, right: 0,
          padding: '28px 14px 10px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          transition: 'opacity 0.2s',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          fontFamily: 'var(--font-mono)',
          // In fullscreen the overlay sits below the video; keep it at bottom visually
          ...(isFullscreen ? { marginTop: 'auto', position: 'absolute' as const } : {}),
        }}
      >
        {/* Progress bar — click + drag */}
        <div
          ref={progressRef}
          onMouseDown={(e) => {
            setDragging('progress');
            const r = getProgressRatio(e);
            if (r !== null) seekAt(r);
          }}
          style={{
            height: 4,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 999,
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          {/* Filled */}
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: `${progress * 100}%`,
            background: 'var(--accent)',
            borderRadius: 999,
          }} />
          {/* Thumb */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${progress * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 12, height: 12,
            background: '#fff',
            borderRadius: '50%',
            boxShadow: '0 0 0 2px var(--accent)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={togglePlay}
            style={{
              background: 'var(--accent)', border: 'none',
              color: '#111',
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, padding: 0,
            }}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>

          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div style={{ flex: 1 }} />

          {/* Mute button */}
          <button
            onClick={toggleMute}
            style={{ background: 'none', border: 'none', padding: 0, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            {muted || volDisplay === 0 ? <IconMute /> : <IconVolume />}
          </button>

          {/* Volume bar */}
          <div
            ref={volumeRef}
            onMouseDown={(e) => {
              setDragging('volume');
              const r = getVolumeRatio(e);
              if (r !== null) setVolAt(r);
            }}
            style={{
              width: 64, height: 4,
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 999, cursor: 'pointer',
              position: 'relative', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: `${volDisplay * 100}%`,
              background: 'rgba(255,255,255,0.6)',
              borderRadius: 999,
            }} />
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            style={{ background: 'none', border: 'none', padding: 0, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
