import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { Comment, PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import { useSessionContext } from '../context/SessionContext';
import { useInvalidatePosts } from '../hooks/useInvalidatePosts';
import { LIMITS } from '../lib/validation';

const PostDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const invalidatePosts = useInvalidatePosts();
  const session = useSessionContext();
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

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      invalidatePosts();
    },
  });

  const handleDeleteComment = (commentId: string) => {
    if (!window.confirm('Удалить комментарий?')) return;
    deleteComment.mutate(commentId);
  };

  const addComment = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Войдите, чтобы оставить комментарий');
      if (!id) throw new Error('Не найден ID поста');
      const trimmed = text.trim();
      if (trimmed.length === 0) throw new Error('Комментарий не может быть пустым');
      if (trimmed.length > LIMITS.comment) throw new Error(`Комментарий не может превышать ${LIMITS.comment} символов`);
      const { error } = await supabase
        .from('comments')
        .insert({ post_id: id, user_id: session.user.id, text: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      invalidatePosts();
    },
  });

  if (postLoading) {
    return <div style={{ padding: '20px' }} className="mono">ЗАГРУЗКА_ПОСТА...</div>;
  }

  if (postError || !post) {
    return (
      <div style={{ padding: '20px', color: 'var(--error)' }} className="mono">
        ПОСТ_НЕ_НАЙДЕН
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PostCard post={post} mode="detail" />

      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Комментарии</h3>

        {session ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim() || addComment.isPending) return;
              addComment.mutate();
            }}
            style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}
          >
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder="Напишите комментарий..."
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, LIMITS.comment + 10))}
                maxLength={LIMITS.comment + 10}
                style={{ width: '100%', borderColor: text.length > LIMITS.comment ? 'var(--error)' : undefined }}
              />
              {text.length >= LIMITS.comment * 0.8 && (
                <span className="mono" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: text.length > LIMITS.comment ? 'var(--error)' : 'var(--text-secondary)', pointerEvents: 'none' }}>
                  {text.length}/{LIMITS.comment}
                </span>
              )}
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!text.trim() || addComment.isPending || text.length > LIMITS.comment}>
              <Send size={16} />
            </button>
          </form>
        ) : (
          <div className="text-secondary" style={{ marginBottom: '20px', fontSize: '14px' }}>
            Войдите, чтобы оставить комментарий.
          </div>
        )}

        {addComment.error && (
          <div style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '12px' }} className="mono">
            {(addComment.error as Error).message}
          </div>
        )}

        {commentsLoading ? (
          <div className="mono text-secondary">ЗАГРУЗКА_КОММЕНТАРИЕВ...</div>
        ) : comments && comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {comments.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: '12px' }}>
                <img
                  src={c.profiles?.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.profiles?.username ?? 'anon'}`}
                  alt={c.profiles?.username ?? 'avatar'}
                  style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: 'var(--bg-main)', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ fontWeight: 'bold' }}>{c.profiles?.display_name || c.profiles?.username}</span>
                    <span className="text-secondary">•</span>
                    <span className="text-secondary">{formatDistanceToNow(new Date(c.created_at), { locale: ru })} назад</span>
                    {session?.user.id === c.user_id && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        disabled={deleteComment.isPending}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: '2px 4px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '4px', flexShrink: 0 }}
                        title="Удалить комментарий"
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p style={{ marginTop: '4px' }}>{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-secondary" style={{ fontSize: '14px' }}>Комментариев пока нет.</div>
        )}
      </div>
    </div>
  );
};

export default PostDetailPage;
