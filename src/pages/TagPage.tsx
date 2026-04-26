import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';

const TagPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['tag-posts', name],
    enabled: !!name,
    queryFn: async () => {
      // Find tag id, then post_tags, then posts
      const { data: tagRow, error: tagErr } = await supabase
        .from('tags')
        .select('id')
        .eq('name', name!)
        .maybeSingle();
      if (tagErr) throw tagErr;
      if (!tagRow) return [] as PostWithMeta[];

      const { data, error } = await supabase
        .from('post_tags')
        .select(`posts ( ${POST_SELECT} )`)
        .eq('tag_id', tagRow.id);
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
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
        <span className="text-secondary">#</span>{name}
      </h1>

      {isLoading && <div className="mono text-secondary">LOADING_TAG...</div>}
      {error && <div className="mono" style={{ color: 'var(--error)' }}>{(error as Error).message}</div>}

      {posts && posts.length > 0 ? (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      ) : !isLoading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="text-secondary">No posts with this tag yet.</div>
        </div>
      ) : null}
    </div>
  );
};

export default TagPage;
