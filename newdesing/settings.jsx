// Settings page — full profile editor

const SettingsFullPage = ({ user, onShowToast }) => {
  const [profile, setProfile] = React.useState({
    avatar: user.color,
    username: 'fluttershy',
    displayName: 'Fluttershy',
    bio: 'Круто аниматор, селка лих воина мари сповха',
    site: 'https://82venom14.github.io/Animark-pages',
    github: 'https://github.com/username',
    youtube: 'https://youtube.com/@channel',
    twitch: 'https://twitch.tv/username',
    socials: { youtube: true, twitch: false }
  });
  const [banner, setBanner] = React.useState('banner-1');
  const [showDanger, setShowDanger] = React.useState(false);

  const setField = (k, v) => setProfile({ ...profile, [k]: v });

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 18px', letterSpacing: '-0.01em' }}>Настройки</h1>

      {/* Profile info card */}
      <Card title="Информация профиля">
        <FieldLabel>Шапка профиля</FieldLabel>
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <div style={{
            height: 130, borderRadius: 8, overflow: 'hidden',
            background: `
              radial-gradient(circle at 30% 40%, oklch(0.5 0.18 25) 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, oklch(0.45 0.15 340) 0%, transparent 50%),
              oklch(0.22 0.04 60)
            `,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 14px, rgba(0,0,0,0.06) 14px 15px)'
            }} />
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 48, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.02em',
              fontStyle: 'italic',
              zIndex: 1
            }}>banner</div>
          </div>
          <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 6 }}>
            <Button variant="secondary" size="sm" icon="image">Изменить</Button>
            <Button variant="ghost" size="sm" icon="close">Удалить</Button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 14 }}>
          Рекомендуется 1500×500 px. PNG / JPG / WEBP.
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Avatar name={profile.displayName} color={profile.avatar} size={64} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, fontWeight: "500", width: "469px" }}>
            <Button variant="secondary" size="sm" icon="image">Загрузить аватар</Button>
            <Button variant="ghost" size="sm">Удалить</Button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <Field label="Имя пользователя">
            <input value={profile.username} onChange={(e) => setField('username', e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Отображаемое имя">
            <input value={profile.displayName} onChange={(e) => setField('displayName', e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <Field label="О себе">
          <textarea rows={3} value={profile.bio} onChange={(e) => setField('bio', e.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </Field>
      </Card>

      {/* Links and socials */}
      <Card title="Ссылки и соцсети">
        <Field label="Сайт">
          <div style={inputWrap}>
            <span style={prefixStyle}>🌐</span>
            <input value={profile.site} onChange={(e) => setField('site', e.target.value)} style={{ ...inputStyle, paddingLeft: 30 }} />
          </div>
        </Field>
        <Field label="GitHub" icon="○">
          <input value={profile.github} onChange={(e) => setField('github', e.target.value)} style={inputStyle} placeholder="https://github.com/username" />
        </Field>
        <Field label="YouTube" icon="▶">
          <input value={profile.youtube} onChange={(e) => setField('youtube', e.target.value)} style={inputStyle} placeholder="https://youtube.com/@channel" />
        </Field>
        <Field label="Twitch" icon="◇">
          <input value={profile.twitch} onChange={(e) => setField('twitch', e.target.value)} style={inputStyle} placeholder="https://twitch.tv/username" />
        </Field>

        <div style={{ marginTop: 16 }}>
          <Button variant="primary" icon="check" onClick={() => onShowToast('профиль сохранён ✓')}>Сохранить профиль</Button>
        </div>
      </Card>

      {/* Notifications */}
      <Card title="Уведомления">
        <ToggleRow label="Лайки на мои посты" defaultOn />
        <ToggleRow label="Комментарии" defaultOn />
        <ToggleRow label="Новые подписчики" defaultOn />
        <ToggleRow label="Email-дайджест раз в неделю" />
        <ToggleRow label="Push-уведомления в браузере" />
      </Card>

      {/* Privacy */}
      <Card title="Приватность">
        <ToggleRow label="Профиль видят только подписчики" />
        <ToggleRow label="Скрыть лайкнутое" />
        <ToggleRow label="Двухфакторная аутентификация" defaultOn />
      </Card>

      {/* Danger zone */}
      <div style={{
        background: 'transparent',
        border: '1px solid oklch(0.4 0.15 25)',
        borderRadius: 12, padding: 18, marginTop: 16
      }}>
        <h3 style={{
          margin: '0 0 12px', fontSize: 13, fontWeight: 600,
          color: 'oklch(0.7 0.2 25)',
          fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em'
        }}>Опасная зона</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DangerRow
            title="Выйти из аккаунта"
            desc="Завершить текущую сессию на этом устройстве"
            action="Выйти"
            onClick={() => onShowToast('вы вышли (демо)')} />
          
          <DangerRow
            title="Сбросить все настройки"
            desc="Вернуть приватность, уведомления и тему по умолчанию"
            action="Сбросить"
            onClick={() => onShowToast('настройки сброшены')} />
          
          <DangerRow
            title="Удалить аккаунт"
            desc="Это действие необратимо. Все посты и данные будут стёрты."
            action="Удалить"
            destructive
            onClick={() => setShowDanger(true)} />
          
        </div>
      </div>

      {showDanger &&
      <ConfirmDialog
        title="Удалить аккаунт?"
        desc="Все ваши посты, лайки и подписки будут удалены безвозвратно. Введите &laquo;DELETE&raquo; для подтверждения."
        confirmLabel="Удалить навсегда"
        requireText="DELETE"
        onCancel={() => setShowDanger(false)}
        onConfirm={() => {setShowDanger(false);onShowToast('демо: аккаунт не был удалён');}} />

      }
    </div>);

};

const Card = ({ title, children }) =>
<div style={{
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 18, marginBottom: 16
}}>
    <h3 style={{
    margin: '0 0 14px', fontSize: 13, fontWeight: 600,
    color: 'var(--text-1)',
    fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em'
  }}>{title}</h3>
    {children}
  </div>;


const FieldLabel = ({ children }) =>
<div style={{
  fontSize: 11, fontWeight: 500,
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  marginBottom: 6, marginTop: 4,
  letterSpacing: '0.02em'
}}>{children}</div>;


const Field = ({ label, children }) =>
<div style={{ marginBottom: 12 }}>
    <FieldLabel>{label}</FieldLabel>
    {children}
  </div>;


const inputStyle = {
  width: '100%',
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 10px',
  color: 'var(--text-1)',
  fontSize: 13,
  fontFamily: 'var(--font-mono)',
  outline: 'none'
};

const inputWrap = { position: 'relative' };
const prefixStyle = {
  position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
  fontSize: 12, color: 'var(--text-3)', pointerEvents: 'none'
};

const ToggleRow = ({ label, defaultOn = false }) => {
  const [on, setOn] = React.useState(defaultOn);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0',
      borderBottom: '1px solid var(--border)'
    }}>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)' }}>{label}</span>
      <button
        onClick={() => setOn(!on)}
        style={{
          width: 36, height: 20,
          background: on ? 'var(--accent)' : 'var(--bg-3)',
          border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-2)'),
          borderRadius: 999,
          padding: 0,
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.15s'
        }}>
        
        <div style={{
          position: 'absolute',
          top: 1, left: on ? 17 : 1,
          width: 16, height: 16,
          background: on ? 'oklch(0.15 0.01 60)' : 'var(--text-2)',
          borderRadius: '50%',
          transition: 'left 0.15s'
        }} />
      </button>
    </div>);

};

