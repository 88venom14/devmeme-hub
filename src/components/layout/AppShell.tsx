import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Bookmark, Users, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SearchBar from './SearchBar';
import { useTopTags } from '../../hooks/useTopTags';
import { useQuery } from '@tanstack/react-query';

const HomeIcon = ({ size = 18, color: _c }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const NewPostIcon = ({ size = 18, color: _c }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const ProfileIcon = ({ size = 18, color: _c }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const SettingsIcon = ({ size = 16, color: _c }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

interface AppShellProps {
  session: Session | null;
}

const AppShell: React.FC<AppShellProps> = ({ session }) => {
  const navigate = useNavigate();

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile-mini', session?.user.id],
    enabled: !!session?.user.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('id', session!.user.id)
        .single();
      return data as { username: string; display_name: string | null; avatar_url: string | null } | null;
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
          <Link to="/feed" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>
            <svg height="24" width="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path clipRule="evenodd" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" fill="#D97757" fillRule="evenodd" />
            </svg>
            <span>DevMeme Hub</span>
          </Link>

          <div style={{ flex: 1, maxWidth: '500px', margin: '0 24px' }}>
            <SearchBar />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {session ? (
              <>
                <Link to="/post/new" className="btn btn-primary btn-sm">
                  <NewPostIcon size={16} color="currentColor" />
                  <span>Создать</span>
                </Link>
                <button onClick={handleLogout} className="btn btn-sm" title="Выйти">
                  <LogOut size={16} />
                  <span>Выйти</span>
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">Войти</Link>
            )}
          </div>
        </div>
      </header>

      <nav className="sub-nav">
        <Link to="/post/new" className="sub-nav-link"><NewPostIcon size={18} color="currentColor" />Новый пост</Link>
        <Link to="/feed" className="sub-nav-link"><HomeIcon size={18} color="currentColor" />Лента</Link>
        {session && myProfile && (
          <Link to={`/profile/${myProfile.username}`} className="sub-nav-link"><ProfileIcon size={18} color="currentColor" />Профиль</Link>
        )}
      </nav>

      <main className="main-layout">
        <section className="feed-column">
          <Outlet />
        </section>

        <aside className="right-sidebar">
          {session && myProfile && <UserCard session={session} myProfile={myProfile as MyProfile} />}
          <BrowseTags />
        </aside>
      </main>
    </div>
  );
};

type MyProfile = { username: string; display_name: string | null; avatar_url: string | null };

const UserCard: React.FC<{ session: NonNullable<AppShellProps['session']>; myProfile: MyProfile }> = ({ myProfile }) => {
  return (
    <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <img
          src={myProfile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${myProfile.username}`}
          alt={myProfile.username}
          style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: 'var(--bg-main)', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {myProfile.display_name || myProfile.username}
          </div>
          <div className="text-secondary" style={{ fontSize: '12px' }}>@{myProfile.username}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <Link to={`/profile/${myProfile.username}`} className="sub-nav-link" style={{ padding: '6px 8px', borderRadius: '6px', fontSize: '13px' }}>
          <ProfileIcon size={16} color="currentColor" />Профиль
        </Link>
        <Link to="/following" className="sub-nav-link" style={{ padding: '6px 8px', borderRadius: '6px', fontSize: '13px' }}>
          <Users size={16} />Подписки
        </Link>
        <Link to="/saved" className="sub-nav-link" style={{ padding: '6px 8px', borderRadius: '6px', fontSize: '13px' }}>
          <Bookmark size={16} />Сохранённые
        </Link>
        <Link to="/settings" className="sub-nav-link" style={{ padding: '6px 8px', borderRadius: '6px', fontSize: '13px' }}>
          <SettingsIcon size={16} color="currentColor" />Настройки
        </Link>
      </div>
    </div>
  );
};

const BrowseTags: React.FC = () => {
  const { data: tags, isLoading, error } = useTopTags(12);

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Популярные теги</h3>

      {isLoading && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} style={{
              padding: '4px 10px',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              opacity: 0.5,
            }}>
              loading…
            </span>
          ))}
        </div>
      )}

      {!isLoading && (error || !tags || tags.length === 0) && (
        <div className="text-secondary" style={{ fontSize: '13px' }}>
          Тегов пока нет. Создайте пост и добавьте теги!
        </div>
      )}

      {!isLoading && tags && tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {tags.map((t) => (
            <Link
              key={t.id}
              to={`/tag/${t.name}`}
              style={{
                padding: '4px 10px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '20px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>#{t.name}</span>
              <span className="mono" style={{ fontSize: '11px', opacity: 0.7 }}>{t.count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppShell;
