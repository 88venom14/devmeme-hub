import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { Comment, PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import { useSession } from '../hooks/useSession';
import { useInvalidatePosts } from '../hooks/useInvalidatePosts';

const PostDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const invalidatePosts = useInvalidatePosts();
  const { session } = useSession();
  const [text, setText] = useState('');

  const { data: post, isLoading: postLoading, error: postError } = useQuery({
    queryKey: ['post', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as PostWithMeta;
    },
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles:user_id (*)')
        .eq('post_id', id!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Comment[];
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Sign in to comment');
      if (!id) throw new Error('Missing post id');
      const { error } = await supabase
        .from('comments')
        .insert({ post_id: id, user_id: session.user.id, text: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      invalidatePosts();
    },
  });

  if (postLoading) {
    return <div style={{ padding: '20px' }} className="mono">LOADING_POST...</div>;
  }

  if (postError || !post) {
    return (
      <div style={{ padding: '20px', color: 'var(--error)' }} className="mono">
        POST_NOT_FOUND
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PostCard post={post} />

      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Comments</h3>

        {session ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim() || addComment.isPending) return;
              addComment.mutate();
            }}
            style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}
          >
            <input
              type="text"
              placeholder="Add a comment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!text.trim() || addComment.isPending}>
              <Send size={16} />
            </button>
          </form>
        ) : (
          <div className="text-secondary" style={{ marginBottom: '20px', fontSize: '14px' }}>
            Sign in to leave a comment.
          </div>
        )}

        {addComment.error && (
          <div style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '12px' }} className="mono">
            {(addComment.error as Error).message}
          </div>
        )}

        {commentsLoading ? (
          <div className="mono text-secondary">LOADING_COMMENTS...</div>
        ) : comments && comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {comments.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: '12px' }}>
                <img
                  src={c.profiles?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.profiles?.username ?? 'anon'}`}
                  alt={c.profiles?.username ?? 'avatar'}
                  style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: 'var(--bg-main)' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ fontWeight: 'bold' }}>{c.profiles?.display_name || c.profiles?.username}</span>
                    <span className="text-secondary">•</span>
                    <span className="text-secondary">{formatDistanceToNow(new Date(c.created_at))} ago</span>
                  </div>
                  <p style={{ marginTop: '4px' }}>{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-secondary" style={{ fontSize: '14px' }}>No comments yet.</div>
        )}
      </div>
    </div>
  );
};

export default PostDetailPage;
