import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SearchBar from './SearchBar';
import { useTopTags } from '../../hooks/useTopTags';
import { useQuery } from '@tanstack/react-query';
import { HomeIcon, NewPostIcon, ProfileIcon, SettingsIcon, SavedIcon, SubscriptionsIcon } from '../icons';
import { useSessionContext } from '../../context/SessionContext';

// Prevents AppShell scroll re-renders (navHidden state) from cascading into page components.
// React Router's Outlet subscribes to router context internally, so navigation still works.
const StableOutlet = memo(() => <Outlet />);
StableOutlet.displayName = 'StableOutlet';

interface AppShellProps {
  session: Session | null;
}

type MyProfile = { username: string; display_name: string | null; avatar_url: string | null };

const AppShell: React.FC<AppShellProps> = () => {
  const session = useSessionContext();
  const navigate = useNavigate();
  const [navHidden, setNavHidden] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const lastScrollY = useRef(0);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navRef.current) {
      setNavHeight(navRef.current.offsetHeight);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 80) {
        setNavHidden(false);
      } else if (currentY > lastScrollY.current + 4) {
        setNavHidden(true);
      } else if (currentY < lastScrollY.current - 4) {
        setNavHidden(false);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
      return data as MyProfile | null;
    },
  });

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login');
  }, [navigate]);

  return (
    <div className="app-shell">
      <div ref={navRef} className={`nav-wrapper${navHidden ? ' nav-hidden' : ''}`}>
        <header className="top-nav">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: '1400px',
              margin: '0 auto',
            }}
          >
            <Link
              to="/feed"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--accent-primary)',
                fontWeight: 'bold',
                fontSize: '1.2rem',
              }}
            >
              <svg
                height="24"
                width="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  clipRule="evenodd"
                  d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
                  fill="#D97757"
                  fillRule="evenodd"
                />
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
                    <NewPostIcon size={16} />
                    <span>Создать</span>
                  </Link>
                  <button onClick={handleLogout} className="btn btn-sm" title="Выйти">
                    <LogOut size={16} />
                    <span>Выйти</span>
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn btn-primary btn-sm">
                  Войти
                </Link>
              )}
            </div>
          </div>
        </header>

        <nav className="sub-nav">
          <Link to="/post/new" className="sub-nav-link">
            <NewPostIcon size={18} />
            Новый пост
          </Link>
          <Link to="/feed" className="sub-nav-link">
            <HomeIcon size={18} />
            Лента
          </Link>
          {session && myProfile && (
            <Link to={`/profile/${myProfile.username}`} className="sub-nav-link">
              <ProfileIcon size={18} />
              Профиль
            </Link>
          )}
        </nav>
      </div>

      <main className="main-layout">
        <section className="feed-column">
          <StableOutlet />
        </section>

        <aside
          className="right-sidebar"
          style={{ top: navHidden ? 16 : navHeight + 16 }}
        >
          {session && myProfile && (
            <UserCard myProfile={myProfile} />
          )}
          <BrowseTags />
        </aside>
      </main>
    </div>
  );
};

const UserCard = memo(({ myProfile }: { myProfile: MyProfile }) => (
  <div className="card" style={{ padding: '16px', marginBottom: '12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <img
        src={
          myProfile.avatar_url ||
          `https://api.dicebear.com/7.x/identicon/svg?seed=${myProfile.username}`
        }
        alt={myProfile.username}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-main)',
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 'bold',
            fontSize: '14px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {myProfile.display_name || myProfile.username}
        </div>
        <div className="text-secondary" style={{ fontSize: '12px' }}>
          @{myProfile.username}
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <Link
        to={`/profile/${myProfile.username}`}
        className="sub-nav-link"
        style={{ padding: '6px 8px', borderRadius: '6px', fontSize: '13px' }}
      >
        <ProfileIcon size={16} />
        Профиль
      </Link>
      <Link
        to="/following"
        className="sub-nav-link"
        style={{ padding: '6px 8px', borderRadius: '6px', fontSize: '13px' }}
      >
        <SubscriptionsIcon size={16} />
        Подписки
      </Link>
      <Link
        to="/saved"
        className="sub-nav-link"
        style={{ padding: '6px 8px', borderRadius: '6px', fontSize: '13px' }}
      >
        <SavedIcon size={16} />
        Сохранённые
      </Link>
      <Link
        to="/settings"
        className="sub-nav-link"
        style={{ padding: '6px 8px', borderRadius: '6px', fontSize: '13px' }}
      >
        <SettingsIcon size={16} />
        Настройки
      </Link>
    </div>
  </div>
));

UserCard.displayName = 'UserCard';

const BrowseTags = memo(() => {
  const { data: tags, isLoading, error } = useTopTags(12);

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Популярные теги</h3>

      {isLoading && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              style={{
                padding: '4px 10px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '20px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                opacity: 0.5,
              }}
            >
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
              <span className="mono" style={{ fontSize: '11px', opacity: 0.7 }}>
                {t.count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});

BrowseTags.displayName = 'BrowseTags';

export default AppShell;
