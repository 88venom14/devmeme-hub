import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import {
  Home,
  Search,
  PlusSquare,
  User,
  Settings,
  Bookmark,
  TrendingUp,
  Users,
  LogOut,
  Terminal,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AppShellProps {
  session: Session | null;
}

const AppShell: React.FC<AppShellProps> = ({ session }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    navigate(`/tag/${encodeURIComponent(q.replace(/^#/, ''))}`);
  };

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>
            <Terminal size={24} />
            <span>DevMeme Hub</span>
          </Link>

          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, maxWidth: '500px', margin: '0 24px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={16} />
              <input
                type="text"
                placeholder="Search by tag (press Enter)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px', height: '36px' }}
              />
            </div>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {session ? (
              <>
                <Link to="/post/new" className="btn btn-primary btn-sm">
                  <PlusSquare size={16} />
                  <span>Create</span>
                </Link>
                <button onClick={handleLogout} className="btn btn-sm" title="Logout">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">Login</Link>
            )}
          </div>
        </div>
      </header>

      <main className="main-layout">
        <aside className="left-sidebar">
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <SidebarLink to="/" icon={<Home size={20} />} label="Feed" />
            <SidebarLink to="/trending" icon={<TrendingUp size={20} />} label="Trending" />
            <SidebarLink to="/following" icon={<Users size={20} />} label="Following" />
            <SidebarLink to="/saved" icon={<Bookmark size={20} />} label="Saved" />

            {session && (
              <>
                <div style={{ margin: '16px 0 8px 12px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Account</div>
                <SidebarLink to={`/profile/${session.user.id}`} icon={<User size={20} />} label="Profile" />
                <SidebarLink to="/settings" icon={<Settings size={20} />} label="Settings" />
              </>
            )}
          </nav>
        </aside>

        <section className="feed-column">
          <Outlet />
        </section>

        <aside className="right-sidebar">
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Browse Tags</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <TagChip name="rust" />
              <TagChip name="typescript" />
              <TagChip name="react" />
              <TagChip name="ai" />
              <TagChip name="supabase" />
              <TagChip name="vite" />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

const SidebarLink = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => (
  <Link to={to} style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    textDecoration: 'none',
  }} className="sidebar-link">
    {icon}
    <span>{label}</span>
  </Link>
);

const TagChip = ({ name }: { name: string }) => (
  <Link to={`/tag/${name}`} style={{
    padding: '4px 10px',
    backgroundColor: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  }}>
    #{name}
  </Link>
);

export default AppShell;
