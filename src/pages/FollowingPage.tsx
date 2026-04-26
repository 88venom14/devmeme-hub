import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import { useSession } from '../hooks/useSession';

const FollowingPage: React.FC = () => {
  const { session } = useSession();
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Following</h1>

      {isLoading && <div className="mono text-secondary">LOADING_FOLLOWING...</div>}
      {error && <div className="mono" style={{ color: 'var(--error)' }}>{(error as Error).message}</div>}

      {posts && posts.length > 0 ? (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      ) : !isLoading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="text-secondary">Follow some developers to see their posts here.</div>
        </div>
      ) : null}
    </div>
  );
};

export default FollowingPage;
