import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, FileText, Gamepad2 } from 'lucide-react';

const TABS = [
  { to: '/admin/posts', label: 'Посты', icon: FileText },
  { to: '/admin/games', label: 'Игры', icon: Gamepad2 },
];

/** Shared header + tab bar for the admin panel sections. */
const AdminNav: React.FC = () => {
  const location = useLocation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldCheck size={24} style={{ color: 'var(--accent)' }} /> Админ-панель
      </h1>
      <nav style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map((t) => {
          const active = location.pathname === t.to || location.pathname.startsWith(t.to + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px',
                borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                color: active ? 'var(--text-1)' : 'var(--text-3)',
                fontSize: 14, fontWeight: active ? 600 : 400,
                textDecoration: 'none', marginBottom: -1,
              }}
            >
              <Icon size={15} /> {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default AdminNav;