const DangerRow = ({ title, desc, action, destructive, onClick }) =>
<div style={{
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '12px 0',
  borderTop: '1px solid var(--border)'
}}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
    </div>
    <Button
    variant={destructive ? 'danger' : 'secondary'}
    size="sm"
    onClick={onClick}>
    {action}</Button>
  </div>;


const ConfirmDialog = ({ title, desc, confirmLabel, requireText, onCancel, onConfirm }) => {
  const [text, setText] = React.useState('');
  const ok = !requireText || text === requireText;
  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'oklch(0.1 0.01 60 / 0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeIn 0.15s ease-out'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg-1)',
        border: '1px solid oklch(0.4 0.15 25)',
        borderRadius: 12,
        width: '100%', maxWidth: 440,
        padding: 20,
        animation: 'slideUp 0.2s ease-out'
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: 'oklch(0.75 0.2 25)' }}>{title}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: desc }} />
        {requireText &&
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={requireText}
          style={{ ...inputStyle, marginBottom: 14 }} />

        }
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          <button
            disabled={!ok}
            onClick={onConfirm}
            style={{
              background: ok ? 'oklch(0.55 0.2 25)' : 'var(--bg-2)',
              border: '1px solid ' + (ok ? 'oklch(0.55 0.2 25)' : 'var(--border)'),
              color: ok ? 'white' : 'var(--text-3)',
              borderRadius: 6, padding: '6px 14px',
              fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 500,
              cursor: ok ? 'pointer' : 'not-allowed',
              opacity: ok ? 1 : 0.5
            }}>
            {confirmLabel}</button>
        </div>
      </div>
    </div>);

};

window.SettingsFullPage = SettingsFullPage;
window.Card = Card;
window.Field = Field;
window.FieldLabel = FieldLabel;