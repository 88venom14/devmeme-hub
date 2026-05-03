import React, { memo, useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import type { MyProfile } from '../../types';
import SearchBar from './SearchBar';
import { useTopTags } from '../../hooks/useTopTags';
import { useMyProfile } from '../../hooks/useMyProfile';
import { useSessionContext } from '../../context/SessionContext';
import Avatar from '../Avatar';
import ChatWidget from '../chat/ChatWidget';

const StableOutlet = memo(() => <Outlet />);
StableOutlet.displayName = 'StableOutlet';

interface AppShellProps {
  session: Session | null;
}

const AppShell: React.FC<AppShellProps> = () => {
  const session = useSessionContext();
  const location = useLocation();
  const [navHidden, setNavHidden] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const lastScrollY = useRef(0);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navRef.current) setNavHeight(navRef.current.offsetHeight);
  }, []);

  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const y = window.scrollY;
        if (y < 80) setNavHidden(false);
        else if (y > lastScrollY.current + 4) setNavHidden(true);
        else if (y < lastScrollY.current - 4) setNavHidden(false);
        lastScrollY.current = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const { data: myProfile } = useMyProfile(session?.user.id);


  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="app-shell">
      <div ref={navRef} className={`nav-wrapper${navHidden ? ' nav-hidden' : ''}`}>
        {/* Top bar */}
        <header className="top-nav">
          <Link
            to="/feed"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: 'var(--accent)', textDecoration: 'none',
              fontWeight: 700, fontSize: 16,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 26, height: 26,
              fontSize: 14, fontWeight: 800,
            }}
            >
              <svg><path clip-rule="evenodd" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" fill="#D97757" fill-rule="evenodd"></path></svg>
            </div>
            <span>devMeme</span>
          </Link>

          <div style={{ flex: 1, maxWidth: 480, margin: '0 auto' }}>
            <SearchBar />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {session ? (
              <>
                <Link to="/post/new" className="btn btn-primary btn-sm" style={{ gap: 5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  Создать
                </Link>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">Войти</Link>
            )}
          </div>
        </header>

        {/* Secondary nav */}
        <nav className="sub-nav">
          <Link to="/post/new" className={`sub-nav-link${isActive('/post/new') ? ' active' : ''}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Новый пост
          </Link>
          <Link to="/feed" className={`sub-nav-link${location.pathname === '/feed' ? ' active' : ''}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /></svg>
            Лента
          </Link>
          {session && myProfile && (
            <Link to={`/profile/${myProfile.username}`} className={`sub-nav-link${isActive('/profile') ? ' active' : ''}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>
              Профиль
            </Link>
          )}
          {session && (
            <Link to="/chat" className={`sub-nav-link${isActive('/chat') ? ' active' : ''}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Чат
            </Link>
          )}
        </nav>
      </div>

      <main className="main-layout">
        <section className="feed-column">
          <StableOutlet />
        </section>

        <aside className="right-sidebar" style={{ top: navHidden ? 16 : navHeight + 16 }}>
          {session && myProfile && <UserCard myProfile={myProfile} location={location} />}
          <BrowseTags />
          <ChatWidget />
        </aside>
      </main>
    </div>
  );
};

const UserCard = memo(({ myProfile, location }: { myProfile: MyProfile; location: ReturnType<typeof useLocation> }) => {
  const navLinks = [
    {
      to: `/profile/${myProfile.username}`,
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>,
      label: 'Профиль',
    },
    {
      to: '/following',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11h-2z" /></svg>,
      label: 'Подписки',
    },
    {
      to: '/saved',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>,
      label: 'Сохранённое',
    },
    {
      to: '/settings',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
      label: 'Настройки',
    },
  ];

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Avatar src={myProfile.avatar_url} name={myProfile.display_name || myProfile.username} size={42} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {myProfile.display_name || myProfile.username}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            @{myProfile.username}
          </div>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navLinks.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 8px',
                background: active ? 'var(--bg-2)' : 'transparent',
                borderRadius: 6,
                color: active ? 'var(--text-1)' : 'var(--text-2)',
                fontSize: 13,
                textDecoration: 'none',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
});

UserCard.displayName = 'UserCard';

const BrowseTags = memo(() => {
  const { data: tags, isLoading } = useTopTags(14);

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Популярные теги</h4>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} style={{
              padding: '3px 9px',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 999, fontSize: 11,
              color: 'var(--text-3)', opacity: 0.5,
              fontFamily: 'var(--font-mono)',
            }}>···</span>
          ))}
        </div>
      )}

      {!isLoading && tags && tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {tags.map((t) => (
            <Link
              key={t.id}
              to={`/tag/${t.name}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                color: 'var(--text-2)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                textDecoration: 'none',
                letterSpacing: '0.01em',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            >
              {t.name}
              <span style={{ opacity: 0.5, fontSize: 10 }}>{t.count}</span>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && (!tags || tags.length === 0) && (
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Тегов пока нет.</div>
      )}
    </div>
  );
});

BrowseTags.displayName = 'BrowseTags';

export default AppShell;
