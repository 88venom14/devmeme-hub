// Post card component

const PostCard = ({ post, onLike, onSave, onOpen, onTagClick }) => {
  const [shareFlash, setShareFlash] = React.useState(false);

  const handleLike = (e) => {
    e.stopPropagation();
    onLike(post.id);
  };
  const handleSave = (e) => {
    e.stopPropagation();
    onSave(post.id);
  };
  const handleShare = (e) => {
    e.stopPropagation();
    setShareFlash(true);
    setTimeout(() => setShareFlash(false), 1400);
  };

  return (
    <article
      onClick={() => onOpen(post.id)}
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 14,
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.1s',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Author row */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={post.author.name} color={post.author.color} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{post.author.name}</span>
            <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{post.author.handle}</span>
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {timeAgo(post.createdAt)}
          </div>
        </div>
        {post.type === 'sale' && (
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
            color: 'var(--accent)', border: '1px solid oklch(0.45 0.15 50)',
            padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em',
          }}>SALE</span>
        )}
        {post.type === 'question' && (
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
            color: 'oklch(0.7 0.13 220)', border: '1px solid oklch(0.4 0.1 220)',
            padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em',
          }}>?</span>
        )}
      </header>

      {/* Title */}
      <h3 style={{
        margin: 0,
        fontSize: 16, fontWeight: 600, lineHeight: 1.3,
        color: 'var(--text-1)',
        textWrap: 'pretty',
      }}>
        {post.title}
      </h3>

      {/* Body text (text-only post) */}
      {post.body && !post.media && (
        <p style={{
          margin: 0, fontSize: 13, lineHeight: 1.55,
          color: 'var(--text-2)',
          textWrap: 'pretty',
        }}>
          {post.body}
        </p>
      )}

      {/* Media */}
      {post.media?.kind === 'video' && (
        <VideoCard seed={post.media.poster} label={post.media.label} />
      )}
      {post.media?.kind === 'image' && (
        <div style={{ position: 'relative' }}>
          <MediaPlaceholder seed={post.media.poster} kind="image" label={post.media.label} aspectRatio="16/10" />
          {post.type === 'sale' && post.price && (
            <div style={{
              position: 'absolute', left: 8, bottom: 8, right: 8,
              background: 'oklch(0.18 0.01 60 / 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{post.price}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>с доставкой</div>
              </div>
              <Button variant="primary" size="sm" icon="cart">В корзину</Button>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {post.tags.map(t => (
            <button
              key={t}
              onClick={(e) => { e.stopPropagation(); onTagClick?.(t); }}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-3)', fontSize: 11,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                padding: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <footer style={{
        display: 'flex', alignItems: 'center', gap: 4,
        paddingTop: 4,
        borderTop: '1px solid var(--border)',
        marginTop: 'auto',
      }}>
        <ActionButton icon="heart" label={formatNum(post.likes + (post.liked ? 1 : 0))} active={post.liked} activeColor="oklch(0.65 0.22 25)" onClick={handleLike} />
        <ActionButton icon="comment" label={formatNum(post.comments)} onClick={(e) => { e.stopPropagation(); onOpen(post.id); }} />

        <ActionButton icon="bookmark" label={formatNum(post.saves + (post.saved ? 1 : 0))} active={post.saved} activeColor="var(--accent)" onClick={handleSave} />
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <ActionButton icon="share" onClick={handleShare} />
          {shareFlash && (
            <div style={{
              position: 'absolute', right: 0, bottom: '100%', marginBottom: 6,
              background: 'var(--bg-3)', color: 'var(--text-1)',
              padding: '5px 9px', borderRadius: 5,
              fontSize: 11, fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
              border: '1px solid var(--border)',
              animation: 'fadeIn 0.15s ease-out',
            }}>
              ссылка скопирована
            </div>
          )}
        </div>
      </footer>
    </article>
  );
};

const ActionButton = ({ icon, label, active, activeColor, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 8px',
      background: 'transparent',
      border: 'none',
      borderRadius: 5,
      color: active ? activeColor : 'var(--text-3)',
      fontSize: 12,
      fontFamily: 'var(--font-mono)',
      cursor: 'pointer',
      transition: 'background 0.12s, color 0.12s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
  >
    <Icon name={icon} size={14} className={active ? 'icon-fill' : ''} />
    {label != null && <span>{label}</span>}
  </button>
);

window.PostCard = PostCard;
