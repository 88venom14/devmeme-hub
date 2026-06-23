import React, { memo, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Code, ExternalLink, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { api } from '../../lib/api';
import type { GithubRepoData, PostWithMeta } from '../../types';
import { useSessionContext } from '../../context/SessionContext';
import { useInvalidatePosts } from '../../hooks/useInvalidatePosts';
import MarkdownContent from '@/components/common/MarkdownContent';
import Avatar from '@/components/common/Avatar';
import VideoPlayer from '../ui/VideoPlayer';

interface PostCardProps {
  post: PostWithMeta;
  mode?: 'feed' | 'detail';
}

/* Thin SVG icon wrappers — stroke-based, no deps */
const IconHeart = ({ filled }: { filled?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11h-2z"/>
  </svg>
);
const IconComment = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-5A8 8 0 1 1 21 12z"/>
  </svg>
);
const IconBookmark = ({ filled }: { filled?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12v18l-6-4-6 4z"/>
  </svg>
);
const IconShare = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/>
    <path d="m8 11 8-4M8 13l8 4"/>
  </svg>
);
const IconStar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

interface ActionButtonProps {
  label?: string | number;
  active?: boolean;
  activeColor?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

const ActionButton = memo(({ label, active, activeColor, onClick, disabled, title, children }: ActionButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 8px',
      background: 'transparent',
      border: 'none',
      borderRadius: 5,
      color: active ? (activeColor || 'var(--accent)') : 'var(--text-3)',
      fontSize: 12,
      fontFamily: 'var(--font-mono)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background 0.12s, color 0.12s',
    }}
    onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
  >
    {children}
    {label != null && <span>{label}</span>}
  </button>
));
ActionButton.displayName = 'ActionButton';

