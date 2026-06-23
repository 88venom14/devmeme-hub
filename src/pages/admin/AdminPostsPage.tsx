import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ExternalLink, Heart, MessageCircle, Search } from 'lucide-react';
import { useAdminPosts, useAdminDeletePost } from '@/hooks/useAdminPosts';
import AdminNav from '@/components/admin/AdminNav';
import Avatar from '@/components/common/Avatar';
import { inputStyle } from '@/styles/forms';
import type { PostWithMeta } from '@/types';

const AdminPostsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  // Debounce the search input so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: posts, isLoading, isFetching, error } = useAdminPosts(debounced || undefined);
  const deletePost = useAdminDeletePost();

  const handleDelete = (post: PostWithMeta) => {
    const who = post.profiles?.username ? `@${post.profiles.username}` : 'пользователя';
    if (window.confirm(`Удалить пост «${post.title}» (${who})? Это действие необратимо.`)) {
      deletePost.mutate(post.id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820, margin: '0 auto' }}>
      <AdminNav />

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 440 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Поиск по заголовку, тексту или автору…"
          style={{ ...inputStyle, paddingLeft: 32, paddingRight: query ? 56 : 10 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isFetching && (
          <span style={{ position: 'absolute', right: 30, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>…</span>
        )}
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Очистить"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, lineHeight: 1, padding: 2 }}
          >×</button>
        )}
      </div>

      {isLoading && <div className="mono text-secondary">ЗАГРУЗКА...</div>}
      {error && <div className="mono" style={{ color: 'var(--error)' }}>{(error as Error).message}</div>}

      {posts && posts.length === 0 && !isLoading && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="text-secondary">{debounced ? `Ничего не найдено по запросу «${debounced}».` : 'Постов нет.'}</div>
        </div>
      )}

      {posts && posts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {debounced ? `Найдено: ${posts.length}` : `Всего постов: ${posts.length}`}
          </div>
          {posts.map((post) => {
            const author = post.profiles;
            const snippet = post.description || post.content_md || '';
            const stars = post.stars?.[0]?.count ?? 0;
            const comments = post.comments?.[0]?.count ?? 0;
            const deleting = deletePost.isPending && deletePost.variables === post.id;
            return (
              <div key={post.id} style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 'var(--card-radius)', padding: 14,
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                {post.image_url && (
                  <img src={post.image_url} alt=""
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Avatar src={author?.avatar_url} name={author?.display_name || author?.username} size={20} />
                    {author?.username ? (
                      <Link to={`/profile/${author.username}`} style={{ fontSize: 12, color: 'var(--text-2)', textDecoration: 'none' }}>
                        @{author.username}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>аноним</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      · {new Date(post.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{post.title}</h3>
                  {snippet && (
                    <p style={{
                      margin: '0 0 6px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{snippet}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Heart size={12} /> {stars}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MessageCircle size={12} /> {comments}</span>
                    <Link to={`/post/${post.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', textDecoration: 'none' }}>
                      <ExternalLink size={12} /> открыть
                    </Link>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(post)}
                  disabled={deleting}
                  title="Удалить пост"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7,
                    padding: '7px 12px', fontSize: 12, color: 'var(--error)',
                    cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.5 : 1,
                  }}
                >
                  <Trash2 size={13} /> {deleting ? 'Удаление…' : 'Удалить'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminPostsPage;
