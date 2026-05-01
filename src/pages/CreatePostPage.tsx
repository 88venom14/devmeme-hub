import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { labelStyle, inputStyle } from '../styles/forms';
import { useSessionContext } from '../context/SessionContext';
import { useInvalidatePosts } from '../hooks/useInvalidatePosts';
import { useMyProfile } from '../hooks/useMyProfile';
import { uploadPostMedia } from '../lib/storage';
import { parseTags, attachTagsToPost } from '../lib/tags';
import { LIMITS, isValidGithubUrl } from '../lib/validation';
import MarkdownContent from '../components/MarkdownContent';
import Avatar from '../components/Avatar';
import { Code, ExternalLink } from 'lucide-react';

/* ── live preview ── */
const PostPreview = memo(({
  title, content, imageObjectUrl, videoObjectUrl, githubUrl, tags, displayName, username, avatarUrl,
}: {
  title: string; content: string;
  imageObjectUrl: string | null; videoObjectUrl: string | null;
  githubUrl: string; tags: string[];
  displayName: string; username: string; avatarUrl: string | null;
}) => {
  const hasContent = title || content || imageObjectUrl || videoObjectUrl || githubUrl || tags.length > 0;

  if (!hasContent) {
    return (
      <div style={{
        background: 'var(--bg-1)', border: '1px dashed var(--border)',
        borderRadius: 'var(--card-radius)', padding: 24,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 10, minHeight: 200,
        color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12,
        textAlign: 'center',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
        </svg>
        начните вводить — здесь появится предпросмотр
      </div>
    );
  }

  return (
    <article style={{
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      borderRadius: 'var(--card-radius)', padding: 16,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Author */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Avatar src={avatarUrl} name={displayName || username} size={34} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            {displayName || username || 'вы'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            @{username || 'username'} · только что
          </div>
        </div>
      </header>

      {/* Title */}
      {title && (
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: 'var(--text-1)' }}>
          {title}
        </h2>
      )}

      {/* Content / markdown */}
      {content && (
        <div style={{ fontSize: 13 }}>
          <MarkdownContent>{content}</MarkdownContent>
        </div>
      )}

      {/* Image */}
      {imageObjectUrl && (
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', backgroundColor: 'var(--bg-2)', textAlign: 'center' }}>
          <img src={imageObjectUrl} alt="превью"
            style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
        </div>
      )}

      {/* Video */}
      {!imageObjectUrl && videoObjectUrl && (
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <video src={videoObjectUrl} controls
            style={{ width: '100%', maxHeight: 260, display: 'block', backgroundColor: '#000' }} />
        </div>
      )}

      {/* GitHub */}
      {githubUrl && isValidGithubUrl(githubUrl) && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Code size={14} style={{ color: 'var(--text-3)' }} />
              <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>
                {githubUrl.replace('https://github.com/', '')}
              </span>
            </div>
            <ExternalLink size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tags.map((t) => (
            <span key={t} style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Action bar (decorative) */}
      <footer style={{
        display: 'flex', alignItems: 'center', gap: 4,
        paddingTop: 8, borderTop: '1px solid var(--border)',
        marginTop: 'auto',
      }}>
        {[
          { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11h-2z" /></svg>, label: '0' },
          { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-12 7l-5 1 1-5A8 8 0 1 1 21 12z" /></svg>, label: '0' },
          { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>, label: null },
        ].map((btn, i) => (
          <div key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 8px', borderRadius: 5,
            color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)',
            opacity: 0.5,
          }}>
            {btn.icon}
            {btn.label != null && <span>{btn.label}</span>}
          </div>
        ))}
      </footer>
    </article>
  );
});
PostPreview.displayName = 'PostPreview';

/* ── main page ── */
const CreatePostPage: React.FC = memo(() => {
  const navigate = useNavigate();
  const session = useSessionContext();
  const invalidatePosts = useInvalidatePosts();
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'editor' | 'preview'>('editor');

  /* blob URLs for preview — revoke on change/unmount to avoid memory leaks */
  const imageObjectUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);
  const videoObjectUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);
  useEffect(() => () => { if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl); }, [imageObjectUrl]);
  useEffect(() => () => { if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl); }, [videoObjectUrl]);

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);
  const githubUrlInvalid = useMemo(() => !!githubUrl.trim() && !isValidGithubUrl(githubUrl.trim()), [githubUrl]);
  const isOverLimit = useMemo(
    () => title.length > LIMITS.title || content.length > LIMITS.content || tags.length > LIMITS.maxTags,
    [title.length, content.length, tags.length],
  );

  const { data: profile } = useMyProfile(session?.user.id);

  const createPost = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Необходимо войти в аккаунт');
      if (title.trim().length > LIMITS.title) throw new Error(`Заголовок: максимум ${LIMITS.title} символов`);
      if (content.length > LIMITS.content) throw new Error(`Контент: максимум ${LIMITS.content} символов`);
      if (githubUrlInvalid) throw new Error('Ссылка на GitHub должна быть https://github.com/...');
      if (tags.length > LIMITS.maxTags) throw new Error(`Максимум ${LIMITS.maxTags} тегов`);

      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      if (imageFile) imageUrl = await uploadPostMedia(imageFile, user.id);
      if (videoFile) videoUrl = await uploadPostMedia(videoFile, user.id);

      const { data, error } = await supabase
        .from('posts')
        .insert({ user_id: user.id, title: title.trim(), content_md: content.trim() || null, github_url: githubUrl.trim() || null, image_url: imageUrl, video_url: videoUrl })
        .select().single();
      if (error) throw error;
      if (tags.length > 0) await attachTagsToPost(data.id, tags);
      return data;
    },
    onSuccess: (data) => { invalidatePosts(); navigate(`/post/${data.id}`); },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || createPost.isPending || isOverLimit || githubUrlInvalid) return;
    setErrorMsg(null);
    createPost.mutate();
  }, [title, createPost, isOverLimit, githubUrlInvalid]);

  const canSubmit = !!title.trim() && !createPost.isPending && !isOverLimit && !githubUrlInvalid;

  const tabBtn = (label: string, target: 'editor' | 'preview') => (
    <button
      type="button"
      onClick={() => setMode(target)}
      style={{
        padding: '6px 16px',
        background: mode === target ? 'var(--accent)' : 'transparent',
        border: `1px solid ${mode === target ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 7, cursor: 'pointer',
        color: mode === target ? 'oklch(0.15 0.01 60)' : 'var(--text-3)',
        fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: mode === target ? 600 : 400,
        transition: 'all 0.15s',
      }}
    >{label}</button>
  );

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-1)' }}>
          Новый пост
        </h1>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {tabBtn('Редактор', 'editor')}
          {tabBtn('Превью', 'preview')}
        </div>
      </div>

      {/* ── EDITOR ── */}
      {mode === 'editor' && (
        <div style={{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--card-radius)', padding: 20,
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Title */}
            <div>
              <label style={labelStyle}>
                Заголовок
                {title.length >= LIMITS.title * 0.8 && (
                  <span style={{ marginLeft: 8, color: title.length > LIMITS.title ? 'var(--error)' : 'var(--text-3)' }}>
                    {title.length}/{LIMITS.title}
                  </span>
                )}
              </label>
              <input
                type="text" placeholder="Дайте посту заголовок…"
                style={{ ...inputStyle, borderColor: title.length > LIMITS.title ? 'var(--error)' : undefined }}
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title + 20))}
                required autoFocus
              />
            </div>

            {/* Content */}
            <div>
              <label style={labelStyle}>
                Контент · markdown
                {content.length >= LIMITS.content * 0.8 && (
                  <span style={{ marginLeft: 8, color: content.length > LIMITS.content ? 'var(--error)' : 'var(--text-3)' }}>
                    {content.length}/{LIMITS.content}
                  </span>
                )}
              </label>
              <textarea
                placeholder="Поделитесь мыслями, сниппетами или описанием…"
                style={{
                  ...inputStyle, minHeight: 160, resize: 'vertical', lineHeight: 1.55,
                  borderColor: content.length > LIMITS.content ? 'var(--error)' : undefined,
                }}
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, LIMITS.content + 100))}
              />
            </div>

            {/* GitHub */}
            <div>
              <label style={labelStyle}>GitHub репозиторий</label>
              <div style={{ position: 'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}>
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.01c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.21-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.05.78 2.12v3.14c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                </svg>
                <input
                  type="text" placeholder="https://github.com/username/repo"
                  style={{ ...inputStyle, paddingLeft: 32, borderColor: githubUrlInvalid ? 'var(--error)' : undefined }}
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value.slice(0, LIMITS.githubUrl))}
                />
              </div>
              {githubUrlInvalid && (
                <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  Только ссылки на github.com
                </p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>
                Теги
                {tags.length > 0 && (
                  <span style={{ marginLeft: 8, color: tags.length > LIMITS.maxTags ? 'var(--error)' : 'var(--text-3)' }}>
                    {tags.length}/{LIMITS.maxTags}
                  </span>
                )}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 14, pointerEvents: 'none' }}>#</span>
                <input
                  type="text" placeholder="react, typescript, supabase"
                  style={{ ...inputStyle, paddingLeft: 26 }}
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value.slice(0, LIMITS.tagsInput))}
                />
              </div>
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {tags.map((t) => (
                    <span key={t} style={{
                      padding: '3px 10px', background: 'var(--bg-2)',
                      border: '1px solid var(--border)', borderRadius: 999,
                      fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
                    }}>#{t}</span>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                через запятую или пробел · макс. {LIMITS.maxTags}
              </p>
            </div>

            {/* Media */}
            <div>
              <label style={labelStyle}>Медиа</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input ref={imageInput} type="file" accept="image/*" hidden
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                <input ref={videoInput} type="file" accept="video/*" hidden
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />

                <button type="button" onClick={() => imageInput.current?.click()}
                  style={{
                    flex: 1, padding: '10px 8px',
                    background: imageFile ? 'oklch(0.25 0.04 145 / 0.3)' : 'var(--bg-2)',
                    border: `1px solid ${imageFile ? 'oklch(0.55 0.15 145)' : 'var(--border)'}`,
                    borderRadius: 8, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    color: imageFile ? 'oklch(0.75 0.15 145)' : 'var(--text-3)',
                    fontSize: 12, fontFamily: 'var(--font-ui)',
                    transition: 'all 0.15s',
                  }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m3 17 6-6 11 11" />
                  </svg>
                  {imageFile ? imageFile.name.slice(0, 18) + (imageFile.name.length > 18 ? '…' : '') : 'Фото'}
                </button>

                <button type="button" onClick={() => videoInput.current?.click()}
                  style={{
                    flex: 1, padding: '10px 8px',
                    background: videoFile ? 'oklch(0.25 0.04 220 / 0.3)' : 'var(--bg-2)',
                    border: `1px solid ${videoFile ? 'oklch(0.55 0.15 220)' : 'var(--border)'}`,
                    borderRadius: 8, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    color: videoFile ? 'oklch(0.75 0.15 220)' : 'var(--text-3)',
                    fontSize: 12, fontFamily: 'var(--font-ui)',
                    transition: 'all 0.15s',
                  }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 9 5-3v12l-5-3z" />
                  </svg>
                  {videoFile ? videoFile.name.slice(0, 18) + (videoFile.name.length > 18 ? '…' : '') : 'Видео'}
                </button>

                {(imageFile || videoFile) && (
                  <button type="button"
                    onClick={() => { setImageFile(null); setVideoFile(null); }}
                    style={{
                      padding: '10px 12px', background: 'transparent',
                      border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                      color: 'var(--text-3)', fontSize: 12,
                    }}
                    title="Удалить медиа">✕</button>
                )}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, fontFamily: 'var(--font-mono)' }}>
                макс. 50 МБ · PNG / JPG / GIF / WEBP / MP4 / WEBM
              </p>
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--error)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{errorMsg}</div>
            )}

            {/* Actions */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              paddingTop: 16, borderTop: '1px solid var(--border)',
            }}>
              <button type="button" onClick={() => navigate(-1)}
                style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '9px 18px', fontSize: 13, fontFamily: 'var(--font-ui)',
                  color: 'var(--text-1)', cursor: 'pointer',
                }}>
                Отмена
              </button>
              <button type="submit" disabled={!canSubmit}
                style={{
                  background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 8,
                  padding: '9px 20px', fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 600,
                  color: 'oklch(0.15 0.01 60)', cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.5,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {createPost.isPending ? 'Публикация…' : 'Опубликовать'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {mode === 'preview' && (
        <div>
          <PostPreview
            title={title}
            content={content}
            imageObjectUrl={imageObjectUrl}
            videoObjectUrl={videoObjectUrl}
            githubUrl={githubUrl.trim()}
            tags={tags}
            displayName={profile?.display_name || ''}
            username={profile?.username || session?.user.email?.split('@')[0] || ''}
            avatarUrl={profile?.avatar_url ?? null}
          />

          {/* Action bar shown in preview mode */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16,
          }}>
            <button type="button" onClick={() => navigate(-1)}
              style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '9px 18px', fontSize: 13, fontFamily: 'var(--font-ui)',
                color: 'var(--text-1)', cursor: 'pointer',
              }}>
              Отмена
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); if (!title.trim() || createPost.isPending || isOverLimit || githubUrlInvalid) return; setErrorMsg(null); createPost.mutate(); }}
              disabled={!canSubmit}
              style={{
                background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 8,
                padding: '9px 20px', fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 600,
                color: 'oklch(0.15 0.01 60)', cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {createPost.isPending ? 'Публикация…' : 'Опубликовать'}
            </button>
          </div>
          {errorMsg && (
            <div style={{ color: 'var(--error)', fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 8, textAlign: 'right' }}>{errorMsg}</div>
          )}
        </div>
      )}
    </div>
  );
});

CreatePostPage.displayName = 'CreatePostPage';
export default CreatePostPage;
