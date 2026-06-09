import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PostCard from '../components/feed/PostCard';

const TrendingPage: React.FC = () => {
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['trending-posts'],
    queryFn: api.listTrendingPosts,
  });

  const ranked = useMemo(() => {
    if (!posts) return [];
    return [...posts].sort((a, b) => {
      const aScore = (a.stars?.[0]?.count ?? 0) * 2 + (a.comments?.[0]?.count ?? 0);
      const bScore = (b.stars?.[0]?.count ?? 0) * 2 + (b.comments?.[0]?.count ?? 0);
      return bScore - aScore;
    });
  }, [posts]);

  const postCards = useMemo(
    () => ranked.map((post) => <PostCard key={post.id} post={post} />),
    [ranked],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Популярное (7 дней)</h1>

      {isLoading && <div className="mono text-secondary">ЗАГРУЗКА...</div>}
      {error && (
        <div className="mono" style={{ color: 'var(--error)' }}>
          {(error as Error).message}
        </div>
      )}

      {ranked.length > 0 ? (
        <div className="post-grid">{postCards}</div>
      ) : !isLoading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="text-secondary">На этой неделе пока пусто.</div>
        </div>
      ) : null}
    </div>
  );
};

export default TrendingPage;
