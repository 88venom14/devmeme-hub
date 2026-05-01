// Reusable UI primitives

const Avatar = ({ name, color, size = 32, ring = false }) => {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        width: size, height: size,
        background: color || 'oklch(0.65 0.15 200)',
        borderRadius: '50%',
        display: 'inline-flex',
        justifyContent: 'center',
        fontSize: size * 0.45, fontWeight: 600,
        color: 'oklch(0.15 0.01 60)',
        flexShrink: 0,
        boxShadow: ring ? '0 0 0 2px var(--bg-1), 0 0 0 3px var(--accent)' : 'none',
        fontFamily: 'var(--font-ui)',
        letterSpacing: '-0.02em', opacity: "1", flexDirection: "row", alignItems: "center"
      }}>
      
      {initial}
    </div>);

};

// Procedural placeholder image — generates a unique abstract gradient + pattern per seed
const MediaPlaceholder = ({ seed = 'gradient-1', kind = 'image', label, aspectRatio = '16/10' }) => {
  // Deterministic hue from seed
  const hash = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const h1 = hash * 37 % 360;
  const h2 = (h1 + 60) % 360;
  const h3 = (h1 + 180) % 360;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio,
        borderRadius: 8,
        overflow: 'hidden',
        background: `
          radial-gradient(circle at 30% 20%, oklch(0.55 0.18 ${h1}) 0%, transparent 50%),
          radial-gradient(circle at 70% 80%, oklch(0.5 0.16 ${h2}) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, oklch(0.4 0.12 ${h3}) 0%, oklch(0.2 0.04 ${h1}) 100%)
        `,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
      
      {/* subtle stripe overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 12px, rgba(0,0,0,0.06) 12px 13px)'
      }} />

      {kind === 'video' &&
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white',
        zIndex: 2,
        border: '1px solid rgba(255,255,255,0.15)'
      }}>
          <Icon name="play" size={22} />
        </div>
      }

      {label &&
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        background: 'rgba(0,0,0,0.4)',
        padding: '2px 6px',
        borderRadius: 4,
        letterSpacing: '0.02em'
      }}>
          {label}
        </div>
      }
    </div>);

};

// Inline video player with mock controls
const VideoCard = ({ seed, label }) => {
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {setPlaying(false);return 0;}
        return p + 0.5;
      });
    }, 50);
    return () => clearInterval(id);
  }, [playing]);

  const sec = Math.floor(progress * 0.6);
  const fmt = (s) => `0:${String(s).padStart(2, '0')}`;

  return (
    <div style={{ position: 'relative' }}>
      <MediaPlaceholder seed={seed} kind="video" label={label} aspectRatio="16/10" />
      <button
        onClick={(e) => {e.stopPropagation();setPlaying((p) => !p);}}
        style={{
          position: 'absolute', inset: 0,
          background: 'transparent', border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
        
        {!playing &&
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          transition: 'transform 0.15s'
        }}>
            <Icon name="play" size={22} />
          </div>
        }
      </button>
      {/* control bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '8px 10px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
        display: 'flex', alignItems: 'center', gap: 8,
        color: 'white',
        fontFamily: 'var(--font-mono)',
        fontSize: 11
      }}>
        <button onClick={(e) => {e.stopPropagation();setPlaying((p) => !p);}}
        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex' }}>
          <Icon name={playing ? 'pause' : 'play'} size={14} />
        </button>
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)' }} />
        </div>
        <span style={{ opacity: 0.85 }}>{fmt(sec)} / 1:00</span>
        <Icon name="volume" size={13} />
        <Icon name="fullscreen" size={13} />
      </div>
    </div>);

};

const Tag = ({ children, count, onClick, active = false }) =>
<button
  onClick={onClick}
  style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 9px',
    background: active ? 'oklch(0.65 0.18 50 / 0.15)' : 'var(--bg-2)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 999,
    color: active ? 'var(--accent)' : 'var(--text-2)',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.01em',
    lineHeight: 1.4
  }}
  onMouseEnter={(e) => !active && (e.currentTarget.style.borderColor = 'var(--border-2)')}
  onMouseLeave={(e) => !active && (e.currentTarget.style.borderColor = 'var(--border)')}>
  
    <span>{children}</span>
    {count != null && <span style={{ opacity: 0.5, fontSize: 10 }}>{count}</span>}
  </button>;


const Button = ({ children, variant = 'ghost', icon, onClick, full = false, type = 'button', size = 'md' }) => {
  const styles = {
    primary: { background: 'var(--accent)', color: 'oklch(0.15 0.01 60)', border: '1px solid var(--accent)' },
    secondary: { background: 'var(--bg-2)', color: 'var(--text-1)', border: '1px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text-2)', border: '1px solid transparent' },
    danger: { background: 'transparent', color: 'oklch(0.65 0.2 25)', border: '1px solid oklch(0.4 0.15 25)' }
  };
  const sizes = {
    sm: { padding: '4px 10px', fontSize: 12, height: 26 },
    md: { padding: '6px 14px', fontSize: 13, height: 32 },
    lg: { padding: '10px 18px', fontSize: 14, height: 40 }
  };
  return (
    <button
      type={type}
      onClick={onClick}
      style={{ ...{
          ...styles[variant],
          ...sizes[size],
          display: 'inline-flex', alignItems: 'center', gap: 6,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          fontWeight: 500,
          transition: 'transform 0.08s, filter 0.15s',
          width: full ? '100%' : 'auto',

          whiteSpace: 'nowrap', flexDirection: "row", justifyContent: "center"
        }, height: "33px", width: "178px", color: "rgb(202, 54, 54)", lineHeight: "1.4", border: "1px solid rgb(255, 0, 0)" }}
      onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.12)'}
      onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
      
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 14} />}
      {children}
    </button>);

};

// Time-ago formatter
const timeAgo = (ts) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
};

const formatNum = (n) => {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
};

Object.assign(window, {
  Avatar, MediaPlaceholder, VideoCard, Tag, Button,
  timeAgo, formatNum
});