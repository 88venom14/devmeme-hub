import React, { useRef, useState, useCallback, useEffect } from 'react';

interface VideoPlayerProps {
  src: string;
  maxHeight?: string | number;
}

function fmt(secs: number): string {
  if (!isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const IconPause = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="3" width="5" height="18" rx="1" />
    <rect x="15" y="3" width="5" height="18" rx="1" />
  </svg>
);

const IconVolume = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

const IconMute = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" />
    <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const IconFullscreen = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, maxHeight = 480 }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [dragging, setDragging] = useState<'progress' | 'volume' | null>(null);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 2500);
  }, [playing]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (!playing) setShowControls(true);
    else scheduleHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, scheduleHide]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
  }, [duration]);

  const setVolumeAt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const bar = volumeRef.current;
    if (!v || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
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
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;
  const volDisplay = muted ? 0 : volume;

  const controlsBg = 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
      style={{
        position: 'relative',
        background: '#000',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      <video
        ref={videoRef}
        src={src}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
        style={{
          width: '100%',
          maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
          display: 'block',
          cursor: 'pointer',
        }}
      />

      {/* Controls overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          padding: '32px 14px 10px',
          background: controlsBg,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          transition: 'opacity 0.2s',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          onClick={seekTo}
          onMouseDown={() => setDragging('progress')}
          onMouseUp={() => setDragging(null)}
          onMouseMove={(e) => { if (dragging === 'progress') seekTo(e); }}
          style={{
            height: 4,
            background: 'rgba(255,255,255,0.18)',
            borderRadius: 999,
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          {/* Buffered/track ghost */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
            }}
          />
          {/* Filled */}
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, bottom: 0,
              width: `${progress * 100}%`,
              background: 'var(--accent)',
              borderRadius: 999,
              transition: dragging ? 'none' : 'width 0.1s linear',
            }}
          />
          {/* Thumb */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${progress * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 10, height: 10,
              background: 'var(--accent)',
              borderRadius: '50%',
              boxShadow: '0 0 4px rgba(0,0,0,0.6)',
              transition: dragging ? 'none' : 'left 0.1s linear',
            }}
          />
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            style={{
              background: 'var(--accent)',
              border: 'none',
              color: 'oklch(0.15 0.01 60)',
              width: 28, height: 28,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {playing ? <IconPause /> : <IconPlay />}
          </button>

          {/* Time */}
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div style={{ flex: 1 }} />

          {/* Volume */}
          <button
            onClick={toggleMute}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {muted || volDisplay === 0 ? <IconMute /> : <IconVolume />}
          </button>

          <div
            ref={volumeRef}
            onClick={setVolumeAt}
            onMouseDown={() => setDragging('volume')}
            onMouseUp={() => setDragging(null)}
            onMouseMove={(e) => { if (dragging === 'volume') setVolumeAt(e); }}
            style={{
              width: 60, height: 4,
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 999,
              cursor: 'pointer',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0, left: 0, bottom: 0,
                width: `${volDisplay * 100}%`,
                background: 'rgba(255,255,255,0.55)',
                borderRadius: 999,
              }}
            />
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <IconFullscreen />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
