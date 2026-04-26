import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import PostComposer from '../components/feed/PostComposer';
import { useSession } from '../hooks/useSession';

const FeedPage: React.FC = () => {
  const { session } = useSession();

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as PostWithMeta[];
    },
  });

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div className="mono">FETCHING_CONTENT...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--error)' }}>
        <div className="mono">ERROR_FETCHING_FEED: {(error as Error).message}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {session && <PostComposer />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {posts && posts.length > 0 ? (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div className="text-secondary">No posts yet. Be the first to share!</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedPage;
