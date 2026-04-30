import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Send, Image as ImageIcon, Video, Link as LinkIcon, X, Hash, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useInvalidatePosts } from '../hooks/useInvalidatePosts';
import { uploadPostMedia } from '../lib/storage';
import { parseTags, attachTagsToPost } from '../lib/tags';
import { LIMITS, isValidGithubUrl } from '../lib/validation';

const CharCount = memo(({ value, max }: { value: string; max: number }) => {
  const len = value.length;
  if (len < max * 0.8) return null;
  return (
    <span className="mono" style={{ fontSize: '11px', color: len > max ? 'var(--error)' : 'var(--text-secondary)', marginLeft: '8px' }}>
      {len}/{max}
    </span>
  );
});
CharCount.displayName = 'CharCount';

const MediaPreview = memo(({ file, kind, onClear }: { file: File; kind: 'image' | 'video'; onClear: () => void }) => {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  return (
    <div style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {kind === 'image' ? (
        <img src={url} alt="превью" style={{ width: '100%', display: 'block' }} />
      ) : (
        <video src={url} controls style={{ width: '100%', display: 'block', backgroundColor: '#000' }} />
      )}
      <button
        type="button"
        onClick={onClear}
        title="Удалить"
        style={{ position: 'absolute', top: 8, right: 8, padding: 6, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
});
MediaPreview.displayName = 'MediaPreview';

const CreatePostPage: React.FC = memo(() => {
  const navigate = useNavigate();
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

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);

  const githubUrlInvalid = useMemo(
    () => !!githubUrl.trim() && !isValidGithubUrl(githubUrl.trim()),
    [githubUrl],
  );

  const isOverLimit = useMemo(
    () => title.length > LIMITS.title || content.length > LIMITS.content || tags.length > LIMITS.maxTags,
    [title.length, content.length, tags.length],
  );

  const createPost = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Необходимо войти в аккаунт');
      if (title.trim().length > LIMITS.title) throw new Error(`Заголовок не может превышать ${LIMITS.title} символов`);
      if (content.length > LIMITS.content) throw new Error(`Контент не может превышать ${LIMITS.content} символов`);
      if (githubUrlInvalid) throw new Error('Ссылка на GitHub должна быть в формате https://github.com/...');
      if (tags.length > LIMITS.maxTags) throw new Error(`Максимум ${LIMITS.maxTags} тегов`);

      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      if (imageFile) imageUrl = await uploadPostMedia(imageFile, user.id);
      if (videoFile) videoUrl = await uploadPostMedia(videoFile, user.id);

      const { data, error } = await supabase
        .from('posts')
        .insert({ user_id: user.id, title: title.trim(), content_md: content.trim() || null, github_url: githubUrl.trim() || null, image_url: imageUrl, video_url: videoUrl })
        .select()
        .single();
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

  const handleCancel = useCallback(() => navigate(-1), [navigate]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    setTitle(e.target.value.slice(0, LIMITS.title + 20)), []);
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setContent(e.target.value.slice(0, LIMITS.content + 100)), []);
  const handleGithubChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    setGithubUrl(e.target.value.slice(0, LIMITS.githubUrl)), []);
  const handleTagsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    setTagsInput(e.target.value.slice(0, LIMITS.tagsInput)), []);
  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    setImageFile(e.target.files?.[0] ?? null), []);
  const handleVideoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
    setVideoFile(e.target.files?.[0] ?? null), []);
  const clearImage = useCallback(() => setImageFile(null), []);
  const clearVideo = useCallback(() => setVideoFile(null), []);
  const openImagePicker = useCallback(() => imageInput.current?.click(), []);
  const openVideoPicker = useCallback(() => videoInput.current?.click(), []);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Новый пост</h1>

      <div className="card" style={{ padding: '24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Заголовок</label>
              <CharCount value={title} max={LIMITS.title} />
            </div>
            <input
              type="text" placeholder="Дайте посту заголовок..."
              style={{ width: '100%', borderColor: title.length > LIMITS.title ? 'var(--error)' : undefined }}
              value={title} onChange={handleTitleChange} required
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Контент (поддерживается Markdown)</label>
              <CharCount value={content} max={LIMITS.content} />
            </div>
            <textarea
              placeholder="Поделитесь мыслями, сниппетами или описанием проекта..."
              style={{ width: '100%', minHeight: '200px', resize: 'vertical', borderColor: content.length > LIMITS.content ? 'var(--error)' : undefined }}
              value={content} onChange={handleContentChange} maxLength={LIMITS.content + 100}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Ссылка на GitHub репозиторий</label>
            <div style={{ position: 'relative' }}>
              <LinkIcon size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text" placeholder="https://github.com/username/repo"
                style={{ width: '100%', paddingLeft: '36px', borderColor: githubUrlInvalid ? 'var(--error)' : undefined }}
                value={githubUrl} onChange={handleGithubChange} maxLength={LIMITS.githubUrl}
              />
            </div>
            {githubUrlInvalid && (
              <p className="mono" style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>
                Только ссылки на github.com
              </p>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Теги</label>
              {tags.length > 0 && (
                <span className="mono" style={{ fontSize: '11px', color: tags.length > LIMITS.maxTags ? 'var(--error)' : 'var(--text-secondary)', marginLeft: '8px' }}>
                  {tags.length}/{LIMITS.maxTags}
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <Hash size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text" placeholder="react, typescript, supabase"
                style={{ width: '100%', paddingLeft: '36px' }}
                value={tagsInput} onChange={handleTagsChange} maxLength={LIMITS.tagsInput}
              />
            </div>
            <p className="text-secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
              Через запятую или пробел. Макс. {LIMITS.maxTags} тегов, каждый до 30 символов.
            </p>
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {tags.map((t) => (
                  <span key={t} style={{ padding: '3px 10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Медиа</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input ref={imageInput} type="file" accept="image/*" hidden onChange={handleImageChange} />
              <input ref={videoInput} type="file" accept="video/*" hidden onChange={handleVideoChange} />
              <button type="button" className="btn" onClick={openImagePicker} style={{ flex: 1, padding: '12px', flexDirection: 'column', gap: '8px' }}>
                <ImageIcon size={24} />
                <span style={{ fontSize: '12px' }}>{imageFile ? 'Изменить фото' : 'Загрузить фото'}</span>
              </button>
              <button type="button" className="btn" onClick={openVideoPicker} style={{ flex: 1, padding: '12px', flexDirection: 'column', gap: '8px' }}>
                <Video size={24} />
                <span style={{ fontSize: '12px' }}>{videoFile ? 'Изменить видео' : 'Загрузить видео'}</span>
              </button>
            </div>
            {(imageFile || videoFile) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                {imageFile && <MediaPreview file={imageFile} kind="image" onClear={clearImage} />}
                {videoFile && <MediaPreview file={videoFile} kind="video" onClear={clearVideo} />}
              </div>
            )}
            <p className="text-secondary" style={{ fontSize: '12px', marginTop: '6px' }}>
              Макс. 50 МБ. PNG / JPG / GIF / WEBP / MP4 / WEBM / MOV.
            </p>
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--error)', fontSize: '13px' }} className="mono">{errorMsg}</div>
          )}

          <div style={{ marginTop: '12px', paddingTop: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={handleCancel} className="btn" style={{ padding: '10px 24px' }}>
              <X size={18} style={{ marginRight: '8px' }} />
              <span>Отмена</span>
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!title.trim() || createPost.isPending || isOverLimit || githubUrlInvalid}
              style={{ padding: '10px 24px' }}
            >
              <Send size={18} style={{ marginRight: '8px' }} />
              <span>{createPost.isPending ? 'Публикация...' : 'Опубликовать'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

CreatePostPage.displayName = 'CreatePostPage';

export default CreatePostPage;
