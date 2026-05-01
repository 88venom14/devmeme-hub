// Subscriptions page — list of followed users with their recent activity
const SubscriptionsPage = ({ onOpenProfile }) => {
  const subs = [
    { name: 'kira_404', handle: '@kira_404', color: 'oklch(0.65 0.18 280)', bio: 'дизайнер, любит ai-арт', online: true, lastPost: '2ч назад' },
    { name: 'memer_42', handle: '@memer_42', color: 'oklch(0.68 0.16 200)', bio: 'мемолог-теоретик. ph.d in кринж', online: true, lastPost: '5ч назад' },
    { name: 'nullptr', handle: '@nullptr', color: 'oklch(0.7 0.14 320)', bio: 'systems eng, c++/rust', online: false, lastPost: '1д назад' },
    { name: 'ui_witch', handle: '@ui_witch', color: 'oklch(0.72 0.15 100)', bio: 'фронт + figma, иногда колдую', online: false, lastPost: '2д назад' },
    { name: 'dev_356', handle: '@dev_356', color: 'oklch(0.72 0.13 145)', bio: 'джуниор, учусь в открытую', online: true, lastPost: '8ч назад' },
    { name: 'vasya_dev', handle: '@vasya_dev', color: 'oklch(0.7 0.15 60)', bio: 'бэкенд go/postgres', online: false, lastPost: '4д назад' },
    { name: 'ghoul_man', handle: '@ghoul_man', color: 'oklch(0.6 0.2 25)', bio: 'аниме, манга, ровно ничего ещё', online: false, lastPost: '1нед' },
  ];
  const [follows, setFollows] = React.useState(Object.fromEntries(subs.map(s => [s.handle, true])));
  const [search, setSearch] = React.useState('');

  const filtered = subs.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.bio.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Подписки</h1>
        <span style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {Object.values(follows).filter(Boolean).length} из {subs.length}
        </span>
      </div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="поиск среди подписок…"
          style={{
            width: '100%', background: 'var(--bg-1)',
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 12px 8px 32px',
            color: 'var(--text-1)', fontSize: 13,
            fontFamily: 'var(--font-ui)', outline: 'none',
          }}
        />
        <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', display: 'flex' }}>
          <Icon name="search" size={14} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(s => (
          <div key={s.handle} style={{
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ position: 'relative' }}>
              <Avatar name={s.name} color={s.color} size={40} />
              {s.online && (
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 10, height: 10, borderRadius: '50%',
                  background: 'oklch(0.7 0.18 145)',
                  border: '2px solid var(--bg-1)',
                }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{s.handle}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 1 }}>{s.bio}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                последний пост: {s.lastPost}
              </div>
            </div>
            <Button
              variant={follows[s.handle] ? 'secondary' : 'primary'}
              size="sm"
              icon={follows[s.handle] ? 'check' : 'plus'}
              onClick={() => setFollows({ ...follows, [s.handle]: !follows[s.handle] })}
            >{follows[s.handle] ? 'Подписан' : 'Подписаться'}</Button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Profile page (full) — banner, bio, stats, tabs, post grid
const ProfileFullPage = ({ user, posts, onOpenPost, onLike, onSave, onTagClick, onNav }) => {
  const [tab, setTab] = React.useState('posts');
  const myPosts = posts.slice(0, 4);
  const liked = posts.filter(p => p.liked);
  const saved = posts.filter(p => p.saved);
  const data = tab === 'posts' ? myPosts : tab === 'liked' ? liked : saved;

  const tabs = [
    { id: 'posts', label: 'Посты', count: myPosts.length },
    { id: 'liked', label: 'Лайкнутые', count: liked.length },
    { id: 'saved', label: 'Сохранённое', count: saved.length },
  ];

  return (
    <div>
      <div style={{
        height: 160, borderRadius: 12, overflow: 'hidden',
        background: `
          radial-gradient(circle at 20% 30%, oklch(0.45 0.15 340) 0%, transparent 45%),
          radial-gradient(circle at 80% 60%, oklch(0.5 0.18 50) 0%, transparent 50%),
          oklch(0.22 0.04 60)
        `,
        border: '1px solid var(--border)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 14px, rgba(0,0,0,0.05) 14px 15px)',
        }} />
      </div>

      <div style={{
        padding: '0 18px',
        display: 'flex', alignItems: 'flex-end', gap: 14,
        marginTop: -36, marginBottom: 14,
      }}>
        <Avatar name={user.name} color={user.color} size={72} ring={true} />
        <div style={{ flex: 1, paddingBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>Fluttershy</h1>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{user.handle} · с нами с июня 2024</div>
        </div>
        <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
          <Button variant="secondary" size="sm" icon="settings" onClick={() => onNav('settings')}>Редактировать</Button>
          <Button variant="primary" size="sm" icon="share">Поделиться</Button>
        </div>
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, maxWidth: 540 }}>
        Круто аниматор, селка лих воина мари сповха ✦ фронтендер, мемолог, любитель ts.
      </p>

      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <SocialLink icon="○" label="github.com/username" />
        <SocialLink icon="▶" label="youtube.com/@channel" />
        <SocialLink icon="🔗" label="82venom14.github.io" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
        <BigStat n="42" label="постов" />
        <BigStat n="1.2k" label="подписчиков" />
        <BigStat n="384" label="подписок" />
        <BigStat n="8.4k" label="лайков" />
      </div>

      <div style={{
        display: 'flex', gap: 4,
        borderBottom: '1px solid var(--border)',
        marginBottom: 16,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 14px', background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
              color: tab === t.id ? 'var(--text-1)' : 'var(--text-3)',
              fontSize: 13, fontFamily: 'var(--font-ui)',
              fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: -1,
            }}
          >
            {t.label}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{t.count}</span>
          </button>
        ))}
      </div>

      {data.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {data.map(p => (
            <PostCard key={p.id} post={p} onLike={onLike} onSave={onSave} onOpen={onOpenPost} onTagClick={onTagClick} />
          ))}
        </div>
      ) : (
        <div style={{ padding: 50, textAlign: 'center', color: 'var(--text-3)', border: '1px dashed var(--border)', borderRadius: 10 }}>
          пока ничего тут нет
        </div>
      )}
    </div>
  );
};

const SocialLink = ({ icon, label }) => (
  <a href="#" onClick={e => e.preventDefault()} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px',
    background: 'var(--bg-1)', border: '1px solid var(--border)',
    borderRadius: 6, fontSize: 12, color: 'var(--text-2)',
    textDecoration: 'none', fontFamily: 'var(--font-mono)',
  }}>
    <span>{icon}</span> {label}
  </a>
);

const BigStat = ({ n, label }) => (
  <div style={{
    background: 'var(--bg-1)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '14px 12px', textAlign: 'left',
  }}>
    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{n}</div>
    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{label}</div>
  </div>
);

window.SubscriptionsPage = SubscriptionsPage;
window.ProfileFullPage = ProfileFullPage;
