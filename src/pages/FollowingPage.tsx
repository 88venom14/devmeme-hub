import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import { useSessionContext } from '../context/SessionContext';

const FollowingPage: React.FC = () => {
  const session = useSessionContext();
  const userId = session?.user.id;

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['following-feed', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: follows, error: followErr } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId!);
      if (followErr) throw followErr;

      const ids = (follows ?? []).map((f) => f.following_id);
      if (ids.length === 0) return [] as PostWithMeta[];

      const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .in('user_id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PostWithMeta[];
    },
  });

  const postCards = useMemo(
    () => posts?.map((post) => <PostCard key={post.id} post={post} />),
    [posts],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Подписки</h1>

      {isLoading && <div className="mono text-secondary">ЗАГРУЗКА...</div>}
      {error && (
        <div className="mono" style={{ color: 'var(--error)' }}>
          {(error as Error).message}
        </div>
      )}

      {posts && posts.length > 0 ? (
        <div className="post-grid">{postCards}</div>
      ) : !isLoading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="text-secondary">
            Подпишитесь на разработчиков, чтобы видеть их посты здесь.
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FollowingPage;
