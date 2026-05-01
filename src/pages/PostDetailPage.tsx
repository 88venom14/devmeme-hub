import React, { memo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { Comment, PostWithMeta } from '../types';
import PostCard from '../components/feed/PostCard';
import Avatar from '../components/Avatar';
import { useSessionContext } from '../context/SessionContext';
import { useMyProfile } from '../hooks/useMyProfile';
import { useInvalidatePosts } from '../hooks/useInvalidatePosts';
import { LIMITS } from '../lib/validation';

type SortMode = 'new' | 'old';
type ReplyTarget = { id: string; username: string } | null;

/* ── single comment row ── */
const CommentItem = memo(({
  c, canDelete, onDelete, onReply, isReply,
}: {
  c: Comment;
  canDelete: boolean;
  onDelete: () => void;
  onReply: () => void;
  isReply?: boolean;
}) => {
  const profile = c.profiles;
  const timeAgo = formatDistanceToNow(new Date(c.created_at), { locale: ru });

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <Avatar src={profile?.avatar_url} name={profile?.display_name || profile?.username} size={isReply ? 26 : 32} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            {profile?.display_name || profile?.username || 'anon'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {timeAgo} назад
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onReply}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-3)', cursor: 'pointer', padding: '2px 6px',
              borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
          >↩ ответить</button>
          {canDelete && (
            <button
              onClick={onDelete}
              style={{
                background: 'transparent', border: 'none',
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

/* ── main page ── */
const PostDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invalidatePosts = useInvalidatePosts();
  const session = useSessionContext();
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState('');
  const [sort, setSort] = useState<SortMode>('new');
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null);

  const { data: myProfile } = useMyProfile(session?.user.id);

  const { data: post, isLoading: postLoading, error: postError } = useQuery({
    queryKey: ['post', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts').select(POST_SELECT).eq('id', id!).single();
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

  /* group into threads */
  const threads = React.useMemo(() => {
    if (!comments) return [];
    const roots = comments.filter((c) => !c.parent_id);
    const repliesMap = new Map<string, Comment[]>();
    comments
      .filter((c) => !!c.parent_id)
      .forEach((c) => {
        const arr = repliesMap.get(c.parent_id!) ?? [];
        arr.push(c);
        repliesMap.set(c.parent_id!, arr);
      });

    const sorted = [...roots];
    if (sort === 'new') sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === 'old') sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return sorted.map((root) => ({
      root,
      replies: (repliesMap.get(root.id) ?? []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    }));
  }, [comments, sort]);

  const totalComments = comments?.length ?? 0;

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
      if (!trimmed) throw new Error('Комментарий не может быть пустым');
      if (trimmed.length > LIMITS.comment) throw new Error(`Максимум ${LIMITS.comment} символов`);
      const { error } = await supabase.from('comments').insert({
        post_id: id,
        user_id: session.user.id,
        text: trimmed,
        parent_id: replyTo?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText('');
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      invalidatePosts();
    },
  });

  const handleReply = (target: ReplyTarget) => {
    setReplyTo(target);
    composerRef.current?.focus();
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (postLoading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
      загрузка…
    </div>
  );

  if (postError || !post) return (
    <div style={{ padding: '20px', color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>
      ПОСТ_НЕ_НАЙДЕН
    </div>
  );

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
      >← назад</button>

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
              <button key={s} onClick={() => setSort(s)} style={{
                padding: '3px 10px',
                background: sort === s ? 'var(--bg-3)' : 'transparent',
                border: 'none', borderRadius: 4,
                color: sort === s ? 'var(--accent)' : 'var(--text-3)',
                fontSize: 11, fontFamily: 'var(--font-mono)',
                fontWeight: sort === s ? 600 : 400, cursor: 'pointer',
              }}
                onMouseEnter={(e) => { if (sort !== s) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
                onMouseLeave={(e) => { if (sort !== s) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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
            <Avatar
              src={myProfile?.avatar_url}
              name={myProfile?.display_name || myProfile?.username || session.user.email}
              size={32}
            />
            <div style={{ flex: 1 }}>
              {/* Reply badge */}
              {replyTo && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'oklch(from var(--accent) l c h / 0.1)',
                  border: '1px solid oklch(from var(--accent) l c h / 0.3)',
                  borderRadius: 6, padding: '3px 8px', marginBottom: 6,
                  fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
                }}>
                  ↩ ответ для @{replyTo.username}
                  <button
                    onClick={() => setReplyTo(null)}
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1,
                    }}
                  >×</button>
                </div>
              )}
              <textarea
                ref={composerRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, LIMITS.comment + 10))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    if (text.trim() && !addComment.isPending) addComment.mutate();
                  }
                }}
                placeholder={replyTo ? `ответить @${replyTo.username}…` : 'напишите комментарий…'}
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
                <button onClick={() => { setText(''); setReplyTo(null); }} style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  padding: '4px 10px', fontSize: 12, fontFamily: 'var(--font-ui)',
                  color: 'var(--text-3)', cursor: 'pointer',
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
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
                  onMouseEnter={(e) => { if (text.trim() && !addComment.isPending && text.length <= LIMITS.comment) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
                >
                  {addComment.isPending ? '...' : replyTo ? 'Ответить' : 'Отправить'}
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
        ) : threads.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {threads.map(({ root, replies }) => (
              <div key={root.id}>
                <CommentItem
                  c={root}
                  canDelete={session?.user.id === root.user_id}
                  onDelete={() => { if (window.confirm('Удалить комментарий?')) deleteComment.mutate(root.id); }}
                  onReply={() => handleReply({ id: root.id, username: root.profiles?.username ?? 'anon' })}
                />
                {replies.length > 0 && (
                  <div style={{
                    marginTop: 10, marginLeft: 42,
                    paddingLeft: 14, borderLeft: '2px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: 12,
                  }}>
                    {replies.map((r) => (
                      <CommentItem
                        key={r.id}
                        c={r}
                        isReply
                        canDelete={session?.user.id === r.user_id}
                        onDelete={() => { if (window.confirm('Удалить ответ?')) deleteComment.mutate(r.id); }}
                        onReply={() => handleReply({ id: root.id, username: root.profiles?.username ?? 'anon' })}
                      />
                    ))}
                  </div>
                )}
              </div>
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
