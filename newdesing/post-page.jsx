// Full-page post view with rich comments

const PostFullPage = ({ post, allPosts, onBack, onLike, onSave, onTagClick, onOpenPost, onShowToast }) => {
  const [comments, setComments] = React.useState([
    { id: 'c1', author: 'test', avatar: 'T', color: 'oklch(0.7 0.15 200)', text: 'покупаю', likes: 3, time: '1д назад', replies: [] },
    { id: 'c2', author: 'kira_404', avatar: 'K', color: 'oklch(0.65 0.18 280)', text: 'а доставка по россии есть? и можно ли поторговаться 😅', likes: 8, time: '20ч', liked: false, replies: [
      { id: 'c2-1', author: '1231', avatar: '1', color: 'oklch(0.7 0.13 145)', text: 'есть, сдэк. цена финал', likes: 2, time: '18ч' },
    ]},
    { id: 'c3', author: 'memer_42', avatar: 'M', color: 'oklch(0.68 0.16 200)', text: 'вообще огонь штука. оригинал?', likes: 1, time: '12ч', replies: [] },
  ]);
  const [draft, setDraft] = React.useState('');
  const [replyTo, setReplyTo] = React.useState(null);
  const [sortComments, setSortComments] = React.useState('top');

  const submit = () => {
    if (!draft.trim()) return;
    const newC = {
      id: 'c' + Date.now(),
      author: 'fluttershy', avatar: 'F', color: 'oklch(0.72 0.14 340)',
      text: draft, likes: 0, time: 'сейчас', replies: [],
    };
    if (replyTo) {
      setComments(comments.map(c => c.id === replyTo ? { ...c, replies: [...(c.replies || []), newC] } : c));
      setReplyTo(null);
    } else {
      setComments([newC, ...comments]);
    }
    setDraft('');
    onShowToast('комментарий добавлен');
  };

  const toggleLikeC = (id, parentId) => {
    const flip = (c) => ({ ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) });
    if (parentId) {
      setComments(comments.map(c => c.id === parentId ? { ...c, replies: c.replies.map(r => r.id === id ? flip(r) : r) } : c));
    } else {
      setComments(comments.map(c => c.id === id ? flip(c) : c));
    }
  };

  const sortedComments = React.useMemo(() => {
    const arr = [...comments];
    if (sortComments === 'top') arr.sort((a, b) => b.likes - a.likes);
    if (sortComments === 'new') arr.sort((a, b) => (b.id > a.id ? 1 : -1));
    return arr;
  }, [comments, sortComments]);

  const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
  const related = allPosts.filter(p => p.id !== post.id && p.tags?.some(t => post.tags?.includes(t))).slice(0, 4);

  return (
    <React.Fragment>
      <div style={{ minWidth: 0 }}>
        <button onClick={onBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none',
          color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)',
          cursor: 'pointer', padding: '6px 0', marginBottom: 10,
        }}>← назад к ленте</button>

        {/* Author + meta */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Avatar name={post.author.name} color={post.author.color} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 14 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{post.author.name}</span>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{post.author.handle}</span>
              <span style={{ color: 'var(--text-3)' }}>·</span>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{timeAgo(post.createdAt)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {post.type === 'sale' ? '💰 продаю' : post.type === 'question' ? '❓ вопрос' : post.type === 'meme' ? '😄 мем' : '📝 текст'}
            </div>
          </div>
          <Button variant="secondary" size="sm" icon="plus">Подписаться</Button>
        </header>

        {/* Title + body */}
        <h1 style={{
          margin: '0 0 14px', fontSize: 26, fontWeight: 700,
          color: 'var(--text-1)', letterSpacing: '-0.015em',
          lineHeight: 1.25, textWrap: 'pretty',
        }}>{post.title}</h1>

        {post.body && (
          <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.65, color: 'var(--text-2)', textWrap: 'pretty' }}>
            {post.body}
          </p>
        )}

        {/* Media */}
        {post.media?.kind === 'video' && (
          <div style={{ marginBottom: 16 }}>
            <VideoCard seed={post.media.poster} label={post.media.label} />
          </div>
        )}
        {post.media?.kind === 'image' && (
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <MediaPlaceholder seed={post.media.poster} kind="image" label={post.media.label} aspectRatio="16/9" />
            {post.type === 'sale' && post.price && (
              <div style={{
                position: 'absolute', left: 12, bottom: 12, right: 12,
                background: 'oklch(0.18 0.01 60 / 0.9)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{post.price}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>с доставкой по РФ</div>
                </div>
                <Button variant="primary" icon="cart">В корзину</Button>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
            {post.tags.map(t => <Tag key={t} onClick={() => onTagClick?.(t)}>{t}</Tag>)}
          </div>
        )}

        {/* Action bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '12px 0',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          marginBottom: 24,
        }}>
          <ActionButton icon="heart" label={formatNum(post.likes + (post.liked ? 1 : 0))} active={post.liked} activeColor="oklch(0.65 0.22 25)" onClick={() => onLike(post.id)} />
          <ActionButton icon="comment" label={formatNum(totalComments)} />
          <ActionButton icon="bookmark" label={formatNum(post.saves + (post.saved ? 1 : 0))} active={post.saved} activeColor="var(--accent)" onClick={() => onSave(post.id)} />
          <div style={{ flex: 1 }} />
          <ActionButton icon="share" onClick={() => onShowToast('ссылка скопирована')} />
        </div>

        {/* Comments header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>
            Комментарии <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 400 }}>{totalComments}</span>
          </h2>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'inline-flex', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
            <SortBtn active={sortComments === 'top'} onClick={() => setSortComments('top')}>популярные</SortBtn>
            <SortBtn active={sortComments === 'new'} onClick={() => setSortComments('new')}>новые</SortBtn>
          </div>
        </div>

        {/* Composer */}
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 12,
          display: 'flex', gap: 10, alignItems: 'flex-start',
          marginBottom: 18,
        }}>
          <Avatar name="fluttershy" color="oklch(0.72 0.14 340)" size={32} />
          <div style={{ flex: 1 }}>
            {replyTo && (
              <div style={{
                fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--text-3)', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>отвечаете {comments.find(c => c.id === replyTo)?.author}</span>
                <button onClick={() => setReplyTo(null)} style={{
                  background: 'transparent', border: 'none', color: 'var(--accent)',
                  cursor: 'pointer', fontSize: 11, padding: 0,
                }}>отменить ✕</button>
              </div>
            )}
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
              placeholder="напишите комментарий…"
              rows={2}
              style={{
                width: '100%', background: 'var(--bg-2)',
                border: '1px solid var(--border)', borderRadius: 6,
                padding: '8px 10px', color: 'var(--text-1)', fontSize: 13,
                fontFamily: 'var(--font-ui)', resize: 'none', outline: 'none', lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                поддерживается markdown · ⌘+Enter
              </span>
              <div style={{ flex: 1 }} />
              <Button variant="ghost" size="sm" onClick={() => { setDraft(''); setReplyTo(null); }}>Очистить</Button>
              <Button variant="primary" size="sm" icon="check" onClick={submit}>Отправить</Button>
            </div>
          </div>
        </div>

        {/* Comments list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sortedComments.map(c => (
            <CommentItem
              key={c.id} c={c}
              onReply={() => setReplyTo(c.id)}
              onLike={() => toggleLikeC(c.id)}
              onLikeReply={(rid) => toggleLikeC(rid, c.id)}
            />
          ))}
        </div>
      </div>

      {/* Sidebar — author + related */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 110 }}>
        <AuthorMiniCard author={post.author} />
        {related.length > 0 && <RelatedCard posts={related} onOpen={onOpenPost} />}
      </aside>
    </React.Fragment>
  );
};

const SortBtn = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    padding: '4px 10px',
    background: active ? 'var(--bg-3)' : 'transparent',
    border: 'none', borderRadius: 4,
    color: active ? 'var(--accent)' : 'var(--text-3)',
    fontSize: 11, fontFamily: 'var(--font-mono)',
    fontWeight: active ? 600 : 400, cursor: 'pointer',
  }}>{children}</button>
);

