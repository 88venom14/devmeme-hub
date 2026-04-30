import React, { memo, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import PostComposer from '../components/feed/PostComposer';
import { useSessionContext } from '../context/SessionContext';

const FeedPage: React.FC = memo(() => {
  const session = useSessionContext();

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

  const postCards = useMemo(
    () => posts?.map((post) => <PostCard key={post.id} post={post} />),
    [posts],
  );

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div className="mono">ЗАГРУЗКА...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--error)' }}>
        <div className="mono">ОШИБКА: {(error as Error).message}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {session && <PostComposer />}

      {posts && posts.length > 0 ? (
        <div className="post-grid">{postCards}</div>
      ) : (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="text-secondary">Постов пока нет. Будьте первым!</div>
        </div>
      )}
    </div>
  );
});

FeedPage.displayName = 'FeedPage';

export default FeedPage;
