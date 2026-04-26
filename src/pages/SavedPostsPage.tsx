import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import { useSession } from '../hooks/useSession';

const SavedPostsPage: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['saved-posts', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_posts')
        .select(`posts ( ${POST_SELECT} )`)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? [])
        .map((row: { posts: PostWithMeta | PostWithMeta[] | null }) => {
          const p = row.posts;
          return Array.isArray(p) ? p[0] : p;
        })
        .filter((p): p is PostWithMeta => p !== null && p !== undefined);
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Saved Posts</h1>

      {isLoading && <div className="mono text-secondary">LOADING_SAVED...</div>}
      {error && <div className="mono" style={{ color: 'var(--error)' }}>{(error as Error).message}</div>}

      {posts && posts.length > 0 ? (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      ) : !isLoading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="text-secondary">No saved posts yet.</div>
        </div>
      ) : null}
    </div>
  );
};

export default SavedPostsPage;
