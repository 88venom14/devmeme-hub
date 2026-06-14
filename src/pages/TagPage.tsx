import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PostCard from '../components/feed/PostCard';

const TagPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['tag-posts', name],
    enabled: !!name,
    queryFn: () => api.listTagPosts(name!),
  });

  const postCards = useMemo(
    () => posts?.map((post) => <PostCard key={post.id} post={post} />),
    [posts],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
        <span className="text-secondary">#</span>{name}
      </h1>

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
          <div className="text-secondary">Постов с этим тегом пока нет.</div>
        </div>
      ) : null}
    </div>
  );
};

export default TagPage;
