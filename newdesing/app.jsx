// Main app

const CURRENT_USER = {
  name: 'fluttershy', handle: '@fluttershy',
  color: 'oklch(0.72 0.14 340)'
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentHue": 50,
  "density": "comfortable",
  "columns": 3,
  "fontUi": "Cascadia Code",
  "showTrending": true,
  "cardRadius": 12
} /*EDITMODE-END*/;

const App = () => {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [posts, setPosts] = React.useState(SEED_POSTS);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState('hot');
  const [activeTag, setActiveTag] = React.useState(null);
  const [openPostId, setOpenPostId] = React.useState(null);
  const [route, setRoute] = React.useState('feed');
  const [toast, setToast] = React.useState(null);
  const [headerHidden, setHeaderHidden] = React.useState(false);

  // Hide header on scroll down, show on scroll up
  React.useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (y < 80) setHeaderHidden(false);else
        if (dy > 4) setHeaderHidden(true);else
        if (dy < -4) setHeaderHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--accent-h', tweaks.accentHue);
    document.documentElement.style.setProperty('--font-ui', `"${tweaks.fontUi}", system-ui, sans-serif`);
    document.documentElement.style.setProperty('--card-radius', tweaks.cardRadius + 'px');
  }, [tweaks]);

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('input[placeholder^="поиск"]')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setRoute('create');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = React.useMemo(() => {
    let r = posts;
    if (filter !== 'all') r = r.filter((p) => p.type === filter);
    if (activeTag) r = r.filter((p) => p.tags?.includes(activeTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.author.name.toLowerCase().includes(q) ||
      p.tags?.some((t) => t.toLowerCase().includes(q)) ||
      p.body?.toLowerCase().includes(q)
      );
    }
    if (sort === 'new') r = [...r].sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'top') r = [...r].sort((a, b) => b.likes - a.likes);
    if (sort === 'hot') r = [...r].sort((a, b) => b.likes + b.comments * 2 - (a.likes + a.comments * 2));
    return r;
  }, [posts, filter, sort, activeTag, search]);

  const onLike = (id) => setPosts(posts.map((p) => p.id === id ? { ...p, liked: !p.liked } : p));
  const onSave = (id) => {
    const p = posts.find((x) => x.id === id);
    setPosts(posts.map((x) => x.id === id ? { ...x, saved: !x.saved } : x));
    showToast(p?.saved ? 'удалено из сохранённого' : 'пост сохранён');
  };
  const onCreatePost = (post) => {
    setPosts([post, ...posts]);
    setRoute('feed');
    showToast('пост опубликован 🎉');
  };
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };
  const onTagClick = (t) => {
    setActiveTag(activeTag === t ? null : t);
    setRoute('feed');
  };

  const openPost = posts.find((p) => p.id === openPostId);
  const colsMap = { 2: 'repeat(2, minmax(0, 1fr))', 3: 'repeat(3, minmax(0, 1fr))', 4: 'repeat(4, minmax(0, 1fr))' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-1)' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 60,
        transform: headerHidden ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'var(--bg-0)'
      }}>
        <TopBar
          search={search} setSearch={setSearch}
          onCreate={() => setRoute('create')}
          onLogin={() => showToast('демо-режим: вы уже вошли')}
          route={route} setRoute={setRoute}
          notifCount={3} />
        
        <SecondaryNav route={route} setRoute={setRoute} />
      </div>

      <main style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 760px) 280px',
        justifyContent: 'center',
        gap: 24,
        alignItems: 'flex-start'
      }}>
        <section style={{ minWidth: 0 }}>
          {route === 'feed' &&
          <>
              <Composer user={CURRENT_USER} onClick={() => setRoute('create')} />

              {activeTag &&
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: 'oklch(0.65 0.18 var(--accent-h, 50) / 0.08)',
              border: '1px solid oklch(0.45 0.15 var(--accent-h, 50))',
              borderRadius: 10, marginBottom: 12
            }}>
                  <Icon name="tag" size={14} />
                  <span style={{ fontSize: 13, color: 'var(--text-1)' }}>
                    Фильтр по тегу <code style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{activeTag}</code>
                  </span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setActiveTag(null)} style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-2)', borderRadius: 5, padding: '3px 8px',
                fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)'
              }}>сбросить ✕</button>
                </div>
            }

              <FilterBar filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} postCount={filtered.length} />

              {filtered.length === 0 ?
            <EmptyState search={search} onClear={() => {setSearch('');setActiveTag(null);setFilter('all');}} /> :

            <div style={{
              display: 'grid',
              gridTemplateColumns: colsMap[tweaks.columns] || '1fr 1fr 1fr',
              gap: tweaks.density === 'compact' ? 10 : 14
            }}>
                  {filtered.map((p) =>
              <PostCard key={p.id} post={p} onLike={onLike} onSave={onSave} onOpen={(id) => {setOpenPostId(id);setRoute('post');}} onTagClick={onTagClick} />
              )}
                </div>
            }
            </>
          }

          {route === 'create' &&
            <NewPostPage onSubmit={onCreatePost} onCancel={() => setRoute('feed')} />
          }

          {route === 'post' && openPost &&
          <PostFullPage
            post={openPost}
            allPosts={posts}
            onBack={() => {setRoute('feed');setOpenPostId(null);}}
            onLike={onLike}
            onSave={onSave}
            onTagClick={onTagClick}
            onOpenPost={(id) => {setOpenPostId(id);window.scrollTo(0, 0);}}
            onShowToast={showToast} />

          }

          {route === 'profile' &&
          <ProfileFullPage user={CURRENT_USER} posts={posts} onOpenPost={(id) => {setOpenPostId(id);setRoute('post');}} onLike={onLike} onSave={onSave} onTagClick={onTagClick} onNav={setRoute} />
          }

          {route === 'subs' &&
            <SubscriptionsPage onOpenProfile={() => {}} />
          }

          {route === 'saved' &&
          <div style={{ textAlign: "left" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Сохранённое</h1>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 18px' }}>Ваша личная коллекция постов</p>
              {posts.filter((p) => p.saved).length > 0 ?
            <div style={{
              display: 'grid',
              gridTemplateColumns: colsMap[tweaks.columns] || '1fr 1fr 1fr',
              gap: 14, fontWeight: "100", textAlign: "left"
            }}>
                  {posts.filter((p) => p.saved).map((p) =>
              <PostCard key={p.id} post={p} onLike={onLike} onSave={onSave} onOpen={(id) => {setOpenPostId(id);setRoute('post');}} onTagClick={onTagClick} />
              )}
                </div> :

            <div style={{ padding: '60px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-3)' }}>
                  <Icon name="bookmark" size={28} />
                  <div style={{ fontSize: 14, marginTop: 10 }}>пока ничего не сохранено</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>нажмите на иконку закладки на любом посте</div>
                </div>
            }
            </div>
          }

          {route === 'settings' &&
            <SettingsFullPage user={CURRENT_USER} onShowToast={showToast} />
          }
        </section>

        <aside style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          position: 'sticky', top: 110
        }}>
          <ProfileCard user={CURRENT_USER} onNav={setRoute} activeRoute={route} />
          <PopularTagsCard activeTag={activeTag} onTagClick={onTagClick} />
          {tweaks.showTrending && route === 'feed' && <TrendingCard />}
        </aside>
      </main>



      {toast &&
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--bg-3)', color: 'var(--text-1)',
        border: '1px solid var(--border-2)',
        padding: '10px 18px', borderRadius: 8,
        fontSize: 13, fontFamily: 'var(--font-ui)',
        zIndex: 200, animation: 'slideUp 0.18s ease-out',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}>{toast}</div>
      }

      <TweaksPanel>
        <TweakSection title="Внешний вид">
          <TweakSlider label="Оттенок акцента" value={tweaks.accentHue} min={0} max={360} step={5} onChange={(v) => setTweak('accentHue', v)} suffix="°" />
          <TweakSlider label="Скругление карточек" value={tweaks.cardRadius} min={0} max={20} step={1} onChange={(v) => setTweak('cardRadius', v)} suffix="px" />
          <TweakRadio label="Плотность" value={tweaks.density} options={[{ value: 'compact', label: 'Плотно' }, { value: 'comfortable', label: 'Свободно' }]} onChange={(v) => setTweak('density', v)} />
        </TweakSection>
        <TweakSection title="Сетка">
          <TweakRadio label="Колонок" value={tweaks.columns} options={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]} onChange={(v) => setTweak('columns', v)} />
        </TweakSection>
        <TweakSection title="Шрифты">
          <TweakSelect label="UI шрифт" value={tweaks.fontUi} options={[
          { value: 'Cascadia Code', label: 'Cascadia Code' },
          { value: 'Cascadia Mono', label: 'Cascadia Mono' },
          { value: 'Inter Tight', label: 'Inter Tight' },
          { value: 'Geist', label: 'Geist' },
          { value: 'IBM Plex Sans', label: 'IBM Plex Sans' },
          { value: 'Space Grotesk', label: 'Space Grotesk' }]
          } onChange={(v) => setTweak('fontUi', v)} />
        </TweakSection>
        <TweakSection title="Сайдбар">
          <TweakToggle label="Показать «В тренде»" value={tweaks.showTrending} onChange={(v) => setTweak('showTrending', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>);

};

