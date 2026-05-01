// Composer-pinned at top of feed
const Composer = ({ user, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 12,
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer',
      transition: 'border-color 0.12s',
      marginBottom: 16,
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-2)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
  >
    <Avatar name={user.name} color={user.color} size={36} />
    <div style={{
      flex: 1,
      background: 'var(--bg-2)',
      borderRadius: 8,
      padding: '8px 12px',
      color: 'var(--text-3)',
      fontSize: 13,
      fontFamily: 'var(--font-ui)',
    }}>Поделись мемом, кодом или мыслью…</div>
    <div style={{ display: 'flex', gap: 4 }}>
      <IconBtn icon="image" />
      <IconBtn icon="video" />
      <IconBtn icon="lightning" />
    </div>
  </div>
);

const IconBtn = ({ icon }) => (
  <button style={{
    background: 'transparent', border: 'none',
    color: 'var(--text-3)', padding: 7, borderRadius: 5,
    cursor: 'pointer', display: 'flex',
  }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
  ><Icon name={icon} size={16} /></button>
);

// Profile page
const ProfilePage = ({ user, posts, onBack }) => {
  const [tab, setTab] = React.useState('posts');
  const tabs = [
    { id: 'posts', label: 'Посты', count: 42 },
    { id: 'liked', label: 'Лайкнутые', count: 128 },
    { id: 'saved', label: 'Сохранённое', count: 12 },
  ];
  return (
    <div>
      {/* Banner */}
      <div style={{
        height: 140,
        borderRadius: 12,
        marginBottom: -36,
        background: `
          radial-gradient(circle at 20% 30%, oklch(0.45 0.15 340) 0%, transparent 40%),
          radial-gradient(circle at 80% 60%, oklch(0.5 0.18 50) 0%, transparent 50%),
          oklch(0.22 0.04 60)
        `,
        border: '1px solid var(--border)',
      }} />
      <div style={{ padding: '0 18px', display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 18 }}>
        <Avatar name={user.name} color={user.color} size={72} ring={true} />
        <div style={{ flex: 1, paddingBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>{user.name}</h1>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{user.handle} · с нами с 2024</div>
        </div>
        <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
          <Button variant="secondary" size="sm" icon="settings">Редактировать</Button>
          <Button variant="primary" size="sm" icon="check">Подписан</Button>
        </div>
      </div>
      <p style={{ margin: '0 18px 18px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 520 }}>
        фронтендер, мемолог, любитель ts. жалуюсь на webpack 5 раз в день. ✦
      </p>

      <div style={{
        display: 'flex', gap: 4, padding: '0 14px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 14px',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              color: tab === t.id ? 'var(--text-1)' : 'var(--text-3)',
              fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: -1,
            }}
          >
            {t.label}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{t.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

window.Composer = Composer;
window.ProfilePage = ProfilePage;
