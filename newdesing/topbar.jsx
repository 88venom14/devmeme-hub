// Top navigation bar

const TopBar = ({ search, setSearch, onCreate, onLogin, route, setRoute, notifCount }) => {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'oklch(0.16 0.01 60 / 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
      padding: '10px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      {/* Logo */}
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); setRoute('feed'); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          color: 'var(--accent)', textDecoration: 'none',
          fontWeight: 700, fontSize: 16,
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.02em',
        }}
      >
        <div style={{
          width: 26, height: 26,
          background: 'var(--accent)',
          color: 'oklch(0.15 0.01 60)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800,
        }}>D</div>
        <span style={{ whiteSpace: 'nowrap' }}>devmeme</span>
      </a>

      {/* Search */}
      <div style={{
        flex: 1, maxWidth: 480,
        position: 'relative',
        margin: '0 auto',
      }}>
        <div style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-3)',
          pointerEvents: 'none',
          display: 'flex',
        }}>
          <Icon name="search" size={14} />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="поиск тегов, авторов, мемов…"
          style={{
            width: '100%',
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-1)',
            padding: '7px 10px 7px 32px',
            fontSize: 13,
            fontFamily: 'var(--font-ui)',
            outline: 'none',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        />
        <div style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)', fontSize: 10,
          padding: '2px 5px',
          border: '1px solid var(--border)',
          borderRadius: 3,
          pointerEvents: 'none',
        }}>⌘K</div>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => alert('Уведомлений нет')}
          style={{
            position: 'relative',
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 6, padding: 7,
            color: 'var(--text-2)', cursor: 'pointer',
            display: 'flex',
          }}
        >
          <Icon name="bell" size={15} />
          {notifCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: 'var(--accent)', color: 'oklch(0.15 0.01 60)',
              fontSize: 9, fontWeight: 700,
              padding: '1px 4px',
              borderRadius: 999,
              fontFamily: 'var(--font-mono)',
              minWidth: 14,
              textAlign: 'center',
            }}>{notifCount}</span>
          )}
        </button>
        <Button variant="primary" icon="plus" onClick={onCreate}>Создать</Button>
        <Button variant="secondary" icon="logout" onClick={onLogin}>Войти</Button>
      </div>
    </header>
  );
};

// Secondary nav row with filters and sorts
const FilterBar = ({ filter, setFilter, sort, setSort, postCount }) => {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
      marginBottom: 16,
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '5px 11px',
              background: filter === f.id ? 'var(--bg-2)' : 'transparent',
              border: '1px solid',
              borderColor: filter === f.id ? 'var(--border-2)' : 'transparent',
              borderRadius: 6,
              color: filter === f.id ? 'var(--text-1)' : 'var(--text-3)',
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              fontWeight: filter === f.id ? 500 : 400,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => filter !== f.id && (e.currentTarget.style.color = 'var(--text-2)')}
            onMouseLeave={e => filter !== f.id && (e.currentTarget.style.color = 'var(--text-3)')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--text-3)',
      }}>
        <span>{postCount} постов</span>
      </div>

      <div style={{
        display: 'inline-flex',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 2,
      }}>
        {SORTS.map(s => (
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
          >
            {s.id === 'hot' && <Icon name="flame" size={12} />}
            {s.id === 'new' && <Icon name="sparkle" size={12} />}
            {s.id === 'top' && <Icon name="trending" size={12} />}
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};

window.TopBar = TopBar;
window.FilterBar = FilterBar;
