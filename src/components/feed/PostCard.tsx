import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Code, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import type { GithubRepoData, PostWithMeta } from '../../lib/supabase';
import { useSession } from '../../hooks/useSession';
import { useInvalidatePosts } from '../../hooks/useInvalidatePosts';
import MarkdownContent from '../MarkdownContent';
import { LikeIcon, CommentIcon, ShareIcon, StarIcon } from '../icons';

interface PostCardProps {
  post: PostWithMeta;
  mode?: 'feed' | 'detail';
}


const PostCard: React.FC<PostCardProps> = ({ post, mode = 'feed' }) => {
  const { session } = useSession();
  const userId = session?.user.id;
  const invalidatePosts = useInvalidatePosts();
  const [copied, setCopied] = React.useState(false);

  const isDetail = mode === 'detail';

  const profile = post.profiles;
  const starCount = post.stars?.[0]?.count ?? 0;
  const commentCount = post.comments?.[0]?.count ?? 0;
  const tags = (post.post_tags ?? [])
    .map((pt) => pt.tags)
    .filter((t): t is { id: string; name: string } => !!t);

  const interactionsKey = ['post-interactions', post.id, userId ?? 'anon'];

  const { data: interactions } = useQuery({
    queryKey: interactionsKey,
    enabled: !!userId,
    queryFn: async () => {
      const [starRes, savedRes] = await Promise.all([
        supabase.from('stars').select('id', { head: true, count: 'exact' }).eq('post_id', post.id).eq('user_id', userId!),
        supabase.from('saved_posts').select('id', { head: true, count: 'exact' }).eq('post_id', post.id).eq('user_id', userId!),
      ]);
      return {
        isStarred: (starRes.count ?? 0) > 0,
        isSaved: (savedRes.count ?? 0) > 0,
      };
    },
  });

  const toggleStar = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to star');
      if (interactions?.isStarred) {
        const { error } = await supabase.from('stars').delete().eq('post_id', post.id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stars').insert({ post_id: post.id, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: invalidatePosts,
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Sign in to save');
      if (interactions?.isSaved) {
        const { error } = await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('saved_posts').insert({ post_id: post.id, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: invalidatePosts,
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/#/post/${post.id}`;
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
    } catch {
      // ignore
    }
  };

  // In feed mode show only one media element (image takes priority)
  const showImage = !!post.image_url;
  const showVideo = isDetail ? !!post.video_url : (!post.image_url && !!post.video_url);

  const clampStyle = isDetail
    ? {}
    : { display: '-webkit-box' as const, WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <Link to={`/profile/${profile?.username}`} style={{ flexShrink: 0 }}>
          <img
            src={profile?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile?.username ?? 'anon'}`}
            alt={profile?.username ?? 'avatar'}
            style={{ width: '40px', height: '40px', borderRadius: '4px', backgroundColor: 'var(--bg-main)' }}
          />
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '13px' }}>
            <Link to={`/profile/${profile?.username}`} style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {profile?.display_name || profile?.username}
            </Link>
            <span className="text-secondary">@{profile?.username}</span>
            <span className="text-secondary">•</span>
            <span className="text-secondary">{formatDistanceToNow(new Date(post.created_at), { locale: ru })} назад</span>
          </div>
          <Link to={`/post/${post.id}`} style={{ color: 'var(--text-primary)' }}>
            <h2 style={{
              fontSize: '17px', marginTop: '4px',
              ...(isDetail ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
            }}>{post.title}</h2>
          </Link>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {post.description && (
          <p style={{ marginBottom: '12px', color: 'var(--text-primary)', ...clampStyle }}>{post.description}</p>
        )}

        {post.content_md && (
          <div style={{ marginBottom: '16px', fontSize: '14px' }}>
            <MarkdownContent clamp={isDetail ? undefined : 4}>{post.content_md}</MarkdownContent>
          </div>
        )}

        {showImage && (
          <div style={{ marginBottom: '16px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', textAlign: 'center' }}>
            <img
              src={post.image_url!}
              alt="Post content"
              style={{ maxWidth: '100%', maxHeight: isDetail ? '480px' : '220px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
            />
          </div>
        )}

        {showVideo && (
          <div style={{ marginBottom: '16px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <video
              src={post.video_url!}
              controls
              style={{ width: '100%', maxHeight: isDetail ? '480px' : '220px', display: 'block', backgroundColor: '#000' }}
            />
          </div>
        )}


        {post.github_url && <GithubRepoPreview url={post.github_url} repoData={post.github_repo_json} />}

        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
            {tags.map((t) => (
              <Link key={t.id} to={`/tag/${t.name}`} style={{
                padding: '3px 10px', backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)', borderRadius: '20px',
                fontSize: '12px', color: 'var(--text-secondary)',
              }}>#{t.name}</Link>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', marginTop: 'auto', paddingTop: '16px' }}>
          <button
            onClick={() => toggleStar.mutate()}
            disabled={!userId || toggleStar.isPending}
            className="btn btn-sm"
            style={{ border: 'none', background: 'none', padding: '4px' }}
            title={userId ? (interactions?.isStarred ? 'Убрать лайк' : 'Лайк') : 'Войдите, чтобы оценить'}
          >
            <LikeIcon size={18} color={interactions?.isStarred ? '#FF8C00' : 'var(--text-secondary)'} filled={interactions?.isStarred} />
            <span style={{ marginLeft: '6px' }}>{starCount}</span>
          </button>
          <Link to={`/post/${post.id}`} className="btn btn-sm" style={{ border: 'none', background: 'none', padding: '4px' }}>
            <CommentIcon size={18} color="var(--text-secondary)" />
            <span style={{ marginLeft: '6px' }}>{commentCount}</span>
          </Link>
          <button
            onClick={() => toggleSave.mutate()}
            disabled={!userId || toggleSave.isPending}
            className="btn btn-sm"
            style={{ border: 'none', background: 'none', padding: '4px' }}
            title={userId ? (interactions?.isSaved ? 'Убрать из сохранённых' : 'Сохранить') : 'Войдите, чтобы сохранить'}
          >
            <StarIcon size={18} color={interactions?.isSaved ? '#FF8C00' : 'var(--text-secondary)'} filled={interactions?.isSaved} />
          </button>
          <button
            onClick={handleShare}
            className="btn btn-sm"
            style={{ border: 'none', background: 'transparent', padding: '4px', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Копировать ссылку"
          >
            <ShareIcon size={18} color={copied ? '#FF8C00' : 'var(--text-secondary)'} />
            {copied && <span style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>Скопировано!</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

const GithubRepoPreview = ({ url, repoData }: { url: string, repoData: GithubRepoData | null }) => (
  <div className="card" style={{ padding: '12px', backgroundColor: 'var(--bg-main)', borderStyle: 'dashed' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Code size={16} />
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 'bold', fontSize: '14px' }} className="mono">
          {url.replace('https://github.com/', '')}
        </a>
      </div>
      <ExternalLink size={14} className="text-secondary" />
    </div>
    {repoData && (
      <>
        {repoData.description && (
          <p style={{ fontSize: '13px', margin: '8px 0', color: 'var(--text-secondary)' }}>{repoData.description}</p>
        )}
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
          {repoData.language && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }}></span>
              <span>{repoData.language}</span>
            </div>
          )}
          {typeof repoData.stargazers_count === 'number' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <StarIcon size={12} color="var(--text-secondary)" />
              <span>{repoData.stargazers_count}</span>
            </div>
          )}
        </div>
      </>
    )}
  </div>
);

export default PostCard;