const CommentItem = ({ c, onReply, onLike, onLikeReply }) => (
  <div style={{ display: 'flex', gap: 10 }}>
    <Avatar name={c.author} color={c.color} size={32} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{c.author}</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{c.time}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)', textWrap: 'pretty' }}>{c.text}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <button onClick={onLike} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'transparent', border: 'none',
          color: c.liked ? 'oklch(0.65 0.22 25)' : 'var(--text-3)',
          fontSize: 11, fontFamily: 'var(--font-mono)',
          cursor: 'pointer', padding: '4px 6px', borderRadius: 4,
        }}>
          <Icon name="heart" size={12} className={c.liked ? 'icon-fill' : ''} />
          {c.likes}
        </button>
        <button onClick={onReply} style={{
          background: 'transparent', border: 'none',
          color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)',
          cursor: 'pointer', padding: '4px 6px', borderRadius: 4,
        }}>↳ ответить</button>
      </div>
      {c.replies?.length > 0 && (
        <div style={{ marginTop: 12, paddingLeft: 14, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {c.replies.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 8 }}>
              <Avatar name={r.author} color={r.color} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{r.author}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{r.time}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--text-2)' }}>{r.text}</p>
                <button onClick={() => onLikeReply(r.id)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'transparent', border: 'none',
                  color: r.liked ? 'oklch(0.65 0.22 25)' : 'var(--text-3)',
                  fontSize: 10, fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', padding: '3px 6px', marginTop: 3, borderRadius: 4,
                }}>
                  <Icon name="heart" size={11} className={r.liked ? 'icon-fill' : ''} />
                  {r.likes}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const AuthorMiniCard = ({ author }) => (
  <div style={{
    background: 'var(--bg-1)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 14,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <Avatar name={author.name} color={author.color} size={40} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{author.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{author.handle}</div>
      </div>
    </div>
    <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
      Автор поста · 42 публикации · 1.2k подписчиков
    </p>
    <div style={{ display: 'flex', gap: 6 }}>
      <Button variant="primary" size="sm" icon="plus" full>Подписаться</Button>
      <Button variant="secondary" size="sm" icon="comment">DM</Button>
    </div>
  </div>
);

const RelatedCard = ({ posts, onOpen }) => (
  <div style={{
    background: 'var(--bg-1)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 14,
  }}>
    <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Похожие посты</h4>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {posts.map(p => (
        <button key={p.id} onClick={() => onOpen(p.id)} style={{
          display: 'flex', gap: 10, padding: '8px 6px',
          background: 'transparent', border: 'none', borderRadius: 5,
          cursor: 'pointer', textAlign: 'left', width: '100%',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Avatar name={p.author.name} color={p.author.color} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.35, fontWeight: 500,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>{p.title}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              ♥ {formatNum(p.likes)} · 💬 {formatNum(p.comments)}
            </div>
          </div>
        </button>
      ))}
    </div>
  </div>
);

window.PostFullPage = PostFullPage;
