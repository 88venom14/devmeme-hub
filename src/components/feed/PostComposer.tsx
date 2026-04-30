import React, { memo, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link as LinkIcon, Send, Hash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInvalidatePosts } from '../../hooks/useInvalidatePosts';
import { useSessionContext } from '../../context/SessionContext';
import { parseTags, attachTagsToPost } from '../../lib/tags';
import { LIMITS, isValidGithubUrl } from '../../lib/validation';

const CharCount = memo(({ value, max }: { value: string; max: number }) => {
  const len = value.length;
  if (len < max * 0.8) return null;
  return (
    <span
      className="mono"
      style={{
        fontSize: '11px',
        color: len > max ? 'var(--error)' : 'var(--text-secondary)',
        marginLeft: '6px',
      }}
    >
      {len}/{max}
    </span>
  );
});

CharCount.displayName = 'CharCount';

const PostComposer: React.FC = memo(() => {
  const invalidatePosts = useInvalidatePosts();
  const session = useSessionContext();
  const userId = session?.user.id;

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('id', userId!)
        .single();
      return data as {
        username: string;
        display_name: string | null;
        avatar_url: string | null;
      } | null;
    },
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);

  const isOverLimit = useMemo(
    () =>
      title.length > LIMITS.title ||
      description.length > LIMITS.content ||
      tags.length > LIMITS.maxTags,
    [title.length, description.length, tags.length],
  );

  const githubUrlInvalid = useMemo(
    () => !!githubUrl.trim() && !isValidGithubUrl(githubUrl.trim()),
    [githubUrl],
  );

  const avatarSrc = useMemo(
    () =>
      profile?.avatar_url ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${profile?.username ?? 'anon'}`,
    [profile?.avatar_url, profile?.username],
  );

  const createPost = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Необходимо войти в аккаунт');
      if (title.trim().length > LIMITS.title)
        throw new Error(`Заголовок не более ${LIMITS.title} символов`);
      if (description.length > LIMITS.content)
        throw new Error(`Описание не более ${LIMITS.content} символов`);
      if (githubUrl.trim() && !isValidGithubUrl(githubUrl.trim()))
        throw new Error('Ссылка на GitHub должна быть в формате https://github.com/...');
      if (tags.length > LIMITS.maxTags)
        throw new Error(`Максимум ${LIMITS.maxTags} тегов`);

      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          title: title.trim(),
          description: description.trim() || null,
          github_url: githubUrl.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (tags.length > 0) await attachTagsToPost(data.id, tags);

      return data;
    },
    onSuccess: () => {
      invalidatePosts();
      setTitle('');
      setDescription('');
      setGithubUrl('');
      setTagsInput('');
      setIsExpanded(false);
      setErrorMsg(null);
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || createPost.isPending || isOverLimit || githubUrlInvalid) return;
      createPost.mutate();
    },
    [title, createPost, isOverLimit, githubUrlInvalid],
  );

  const handleCollapse = useCallback(() => setIsExpanded(false), []);
  const handleExpand = useCallback(() => setIsExpanded(true), []);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setTitle(e.target.value.slice(0, LIMITS.title + 20)),
    [],
  );
  const handleDescChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      setDescription(e.target.value.slice(0, LIMITS.content + 100)),
    [],
  );
  const handleGithubChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setGithubUrl(e.target.value.slice(0, LIMITS.githubUrl)),
    [],
  );
  const handleTagsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setTagsInput(e.target.value.slice(0, LIMITS.tagsInput)),
    [],
  );

  return (
    <div className="card" style={{ padding: '16px' }}>
      <form onSubmit={handleSubmit}>
        {!isExpanded ? (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <img
              src={avatarSrc}
              alt="аватар"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-main)',
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              placeholder="Ваш последний мем или проект?"
              style={{ width: '100%', border: 'none', background: 'var(--bg-main)' }}
              onFocus={handleExpand}
              value={title}
              onChange={handleTitleChange}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Заголовок
                </span>
                <CharCount value={title} max={LIMITS.title} />
              </div>
              <input
                type="text"
                placeholder="Заголовок поста"
                style={{
                  width: '100%',
                  fontWeight: 'bold',
                  borderColor: title.length > LIMITS.title ? 'var(--error)' : undefined,
                }}
                value={title}
                onChange={handleTitleChange}
                autoFocus
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Описание
                </span>
                <CharCount value={description} max={LIMITS.content} />
              </div>
              <textarea
                placeholder="Описание или Markdown-контент..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  resize: 'vertical',
                  borderColor:
                    description.length > LIMITS.content ? 'var(--error)' : undefined,
                }}
                value={description}
                onChange={handleDescChange}
              />
            </div>

            <div>
              <div style={{ position: 'relative' }}>
                <LinkIcon
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                  }}
                />
                <input
                  type="text"
                  placeholder="https://github.com/username/repo"
                  style={{
                    width: '100%',
                    paddingLeft: '36px',
                    borderColor: githubUrlInvalid ? 'var(--error)' : undefined,
                  }}
                  value={githubUrl}
                  onChange={handleGithubChange}
                />
              </div>
              {githubUrlInvalid && (
                <p
                  className="mono"
                  style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px' }}
                >
                  Только ссылки на github.com
                </p>
              )}
            </div>

            <div>
              <div style={{ position: 'relative' }}>
                <Hash
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                  }}
                />
                <input
                  type="text"
                  placeholder="теги (например: react, supabase)"
                  style={{ width: '100%', paddingLeft: '36px' }}
                  value={tagsInput}
                  onChange={handleTagsChange}
                />
              </div>
              {tags.length > LIMITS.maxTags && (
                <p
                  className="mono"
                  style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px' }}
                >
                  Максимум {LIMITS.maxTags} тегов (сейчас: {tags.length})
                </p>
              )}
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--error)', fontSize: '13px' }} className="mono">
                {errorMsg}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px',
              }}
            >
              <Link to="/post/new" className="text-secondary" style={{ fontSize: '12px' }}>
                Нужны медиа или полный редактор? →
              </Link>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-sm" onClick={handleCollapse}>
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={
                    !title.trim() || createPost.isPending || isOverLimit || githubUrlInvalid
                  }
                >
                  <Send size={16} style={{ marginRight: '6px' }} />
                  {createPost.isPending ? 'Публикация...' : 'Опубликовать'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
});

PostComposer.displayName = 'PostComposer';

export default PostComposer;
