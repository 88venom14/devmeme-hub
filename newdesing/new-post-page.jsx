// Full-page "New Post" — markdown editor with preview, github link, tag chips, media upload

const NewPostPage = ({ onSubmit, onCancel }) => {
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [github, setGithub] = React.useState('');
  const [tagsRaw, setTagsRaw] = React.useState('');
  const [type, setType] = React.useState('text');
  const [media, setMedia] = React.useState(null);
  const [showPreview, setShowPreview] = React.useState(false);

  const tags = tagsRaw.split(/[,\s]+/).filter(Boolean).slice(0, 10);

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      id: 'p' + Date.now(),
      author: { name: 'fluttershy', handle: '@fluttershy', color: 'oklch(0.72 0.14 340)' },
      title,
      body: content || null,
      github: github || null,
      media,
      tags: tags.map(t => t.startsWith('#') ? t : '#' + t),
      likes: 0, comments: 0, saves: 0, liked: false, saved: false,
      createdAt: Date.now(),
      type,
    });
  };

  // Tiny markdown renderer (headings, bold, italic, code, lists, links)
  const renderMd = (md) => {
    if (!md) return <p style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>пусто</p>;
    const html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<)(.+)$/gm, '$1');
    return <div className="md" dangerouslySetInnerHTML={{ __html: '<p>' + html + '</p>' }} />;
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Новый пост</h1>
        <div style={{ flex: 1 }} />
        <div style={{
          display: 'inline-flex', background: 'var(--bg-1)',
          border: '1px solid var(--border)', borderRadius: 6, padding: 2,
        }}>
          <SegBtn active={!showPreview} onClick={() => setShowPreview(false)}>Редактор</SegBtn>
          <SegBtn active={showPreview} onClick={() => setShowPreview(true)}>Превью</SegBtn>
        </div>
      </div>

      {/* Type selector */}
      <Card title="Тип поста">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'text', label: 'Статья' },
            { id: 'meme', label: 'Мем' },
            { id: 'question', label: 'Вопрос' },
            { id: 'sale', label: 'Продажа' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              style={{
                padding: '6px 12px',
                background: type === t.id ? 'oklch(0.65 0.18 var(--accent-h, 50) / 0.15)' : 'var(--bg-2)',
                border: `1px solid ${type === t.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 6,
                color: type === t.id ? 'var(--accent)' : 'var(--text-2)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              }}
            >{t.label}</button>
          ))}
        </div>
      </Card>

      {!showPreview ? (
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 18, marginBottom: 16,
        }}>
          <Field label="Заголовок">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Дайте посту заголовок..."
              maxLength={120}
              style={{ ...inputStyle, fontSize: 14, fontFamily: 'var(--font-ui)' }}
            />
            <div style={{
              fontSize: 10, color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)', textAlign: 'right', marginTop: 4,
            }}>{title.length}/120</div>
          </Field>

          <Field label={<span>Контент <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(поддерживается Markdown)</span></span>}>
            <textarea
              rows={8}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Поделитесь мыслями, сниппотами или описанием проекта..."
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontSize: 13 }}
            />
            <div style={{
              display: 'flex', gap: 10, marginTop: 6,
              fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            }}>
              <span><b>**жирный**</b></span>
              <span><i>*курсив*</i></span>
              <span><code style={{ background: 'var(--bg-2)', padding: '0 4px', borderRadius: 3 }}>`код`</code></span>
              <span># заголовок</span>
              <span>- список</span>
            </div>
          </Field>

          <Field label={<span><span style={{ fontFamily: 'var(--font-mono)' }}>○</span> Ссылка на GitHub репозиторий</span>}>
            <div style={inputWrap}>
              <span style={prefixStyle}>⌘</span>
              <input
                value={github}
                onChange={e => setGithub(e.target.value)}
                placeholder="https://github.com/username/repo"
                style={{ ...inputStyle, paddingLeft: 30 }}
              />
            </div>
          </Field>

          <Field label="Теги">
            <div style={inputWrap}>
              <span style={prefixStyle}>#</span>
              <input
                value={tagsRaw}
                onChange={e => setTagsRaw(e.target.value)}
                placeholder="react, typescript, supabase"
                style={{ ...inputStyle, paddingLeft: 26 }}
              />
            </div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                {tags.map(t => (
                  <span key={t} style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    background: 'oklch(0.65 0.18 var(--accent-h, 50) / 0.12)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    padding: '2px 8px', borderRadius: 999,
                  }}>#{t.replace(/^#/, '')}</span>
                ))}
              </div>
            )}
            <div style={{
              fontSize: 10, color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)', marginTop: 6,
            }}>Через запятую или пробел. Макс. 10 тегов, каждый до 30 символов.</div>
          </Field>

          <Field label="Медиа">
            {!media ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <UploadBox icon="image" label="Загрузить фото" onClick={() => setMedia({ kind: 'image', poster: 'upload-' + Math.random(), label: 'photo.png' })} />
                <UploadBox icon="video" label="Загрузить видео" onClick={() => setMedia({ kind: 'video', poster: 'upload-' + Math.random(), label: 'video.mp4' })} />
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <MediaPlaceholder seed={media.poster} kind={media.kind} label={media.label} aspectRatio="16/9" />
                <button
                  onClick={() => setMedia(null)}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'oklch(0.18 0.01 60 / 0.85)',
                    border: '1px solid var(--border)', color: 'var(--text-1)',
                    borderRadius: 5, padding: 5, cursor: 'pointer', display: 'flex',
                  }}
                ><Icon name="close" size={12} /></button>
              </div>
            )}
            <div style={{
              fontSize: 10, color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)', marginTop: 6,
            }}>Макс. 50 MB. PNG / JPG / GIF / WEBP / MP4 / WEBM / MOV.</div>
          </Field>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 22, marginBottom: 16, minHeight: 300,
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: 'var(--text-1)', textWrap: 'pretty' }}>
            {title || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>заголовок поста</span>}
          </h2>
          <div className="md" style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-2)' }}>
            {renderMd(content)}
          </div>
          {github && (
            <a href={github} target="_blank" rel="noopener" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              marginTop: 16, padding: '8px 12px',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-1)', textDecoration: 'none',
              fontSize: 12, fontFamily: 'var(--font-mono)',
            }}>
              <span>○</span> {github.replace('https://', '')}
            </a>
          )}
          {media && (
            <div style={{ marginTop: 14 }}>
              <MediaPlaceholder seed={media.poster} kind={media.kind} label={media.label} aspectRatio="16/9" />
            </div>
          )}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 14 }}>
              {tags.map(t => <Tag key={t}>#{t.replace(/^#/, '')}</Tag>)}
            </div>
          )}
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        padding: '12px 0',
      }}>
        <Button variant="ghost" icon="close" onClick={onCancel}>Отмена</Button>
        <Button variant="secondary">Сохранить как черновик</Button>
        <Button variant="primary" icon="check" onClick={submit}>Опубликовать</Button>
      </div>
    </div>
  );
};

const SegBtn = ({ children, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '4px 12px',
    background: active ? 'var(--bg-3)' : 'transparent',
    border: 'none', borderRadius: 4,
    color: active ? 'var(--accent)' : 'var(--text-3)',
    fontSize: 12, fontFamily: 'var(--font-ui)',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  }}>{children}</button>
);

const UploadBox = ({ icon, label, onClick }) => (
  <button onClick={onClick} style={{
    height: 100,
    background: 'var(--bg-2)',
    border: '1px dashed var(--border-2)',
    borderRadius: 8,
    color: 'var(--text-2)',
    cursor: 'pointer',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 8, fontSize: 12, fontFamily: 'var(--font-ui)',
    transition: 'all 0.15s',
  }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-2)'; }}
  >
    <Icon name={icon} size={22} />
    <span>{label}</span>
  </button>
);

window.NewPostPage = NewPostPage;
