// Icon components — simple, single-stroke, mono
const Icon = ({ name, size = 16, className = '' }) => {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    className,
  };
  switch (name) {
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'plus': return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'feed': return <svg {...props}><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/></svg>;
    case 'bookmark': return <svg {...props}><path d="M6 3h12v18l-6-4-6 4z"/></svg>;
    case 'user': return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
    case 'heart': return <svg {...props}><path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11h-2z"/></svg>;
    case 'comment': return <svg {...props}><path d="M21 12a8 8 0 0 1-12 7l-5 1 1-5A8 8 0 1 1 21 12z"/></svg>;
    case 'share': return <svg {...props}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8 11 8-4M8 13l8 4"/></svg>;
    case 'play': return <svg {...props} fill="currentColor" stroke="none"><path d="M7 4v16l13-8z"/></svg>;
    case 'image': return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m3 17 6-6 11 11"/></svg>;
    case 'video': return <svg {...props}><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 9 5-3v12l-5-3z"/></svg>;
    case 'tag': return <svg {...props}><path d="M20 12 12 4H4v8l8 8z"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/></svg>;
    case 'flame': return <svg {...props}><path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-6 0 2-1 3-2 3 0-3-1-6-4-9-1 4-3 5-4 7s-1 3-1 5c0 4 3 7 7 7z"/></svg>;
    case 'sparkle': return <svg {...props}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></svg>;
    case 'trending': return <svg {...props}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
    case 'close': return <svg {...props}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'logout': return <svg {...props}><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>;
    case 'check': return <svg {...props}><path d="m5 12 5 5 9-11"/></svg>;
    case 'arrow-up': return <svg {...props}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case 'cart': return <svg {...props}><path d="M3 4h2l2 13h12l2-9H6"/><circle cx="9" cy="20" r="1.4" fill="currentColor"/><circle cx="18" cy="20" r="1.4" fill="currentColor"/></svg>;
    case 'pause': return <svg {...props} fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
    case 'volume': return <svg {...props}><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 8a5 5 0 0 1 0 8"/></svg>;
    case 'fullscreen': return <svg {...props}><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/></svg>;
    case 'lightning': return <svg {...props} fill="currentColor" stroke="none"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>;
    case 'bell': return <svg {...props}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>;
    default: return null;
  }
};

window.Icon = Icon;