const PostCard: React.FC<PostCardProps> = memo(({ post, mode = 'feed' }) => {
  const session = useSessionContext();
  const userId = session?.user.id;
  const invalidatePosts = useInvalidatePosts();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);

  const isDetail = mode === 'detail';
  const isOwner = !!userId && userId === post.user_id;

  const profile = post.profiles;
  const starCount = post.stars?.[0]?.count ?? 0;
  const commentCount = post.comments?.[0]?.count ?? 0;

  const tags = useMemo(
    () =>
      (post.post_tags ?? [])
        .map((pt) => pt.tags)
        .filter((t): t is { id: string; name: string } => !!t),
    [post.post_tags],
  );

  const interactionsKey = useMemo(
    () => ['post-interactions', post.id, userId ?? 'anon'],
    [post.id, userId],
  );

  const { data: interactions } = useQuery({
    queryKey: interactionsKey,
    enabled: !!userId,
    queryFn: () => api.getPostInteractions(post.id),
  });

  const toggleStar = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to star');
      if (interactions?.isStarred) {
        await api.unstarPost(post.id);
      } else {
        await api.starPost(post.id);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: interactionsKey });
      const prev = queryClient.getQueryData<{ isStarred: boolean; isSaved: boolean }>(interactionsKey);
      queryClient.setQueryData(interactionsKey, { ...prev, isStarred: !prev?.isStarred });
      return { prev };
    },
    onError: (_err, _vars, ctx) => { queryClient.setQueryData(interactionsKey, ctx?.prev); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: interactionsKey }); invalidatePosts(); },
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to save');
      if (interactions?.isSaved) {
        await api.unsavePost(post.id);
      } else {
        await api.savePost(post.id);
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: interactionsKey });
      const prev = queryClient.getQueryData<{ isStarred: boolean; isSaved: boolean }>(interactionsKey);
      queryClient.setQueryData(interactionsKey, { ...prev, isSaved: !prev?.isSaved });
      return { prev };
    },
    onError: (_err, _vars, ctx) => { queryClient.setQueryData(interactionsKey, ctx?.prev); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: interactionsKey }); invalidatePosts(); },
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      await api.deletePost(post.id);
    },
    onSuccess: () => { invalidatePosts(); if (isDetail) navigate('/feed'); },
  });

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [post.id]);

  const handleDelete = useCallback(() => {
    if (!window.confirm('Удалить пост? Это действие нельзя отменить.')) return;
    deletePost.mutate();
  }, [deletePost]);

  const handleToggleStar = useCallback((e: React.MouseEvent) => { e.stopPropagation(); toggleStar.mutate(); }, [toggleStar]);
  const handleToggleSave = useCallback((e: React.MouseEvent) => { e.stopPropagation(); toggleSave.mutate(); }, [toggleSave]);
  const handleShareClick = useCallback((e: React.MouseEvent) => { e.stopPropagation(); handleShare(); }, [handleShare]);

  const showImage = !!post.image_url;
  const showVideo = isDetail ? !!post.video_url : !post.image_url && !!post.video_url;

  const clampStyle = isDetail ? {} : {
    display: '-webkit-box' as const,
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  };

  return (
    <article
      onClick={() => { if (!isDetail) navigate(`/post/${post.id}`); }}
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius)',
        padding: 18,
        display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'border-color 0.15s',
        cursor: isDetail ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
    >
      {/* Author row */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Link
          to={`/profile/${profile?.username}`}
          onClick={(e) => e.stopPropagation()}
          style={{ flexShrink: 0, textDecoration: 'none', borderRadius: '50%', transition: 'opacity 0.12s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          <Avatar src={profile?.avatar_url} name={profile?.display_name || profile?.username} size={36} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13 }}>
            <Link
              to={`/profile/${profile?.username}`}
              onClick={(e) => e.stopPropagation()}
              style={{ fontWeight: 600, color: 'var(--text-1)', textDecoration: 'none', transition: 'color 0.12s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'; }}
            >
              {profile?.display_name || profile?.username}
            </Link>
            <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              @{profile?.username}
            </span>
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {formatDistanceToNow(new Date(post.created_at), { locale: ru })} назад
          </div>
        </div>
      </header>

      {/* Title */}
      <Link to={`/post/${post.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none' }}>
        <h2
          style={{
            margin: 0,
            fontSize: 16, fontWeight: 600, lineHeight: 1.3,
            color: 'var(--text-1)',
            ...(isDetail ? {} : {
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }),
          }}
        >
          {post.title}
        </h2>
      </Link>

      {/* Body */}
      {post.description && (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)', ...clampStyle }}>
          {post.description}
        </p>
      )}

      {post.content_md && (
        <div style={{ fontSize: 13 }} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) e.stopPropagation(); }}>
          <MarkdownContent clamp={isDetail ? undefined : 3}>{post.content_md}</MarkdownContent>
        </div>
      )}

      {/* Media */}
      {showImage && (
        <div style={{
          borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-2)',
          textAlign: 'center',
        }}>
          <img
            src={post.image_url!}
            alt="Post media"
            style={{
              maxWidth: '100%',
              maxHeight: isDetail ? '480px' : '280px',
              objectFit: 'contain',
              display: 'block', margin: '0 auto',
            }}
          />
        </div>
      )}

      {showVideo && (
        <div onClick={(e) => e.stopPropagation()}>
          <VideoPlayer src={post.video_url!} maxHeight={isDetail ? 480 : 280} />
        </div>
      )}

      {post.github_url && (
        <GithubRepoPreview url={post.github_url} repoData={post.github_repo_json} />
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {tags.map((t) => (
            <Link
              key={t.id}
              to={`/tag/${t.name}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-3)', fontSize: 11,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer', textDecoration: 'none',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}

      {/* Action bar */}
      <footer style={{
        display: 'flex', alignItems: 'center', gap: 4,
        paddingTop: 4,
        borderTop: '1px solid var(--border)',
        marginTop: 'auto',
      }}>
        <ActionButton
          label={starCount}
          active={interactions?.isStarred}
          activeColor="oklch(0.65 0.22 25)"
          onClick={handleToggleStar}
          disabled={!userId || toggleStar.isPending}
          title={userId ? (interactions?.isStarred ? 'Убрать лайк' : 'Лайк') : 'Войдите, чтобы оценить'}
        >
          <IconHeart filled={interactions?.isStarred} />
        </ActionButton>

        <Link
          to={`/post/${post.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 8px', borderRadius: 5,
            color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)',
            textDecoration: 'none', transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <IconComment />
          <span>{commentCount}</span>
        </Link>

        <ActionButton
          active={interactions?.isSaved}
          activeColor="var(--accent)"
          onClick={handleToggleSave}
          disabled={!userId || toggleSave.isPending}
          title={userId ? (interactions?.isSaved ? 'Убрать из сохранённых' : 'Сохранить') : 'Войдите, чтобы сохранить'}
        >
          <IconBookmark filled={interactions?.isSaved} />
        </ActionButton>

        <div style={{ flex: 1 }} />

        <div style={{ position: 'relative' }}>
          <ActionButton onClick={handleShareClick} title="Копировать ссылку">
            <IconShare />
          </ActionButton>
          {copied && (
            <div style={{
              position: 'absolute', right: 0, bottom: '100%', marginBottom: 6,
              background: 'var(--bg-3)', color: 'var(--text-1)',
              padding: '5px 9px', borderRadius: 5,
              fontSize: 11, fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
              border: '1px solid var(--border)',
              animation: 'fadeIn 0.15s ease-out',
              zIndex: 10,
            }}>
              ссылка скопирована
            </div>
          )}
        </div>

        {isOwner && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            disabled={deletePost.isPending}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '5px 8px', borderRadius: 5,
              background: 'transparent', border: 'none',
              color: 'oklch(0.65 0.2 25)',
              cursor: deletePost.isPending ? 'not-allowed' : 'pointer',
              opacity: deletePost.isPending ? 0.5 : 1,
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.65 0.2 25 / 0.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            title="Удалить пост"
          >
            <Trash2 size={14} />
          </button>
        )}
      </footer>
    </article>
  );
});

PostCard.displayName = 'PostCard';

const GithubRepoPreview = memo(
  ({ url, repoData }: { url: string; repoData: GithubRepoData | null }) => (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Code size={14} style={{ color: 'var(--text-3)' }} />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}
          >
            {url.replace('https://github.com/', '')}
          </a>
        </div>
        <ExternalLink size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
      </div>
      {repoData && (
        <>
          {repoData.description && (
            <p style={{ fontSize: 12, margin: '6px 0 0', color: 'var(--text-2)' }}>
              {repoData.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: 14, fontSize: 11, marginTop: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {repoData.language && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'inline-block' }} />
                {repoData.language}
              </div>
            )}
            {typeof repoData.stargazers_count === 'number' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconStar />
                {repoData.stargazers_count}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  ),
);

GithubRepoPreview.displayName = 'GithubRepoPreview';

export default PostCard;
