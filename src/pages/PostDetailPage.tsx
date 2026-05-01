import React, { memo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { Comment, PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import { useSessionContext } from '../context/SessionContext';
import { useInvalidatePosts } from '../hooks/useInvalidatePosts';
import { LIMITS } from '../lib/validation';

type SortMode = 'new' | 'old';

const CommentItem = memo(({
  c,
  canDelete,
  onDelete,
}: {
  c: Comment;
  canDelete: boolean;
  onDelete: () => void;
}) => {
  const profile = c.profiles;
  const initial = ((profile?.display_name || profile?.username) ?? '?')[0].toUpperCase();
  const timeAgo = formatDistanceToNow(new Date(c.created_at), { locale: ru });

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.username ?? 'avatar'}
          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent)', color: 'oklch(0.15 0.01 60)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700,
        }}>{initial}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            {profile?.display_name || profile?.username || 'anon'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {timeAgo} назад
          </span>
          {canDelete && (
            <button
              onClick={onDelete}
              style={{
                marginLeft: 'auto', background: 'transparent', border: 'none',
                color: 'var(--text-3)', cursor: 'pointer', padding: '2px 4px',
                borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
            >✕</button>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)' }}>{c.text}</p>
      </div>
    </div>
  );
});
CommentItem.displayName = 'CommentItem';

const PostDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invalidatePosts = useInvalidatePosts();
  const session = useSessionContext();
  const [text, setText] = useState('');
  const [sort, setSort] = useState<SortMode>('new');

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
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Comment[];
    },
  });

  const sortedComments = React.useMemo(() => {
    if (!comments) return [];
    const arr = [...comments];
    if (sort === 'new') arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === 'old') arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return arr;
  }, [comments, sort]);

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

  const addComment = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('Войдите, чтобы оставить комментарий');
      if (!id) throw new Error('Не найден ID поста');
      const trimmed = text.trim();
      if (trimmed.length === 0) throw new Error('Комментарий не может быть пустым');
      if (trimmed.length > LIMITS.comment) throw new Error(`Максимум ${LIMITS.comment} символов`);
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
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        загрузка…
      </div>
    );
  }

  if (postError || !post) {
    return (
      <div style={{ padding: '20px', color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>
        ПОСТ_НЕ_НАЙДЕН
      </div>
    );
  }

  const totalComments = comments?.length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none',
          color: 'var(--text-3)', fontSize: 12, fontFamily: 'var(--font-mono)',
          cursor: 'pointer', padding: '6px 0', alignSelf: 'flex-start',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
      >
        ← назад
      </button>

      <PostCard post={post} mode="detail" />

      {/* Comments block */}
      <div style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius)', padding: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
            Комментарии{' '}
            <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 400 }}>
              {totalComments}
            </span>
          </h2>
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'inline-flex',
            background: 'var(--bg-0)', border: '1px solid var(--border)',
            borderRadius: 6, padding: 2,
          }}>
            {(['new', 'old'] as SortMode[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: '3px 10px',
                  background: sort === s ? 'var(--bg-3)' : 'transparent',
                  border: 'none', borderRadius: 4,
                  color: sort === s ? 'var(--accent)' : 'var(--text-3)',
                  fontSize: 11, fontFamily: 'var(--font-mono)',
                  fontWeight: sort === s ? 600 : 400, cursor: 'pointer',
                }}
              >
                {s === 'new' ? 'новые' : 'старые'}
              </button>
            ))}
          </div>
        </div>

        {/* Composer */}
        {session ? (
          <div style={{
            background: 'var(--bg-0)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 12,
            display: 'flex', gap: 10, alignItems: 'flex-start',
            marginBottom: 20,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'var(--accent)', color: 'oklch(0.15 0.01 60)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
            }}>
              {(session.user.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, LIMITS.comment + 10))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    if (text.trim() && !addComment.isPending) addComment.mutate();
                  }
                }}
                placeholder="напишите комментарий…"
                rows={2}
                style={{
                  width: '100%', background: 'var(--bg-2)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '8px 10px', color: 'var(--text-1)', fontSize: 13,
                  fontFamily: 'var(--font-ui)', resize: 'none', outline: 'none', lineHeight: 1.5,
                  borderColor: text.length > LIMITS.comment ? 'var(--error)' : undefined,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {text.length >= LIMITS.comment * 0.8
                    ? `${text.length}/${LIMITS.comment}`
                    : '⌘+Enter для отправки'}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => { setText(''); }}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                    padding: '4px 10px', fontSize: 12, fontFamily: 'var(--font-ui)',
                    color: 'var(--text-3)', cursor: 'pointer',
                  }}
                >Очистить</button>
                <button
                  onClick={() => { if (text.trim() && !addComment.isPending) addComment.mutate(); }}
                  disabled={!text.trim() || addComment.isPending || text.length > LIMITS.comment}
                  style={{
                    background: 'var(--accent)', border: '1px solid var(--accent)',
                    borderRadius: 6, padding: '4px 12px', fontSize: 12, fontFamily: 'var(--font-ui)',
                    fontWeight: 600, color: 'oklch(0.15 0.01 60)', cursor: 'pointer',
                    opacity: (!text.trim() || addComment.isPending || text.length > LIMITS.comment) ? 0.5 : 1,
                  }}
                >
                  {addComment.isPending ? '...' : 'Отправить'}
                </button>
              </div>
              {addComment.error && (
                <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                  {(addComment.error as Error).message}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-0)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 14px', marginBottom: 20,
            fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
          }}>
            Войдите, чтобы оставить комментарий.
          </div>
        )}

        {/* List */}
        {commentsLoading ? (
          <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            загрузка комментариев…
          </div>
        ) : sortedComments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sortedComments.map((c) => (
              <CommentItem
                key={c.id}
                c={c}
                canDelete={session?.user.id === c.user_id}
                onDelete={() => {
                  if (window.confirm('Удалить комментарий?')) deleteComment.mutate(c.id);
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Комментариев пока нет.</div>
        )}
      </div>
    </div>
  );
};

export default PostDetailPage;
