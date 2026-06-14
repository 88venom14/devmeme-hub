import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PostCard from '../components/feed/PostCard';
import PostGrid from '../components/feed/PostGrid';
import { useSessionContext } from '../context/SessionContext';

const FollowingPage: React.FC = () => {
  const session = useSessionContext();
  const userId = session?.user.id;

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['following-feed', userId],
    enabled: !!userId,
    queryFn: api.listFollowingPosts,
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
        <PostGrid>{postCards}</PostGrid>
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
