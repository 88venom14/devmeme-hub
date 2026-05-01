// Modals: post detail + create post

const PostDetailModal = ({ post, onClose, onLike, onSave }) => {
  const [comments, setComments] = React.useState(SAMPLE_COMMENTS);
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!post) return null;

  const submit = () => {
    if (!draft.trim()) return;
    setComments([...comments, {
      id: 'c' + Date.now(),
      author: 'fluttershy', avatar: 'F', color: 'oklch(0.72 0.14 340)',
      text: draft, likes: 0, time: 'сейчас',
    }]);
    setDraft('');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'oklch(0.1 0.01 60 / 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          width: '100%', maxWidth: 720, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out',
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <Avatar name={post.author.name} color={post.author.color} size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{post.author.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {post.author.handle} · {timeAgo(post.createdAt)}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-2)', borderRadius: 6, padding: 6, cursor: 'pointer',
            display: 'flex',
          }}>
            <Icon name="close" size={14} />
          </button>
        </header>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '16px 18px' }}>
            <h2 style={{
              margin: '0 0 10px', fontSize: 20, fontWeight: 600,
              color: 'var(--text-1)', lineHeight: 1.3, textWrap: 'pretty',
            }}>{post.title}</h2>
            {post.body && (
              <p style={{
                margin: '0 0 14px', fontSize: 14, lineHeight: 1.6,
                color: 'var(--text-2)', textWrap: 'pretty',
              }}>{post.body}</p>
            )}
            {post.media?.kind === 'video' && (
              <VideoCard seed={post.media.poster} label={post.media.label} />
            )}
            {post.media?.kind === 'image' && (
              <MediaPlaceholder seed={post.media.poster} kind="image" label={post.media.label} aspectRatio="16/10" />
            )}

            {post.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
                {post.tags.map(t => <Tag key={t}>{t}</Tag>)}
              </div>
            )}

            <div style={{
              display: 'flex', gap: 4, marginTop: 14,
              paddingTop: 12, borderTop: '1px solid var(--border)',
            }}>
              <ActionButton icon="heart" label={formatNum(post.likes + (post.liked ? 1 : 0))} active={post.liked} activeColor="oklch(0.65 0.22 25)" onClick={() => onLike(post.id)} />
              <ActionButton icon="comment" label={formatNum(post.comments)} />
              <ActionButton icon="bookmark" label={formatNum(post.saves + (post.saved ? 1 : 0))} active={post.saved} activeColor="var(--accent)" onClick={() => onSave(post.id)} />
              <div style={{ flex: 1 }} />
              <ActionButton icon="share" />
            </div>
          </div>

          {/* Comments */}
          <div style={{
            background: 'var(--bg-0)',
            padding: '14px 18px',
            borderTop: '1px solid var(--border)',
          }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600,
              color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>{comments.length} комментариев</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                  <Avatar name={c.author} color={c.color} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{c.author}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{c.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)' }}>{c.text}</p>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <ActionButton icon="heart" label={c.likes} />
                      <button style={{
                        background: 'transparent', border: 'none',
                        color: 'var(--text-3)', fontSize: 11,
                        cursor: 'pointer', padding: '5px 8px',
                        fontFamily: 'var(--font-mono)',
                      }}>ответить</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comment input */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-1)',
          display: 'flex', gap: 10, alignItems: 'flex-end',
        }}>
          <Avatar name="fluttershy" color="oklch(0.72 0.14 340)" size={28} />
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder="ваш комментарий…  (⌘+Enter)"
            rows={1}
            style={{
              flex: 1,
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '7px 10px',
              color: 'var(--text-1)',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              resize: 'none',
              outline: 'none',
              minHeight: 32,
            }}
          />
          <Button variant="primary" size="md" onClick={submit}>Отправить</Button>
        </div>
      </div>
    </div>
  );
};

const CreatePostModal = ({ onClose, onSubmit }) => {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [tags, setTags] = React.useState('');
  const [type, setType] = React.useState('meme');
  const [mediaType, setMediaType] = React.useState(null);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const submit = () => {
    if (!title.trim()) return;
    const tagList = tags.split(/[\s,]+/).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t);
    onSubmit({
      id: 'p' + Date.now(),
      author: { name: 'fluttershy', handle: '@fluttershy', avatar: 'F', color: 'oklch(0.72 0.14 340)' },
      title, body: body || null,
      media: mediaType ? { kind: mediaType, poster: 'gradient-' + Math.floor(Math.random() * 9), label: 'upload.' + (mediaType === 'video' ? 'mp4' : 'png') } : null,
      tags: tagList,
      likes: 0, comments: 0, saves: 0, liked: false, saved: false,
      createdAt: Date.now(),
      type,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'oklch(0.1 0.01 60 / 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          width: '100%', maxWidth: 560,
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.2s ease-out',
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-1)', flex: 1 }}>Новый пост</h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-2)', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex',
          }}>
            <Icon name="close" size={14} />
          </button>
        </header>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Type selector */}
          <div>
            <Label>Тип поста</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'meme', label: 'Мем' },
                { id: 'text', label: 'Текст' },
                { id: 'question', label: 'Вопрос' },
                { id: 'sale', label: 'Продажа' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  style={{
                    padding: '7px 14px',
                    background: type === t.id ? 'var(--bg-3)' : 'var(--bg-2)',
                    border: `1px solid ${type === t.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 6,
                    color: type === t.id ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                    transition: 'all 0.12s',
                  }}
                >{t.label}</button>
              ))}
            </div>
          </div>

          <div>
            <Label>Заголовок</Label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="о чём этот пост?"
              style={{
                width: '100%',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 10px',
                color: 'var(--text-1)',
                fontSize: 14,
                fontFamily: 'var(--font-ui)',
                outline: 'none',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>

          <div>
            <Label>Описание <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(необязательно)</span></Label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="расскажи подробнее…"
              rows={3}
              style={{
                width: '100%',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 10px',
                color: 'var(--text-1)',
                fontSize: 13,
                fontFamily: 'var(--font-ui)',
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Media uploader */}
          <div>
            <Label>Медиа</Label>
            {!mediaType ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <UploadButton icon="image" label="Изображение" onClick={() => setMediaType('image')} />
                <UploadButton icon="video" label="Видео" onClick={() => setMediaType('video')} />
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <MediaPlaceholder seed={'preview-' + mediaType} kind={mediaType} label={`${mediaType}.${mediaType === 'video' ? 'mp4' : 'png'}`} aspectRatio="16/9" />
                <button
                  onClick={() => setMediaType(null)}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'oklch(0.18 0.01 60 / 0.85)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                    borderRadius: 5, padding: 5, cursor: 'pointer',
                    display: 'flex',
                  }}
                ><Icon name="close" size={12} /></button>
              </div>
            )}
          </div>

          <div>
            <Label>Теги</Label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="#dev #meme #friday  (через пробел)"
              style={{
                width: '100%',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 10px',
                color: 'var(--text-1)',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <footer style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" icon="check" onClick={submit}>Опубликовать</Button>
        </footer>
      </div>
    </div>
  );
};

const Label = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 600,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 6,
  }}>{children}</div>
);

const UploadButton = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1, height: 80,
      background: 'var(--bg-2)',
      border: '1px dashed var(--border-2)',
      borderRadius: 8,
      color: 'var(--text-2)',
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 6,
      fontSize: 12,
      fontFamily: 'var(--font-ui)',
      transition: 'all 0.12s',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-2)'; }}
  >
    <Icon name={icon} size={20} />
    {label}
  </button>
);

window.PostDetailModal = PostDetailModal;
window.CreatePostModal = CreatePostModal;
