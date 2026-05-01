// Right sidebar — profile card + popular tags + suggestions

const ProfileCard = ({ user, onNav, activeRoute }) => {
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Avatar name={user.name} color={user.color} size={42} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{user.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{user.handle}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <Stat n="42" label="посты" />
        <Stat n="1.2k" label="подп." />
        <Stat n="384" label="следит" />
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavLink icon="user" label="Профиль" onClick={() => onNav('profile')} active={activeRoute === 'profile'} />
        <NavLink icon="heart" label="Подписки" onClick={() => onNav('subs')} count={7} active={activeRoute === 'subs'} />
        <NavLink icon="bookmark" label="Сохранённое" onClick={() => onNav('saved')} count={12} active={activeRoute === 'saved'} />
        <NavLink icon="settings" label="Настройки" onClick={() => onNav('settings')} active={activeRoute === 'settings'} />
      </nav>
    </div>
  );
};

const Stat = ({ n, label }) => (
  <div style={{
    background: 'var(--bg-2)',
    borderRadius: 6,
    padding: '8px 6px',
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{n}</div>
    <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{label}</div>
  </div>
);

const NavLink = ({ icon, label, count, onClick, active = false }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 8px',
      background: active ? 'var(--bg-2)' : 'transparent',
      border: 'none',
      borderRadius: 6,
      color: active ? 'var(--text-1)' : 'var(--text-2)',
      fontSize: 13,
      fontFamily: 'var(--font-ui)',
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left',
      transition: 'background 0.12s, color 0.12s',
    }}
    onMouseEnter={e => !active && (e.currentTarget.style.background = 'var(--bg-2)')}
    onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
  >
    <Icon name={icon} size={15} />
    <span style={{ flex: 1 }}>{label}</span>
    {count != null && (
      <span style={{
        fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
      }}>{count}</span>
    )}
  </button>
);

const PopularTagsCard = ({ activeTag, onTagClick }) => {
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
      }}>
        <Icon name="trending" size={14} className="" />
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Популярные теги</h4>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {POPULAR_TAGS.map(t => {
          const display = t.tag.length > 18 ? t.tag.slice(0, 17) + '…' : t.tag;
          return (
            <Tag
              key={t.tag}
              count={t.count}
              active={activeTag === t.tag}
              onClick={() => onTagClick(t.tag)}
            >
              {display}
            </Tag>
          );
        })}
      </div>
    </div>
  );
};

const TrendingCard = () => {
  const items = [
    { rank: 1, title: 'rust borrow checker', delta: '+45%' },
    { rank: 2, title: 'css :has() селектор', delta: '+22%' },
    { rank: 3, title: 'когда тесты упали', delta: '+18%' },
    { rank: 4, title: 'tokyo ghoul re-read', delta: '+12%' },
  ];
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Icon name="flame" size={14} />
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>В тренде сегодня</h4>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(item => (
          <button
            key={item.rank}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 6px',
              background: 'transparent', border: 'none', borderRadius: 5,
              color: 'var(--text-2)', cursor: 'pointer', width: '100%',
              textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text-3)',
              width: 16,
            }}>0{item.rank}</span>
            <span style={{ fontSize: 12, flex: 1, color: 'var(--text-1)' }}>{item.title}</span>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: 'oklch(0.7 0.13 145)',
            }}>{item.delta}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

window.ProfileCard = ProfileCard;
window.PopularTagsCard = PopularTagsCard;
window.TrendingCard = TrendingCard;
window.NavLink = NavLink;
