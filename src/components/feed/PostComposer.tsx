import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link as LinkIcon, Send, Hash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInvalidatePosts } from '../../hooks/useInvalidatePosts';
import { useSession } from '../../hooks/useSession';
import { parseTags, attachTagsToPost } from '../../lib/tags';

const LIMITS = { title: 150, description: 2_000, githubUrl: 500, tagsInput: 200, maxTags: 10 };

const CharCount: React.FC<{ value: string; max: number }> = ({ value, max }) => {
  const len = value.length;
  if (len < max * 0.8) return null;
  return (
    <span className="mono" style={{ fontSize: '11px', color: len > max ? 'var(--error)' : 'var(--text-secondary)', marginLeft: '6px' }}>
      {len}/{max}
    </span>
  );
};

const PostComposer: React.FC = () => {
  const invalidatePosts = useInvalidatePosts();
  const { session } = useSession();
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
      return data as { username: string; display_name: string | null; avatar_url: string | null } | null;
    },
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tags = parseTags(tagsInput);

  const isOverLimit = title.length > LIMITS.title || description.length > LIMITS.description || tags.length > LIMITS.maxTags;

  const createPost = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Необходимо войти в аккаунт');
      if (title.trim().length > LIMITS.title) throw new Error(`Заголовок не более ${LIMITS.title} символов`);
      if (description.length > LIMITS.description) throw new Error(`Описание не более ${LIMITS.description} символов`);
      if (tags.length > LIMITS.maxTags) throw new Error(`Максимум ${LIMITS.maxTags} тегов`);

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
      setTitle(''); setDescription(''); setGithubUrl(''); setTagsInput('');
      setIsExpanded(false); setErrorMsg(null);
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || createPost.isPending || isOverLimit) return;
    createPost.mutate();
  };

  const avatarSrc = profile?.avatar_url
    || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile?.username ?? 'anon'}`;

  return (
    <div className="card" style={{ padding: '16px' }}>
      <form onSubmit={handleSubmit}>
        {!isExpanded ? (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <img
              src={avatarSrc}
              alt="аватар"
              style={{ width: '40px', height: '40px', borderRadius: '4px', backgroundColor: 'var(--bg-main)', flexShrink: 0 }}
            />
            <input
              type="text" placeholder="Ваш последний мем или проект?"
              style={{ width: '100%', border: 'none', background: 'var(--bg-main)' }}
              onFocus={() => setIsExpanded(true)}
              value={title} onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title + 20))}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Заголовок</span>
                <CharCount value={title} max={LIMITS.title} />
              </div>
              <input
                type="text" placeholder="Заголовок поста"
                style={{ width: '100%', fontWeight: 'bold', borderColor: title.length > LIMITS.title ? 'var(--error)' : undefined }}
                value={title} onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title + 20))} autoFocus
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Описание</span>
                <CharCount value={description} max={LIMITS.description} />
              </div>
              <textarea
                placeholder="Описание или Markdown-контент..."
                style={{ width: '100%', minHeight: '100px', resize: 'vertical', borderColor: description.length > LIMITS.description ? 'var(--error)' : undefined }}
                value={description} onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.description + 100))}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <LinkIcon size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text" placeholder="Ссылка на GitHub репозиторий (необязательно)"
                style={{ width: '100%', paddingLeft: '36px' }}
                value={githubUrl} onChange={(e) => setGithubUrl(e.target.value.slice(0, LIMITS.githubUrl))}
              />
            </div>

            <div>
              <div style={{ position: 'relative' }}>
                <Hash size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text" placeholder="теги (например: react, supabase)"
                  style={{ width: '100%', paddingLeft: '36px' }}
                  value={tagsInput} onChange={(e) => setTagsInput(e.target.value.slice(0, LIMITS.tagsInput))}
                />
              </div>
              {tags.length > LIMITS.maxTags && (
                <p className="mono" style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px' }}>
                  Максимум {LIMITS.maxTags} тегов (сейчас: {tags.length})
                </p>
              )}
            </div>

            {errorMsg && (
              <div style={{ color: 'var(--error)', fontSize: '13px' }} className="mono">
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <Link to="/post/new" className="text-secondary" style={{ fontSize: '12px' }}>
                Нужны медиа или полный редактор? →
              </Link>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-sm" onClick={() => setIsExpanded(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim() || createPost.isPending || isOverLimit}>
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
};

export default PostComposer;
