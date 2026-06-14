import React, { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import PostCard from '../components/feed/PostCard';
import PostGrid from '../components/feed/PostGrid';
import Avatar from '../components/Avatar';
import { useSessionContext } from '../context/SessionContext';
import { useMyProfile } from '../hooks/useMyProfile';

type Sort = 'hot' | 'new' | 'top';

const SORTS: { id: Sort; label: string; icon: React.ReactNode }[] = [
  {
    id: 'hot',
    label: 'Горячее',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-6 0 2-1 3-2 3 0-3-1-6-4-9-1 4-3 5-4 7s-1 3-1 5c0 4 3 7 7 7z" /></svg>,
  },
  {
    id: 'new',
    label: 'Новое',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" /></svg>,
  },
  {
    id: 'top',
    label: 'Топ',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>,
  },
];

const FilterBar = memo(({ sort, setSort, postCount }: {
  sort: Sort;
  setSort: (s: Sort) => void;
  postCount: number;
}) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
    marginBottom: 14,
    flexWrap: 'wrap',
  }}>
    <div style={{ flex: 1 }} />

    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11,
      color: 'var(--text-3)',
    }}>{postCount} постов</span>

    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 6, padding: 2,
    }}>
      {SORTS.map((s) => (
        <button
          key={s.id}
          onClick={() => setSort(s.id)}
          style={{
            padding: '4px 10px',
            background: sort === s.id ? 'var(--bg-3)' : 'transparent',
            border: 'none',
            borderRadius: 4,
            color: sort === s.id ? 'var(--accent)' : 'var(--text-3)',
            fontSize: 12,
            fontFamily: 'var(--font-ui)',
            fontWeight: sort === s.id ? 600 : 400,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'color 0.12s, background 0.12s',
          }}
          onMouseEnter={(e) => { if (sort !== s.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
          onMouseLeave={(e) => { if (sort !== s.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {s.icon}
          {s.label}
        </button>
      ))}
    </div>
  </div>
));

FilterBar.displayName = 'FilterBar';

/* Inline composer — just a clickable prompt that takes user to /post/new */
const ComposerWidget = memo(({ avatarUrl, username }: { avatarUrl?: string | null; username?: string | null }) => {
  return (
    <Link
      to="/post/new"
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--card-radius)',
        padding: 12,
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'border-color 0.12s',
        marginBottom: 14,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
    >
      <Avatar src={avatarUrl} name={username} size={36} />
      <div style={{
        flex: 1, background: 'var(--bg-2)', borderRadius: 8,
        padding: '8px 12px', color: 'var(--text-3)', fontSize: 13,
        fontFamily: 'var(--font-ui)',
      }}>
        Поделись мемом, кодом или мыслью…
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          <svg key="img" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m3 17 6-6 11 11" /></svg>,
          <svg key="vid" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 9 5-3v12l-5-3z" /></svg>,
        ].map((icon, i) => (
          <div key={i} style={{
            background: 'transparent', color: 'var(--text-3)', padding: 7, borderRadius: 5, display: 'flex',
          }}>{icon}</div>
        ))}
      </div>
    </Link>
  );
});

ComposerWidget.displayName = 'ComposerWidget';

const FeedPage: React.FC = memo(() => {
  const session = useSessionContext();
  const [sort, setSort] = useState<Sort>('hot');

  const { data: posts, isLoading, error } = useQuery({
    queryKey: ['posts'],
    staleTime: 30_000,
    queryFn: api.listPosts,
  });

  const { data: myProfile } = useMyProfile(session?.user.id);

  const sortedPosts = useMemo(() => {
    if (!posts) return [];
    const arr = [...posts];
    if (sort === 'new') arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === 'top') arr.sort((a, b) => (b.stars?.[0]?.count ?? 0) - (a.stars?.[0]?.count ?? 0));
    if (sort === 'hot') arr.sort((a, b) => {
      const scoreB = (b.stars?.[0]?.count ?? 0) + (b.comments?.[0]?.count ?? 0) * 2;
      const scoreA = (a.stars?.[0]?.count ?? 0) + (a.comments?.[0]?.count ?? 0) * 2;
      return scoreB - scoreA;
    });
    return arr;
  }, [posts, sort]);

  const postCards = useMemo(
    () => sortedPosts.map((post) => <PostCard key={post.id} post={post} />),
    [sortedPosts],
  );

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        загрузка…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--error)', fontFamily: 'var(--font-mono)' }}>
        ошибка: {(error as Error).message}
      </div>
    );
  }

  return (
    <div>
      {session && (
        <ComposerWidget avatarUrl={myProfile?.avatar_url} username={myProfile?.username} />
      )}

      <FilterBar sort={sort} setSort={setSort} postCount={sortedPosts.length} />

      {sortedPosts.length > 0 ? (
        <PostGrid>{postCards}</PostGrid>
      ) : (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--card-radius)', color: 'var(--text-3)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <div style={{ fontSize: 14, marginTop: 4 }}>Постов пока нет. Будьте первым!</div>
        </div>
      )}
    </div>
  );
});

FeedPage.displayName = 'FeedPage';

export default FeedPage;