const SecondaryNav = ({ route, setRoute }) => {
  const items = [
  { id: 'create', label: 'Новый пост', icon: 'plus' },
  { id: 'feed', label: 'Лента', icon: 'feed' },
  { id: 'profile', label: 'Профиль', icon: 'user' }];

  return (
    <nav style={{
      display: 'flex', justifyContent: 'center', gap: 4,
      padding: '8px 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-0)'
    }}>
      {items.map((it) =>
      <button key={it.id}
      onClick={() => setRoute(it.id)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        background: route === it.id ? 'var(--bg-2)' : 'transparent',
        border: 'none', borderRadius: 6,
        color: route === it.id ? 'var(--accent)' : 'var(--text-3)',
        fontSize: 12, fontFamily: 'var(--font-ui)',
        fontWeight: route === it.id ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.12s',
        whiteSpace: 'nowrap'
      }}>
        
          <Icon name={it.icon} size={13} />
          {it.label}
        </button>
      )}
    </nav>);

};

const EmptyState = ({ search, onClear }) =>
<div style={{
  padding: '60px 20px', textAlign: 'center',
  border: '1px dashed var(--border)',
  borderRadius: 12, color: 'var(--text-3)'
}}>
    <Icon name="search" size={28} />
    <div style={{ fontSize: 15, color: 'var(--text-1)', marginTop: 12, fontWeight: 500 }}>Ничего не найдено</div>
    <div style={{ fontSize: 13, marginTop: 4 }}>
      {search ? <>по запросу <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>«{search}»</code></> : 'попробуй другой фильтр'}
    </div>
    <div style={{ marginTop: 16 }}>
      <Button variant="secondary" size="sm" onClick={onClear}>сбросить фильтры</Button>
    </div>
  </div>;


ReactDOM.createRoot(document.getElementById('root')).render(<App />);