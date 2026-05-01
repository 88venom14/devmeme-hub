import React, { memo, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';
import { uploadPostMedia } from '../lib/storage';
import { useSessionContext } from '../context/SessionContext';
import { LIMITS, isValidUrl, isValidGithubUrl, isValidYoutubeUrl, isValidTwitchUrl, validateUsername } from '../lib/validation';

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{
    background: 'var(--bg-1)', border: '1px solid var(--border)',
    borderRadius: 'var(--card-radius)', padding: 18, marginBottom: 14,
  }}>
    <h3 style={{
      margin: '0 0 14px', fontSize: 11, fontWeight: 600,
      color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase', letterSpacing: '0.07em',
    }}>{title}</h3>
    {children}
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 500, color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)', marginBottom: 5, marginTop: 2,
    letterSpacing: '0.04em', textTransform: 'uppercase',
  }}>{children}</div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '8px 10px', color: 'var(--text-1)',
  fontSize: 13, fontFamily: 'var(--font-ui)', outline: 'none',
};

const ToggleRow = memo(({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)' }}>{label}</span>
      <button
        onClick={() => setOn(!on)}
        style={{
          width: 36, height: 20, flexShrink: 0,
          background: on ? 'var(--accent)' : 'var(--bg-3)',
          border: `1px solid ${on ? 'var(--accent)' : 'var(--border-2)'}`,
          borderRadius: 999, padding: 0, cursor: 'pointer',
          position: 'relative', transition: 'background 0.15s',
        }}
      >
        <div style={{
          position: 'absolute', top: 1, left: on ? 17 : 1,
          width: 16, height: 16,
          background: on ? 'oklch(0.15 0.01 60)' : 'var(--text-2)',
          borderRadius: '50%', transition: 'left 0.15s',
        }} />
      </button>
    </div>
  );
});
ToggleRow.displayName = 'ToggleRow';

const GithubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.01c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.21-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.05.78 2.12v3.14c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
  </svg>
);
const YoutubeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000" aria-hidden="true">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
  </svg>
);
const TwitchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#9146FF" aria-hidden="true">
    <path d="M2.149 0L.537 4.119v16.836h5.731V24h3.224l3.045-3.045h4.657L23.463 14.7V0H2.149zm19.164 13.612l-3.582 3.582h-5.731l-3.045 3.045v-3.045H4.119V1.612h17.194v12zM18.358 5.731h-1.971v5.731h1.971V5.731zm-5.731 0h-1.971v5.731h1.971V5.731z" />
  </svg>
);

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSessionContext();
  const userId = session?.user.id;
  const userEmail = session?.user.email ?? '';
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [twitchUrl, setTwitchUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-settings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  useEffect(() => {
    if (!profile) { setUsername(userEmail.split('@')[0] ?? ''); return; }
    setUsername(profile.username ?? '');
    setDisplayName(profile.display_name ?? '');
    setBio(profile.bio ?? '');
    setWebsite(profile.website_url ?? '');
    setAvatarUrl(profile.avatar_url);
    setBannerUrl(profile.banner_url ?? null);
    setGithubUrl(profile.github_url ?? '');
    setYoutubeUrl(profile.youtube_url ?? '');
    setTwitchUrl(profile.twitch_url ?? '');
  }, [profile, userEmail]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Вы не авторизованы');
      const cleanUsername = username.trim().toLowerCase();
      const usernameErr = validateUsername(cleanUsername);
      if (usernameErr) throw new Error(usernameErr);
      if (displayName.trim().length > LIMITS.displayName)
        throw new Error(`Отображаемое имя: максимум ${LIMITS.displayName} символов`);
      if (bio.trim().length > LIMITS.bio)
        throw new Error(`О себе: максимум ${LIMITS.bio} символов`);
      if (website.trim() && !isValidUrl(website.trim()))
        throw new Error('Сайт: введите корректный URL (https://...)');
      if (website.trim().length > LIMITS.websiteUrl)
        throw new Error(`Сайт: максимум ${LIMITS.websiteUrl} символов`);
      if (githubUrl.trim() && !isValidGithubUrl(githubUrl.trim()))
        throw new Error('GitHub: только ссылки на github.com');
      if (youtubeUrl.trim() && !isValidYoutubeUrl(youtubeUrl.trim()))
        throw new Error('YouTube: только ссылки на youtube.com или youtu.be');
      if (twitchUrl.trim() && !isValidTwitchUrl(twitchUrl.trim()))
        throw new Error('Twitch: только ссылки на twitch.tv');

      const payload = {
        id: userId, username: cleanUsername,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        website_url: website.trim() || null,
        avatar_url: avatarUrl, banner_url: bannerUrl,
        github_url: githubUrl.trim() || null,
        youtube_url: youtubeUrl.trim() || null,
        twitch_url: twitchUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setStatusMsg({ kind: 'ok', text: 'Профиль сохранён ✓' });
      queryClient.invalidateQueries({ queryKey: ['profile-settings', userId] });
      queryClient.invalidateQueries({ queryKey: ['my-profile-mini', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', username.trim().toLowerCase()] });
    },
    onError: (err: Error) => setStatusMsg({ kind: 'err', text: err.message }),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error('Вы не авторизованы');
      const url = await uploadPostMedia(file, userId);
      setAvatarUrl(url);
      return url;
    },
    onError: (err: Error) => setStatusMsg({ kind: 'err', text: err.message }),
  });

  const uploadBanner = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error('Вы не авторизованы');
      const url = await uploadPostMedia(file, userId);
      setBannerUrl(url);
      return url;
    },
    onError: (err: Error) => setStatusMsg({ kind: 'err', text: err.message }),
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const formInvalid =
    saveProfile.isPending ||
    (!!website.trim() && !isValidUrl(website.trim())) ||
    (!!githubUrl.trim() && !isValidGithubUrl(githubUrl.trim())) ||
    (!!youtubeUrl.trim() && !isValidYoutubeUrl(youtubeUrl.trim())) ||
    (!!twitchUrl.trim() && !isValidTwitchUrl(twitchUrl.trim()));

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 20px', letterSpacing: '-0.01em', color: 'var(--text-1)' }}>
        Настройки
      </h1>

      {isLoading ? (
        <div style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>загрузка…</div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); setStatusMsg(null); saveProfile.mutate(); }}>

          {/* Profile info */}
          <SectionCard title="Информация профиля">
            {/* Banner */}
            <FieldLabel>Шапка профиля</FieldLabel>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <div style={{
                height: 130, borderRadius: 8, overflow: 'hidden',
                border: '1px solid var(--border)',
                background: bannerUrl
                  ? undefined
                  : 'radial-gradient(circle at 30% 40%, oklch(0.4 0.12 25) 0%, transparent 50%), radial-gradient(circle at 70% 60%, oklch(0.35 0.1 340) 0%, transparent 50%), oklch(0.22 0.04 60)',
                backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
                backgroundSize: 'cover', backgroundPosition: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!bannerUrl && (
                  <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Нет шапки профиля</span>
                )}
                <input ref={bannerInput} type="file" accept="image/*" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBanner.mutate(f); }} />
                <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => bannerInput.current?.click()}
                    disabled={uploadBanner.isPending}
                    style={{
                      background: 'oklch(0.1 0.01 60 / 0.7)', backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
                      padding: '4px 10px', fontSize: 12, color: '#fff', cursor: 'pointer',
                    }}>
                    {uploadBanner.isPending ? 'загрузка…' : bannerUrl ? 'Изменить' : 'Загрузить'}
                  </button>
                  {bannerUrl && (
                    <button type="button" onClick={() => setBannerUrl(null)}
                      style={{
                        background: 'oklch(0.1 0.01 60 / 0.7)', backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
                        padding: '4px 10px', fontSize: 12, color: '#fff', cursor: 'pointer',
                      }}>Удалить</button>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                Рекомендуется 1500×500 px. PNG / JPG / WEBP.
              </p>
            </div>

            {/* Avatar */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="аватар"
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent)', color: 'oklch(0.15 0.01 60)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 700,
                }}>{(displayName || username || '?')[0].toUpperCase()}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input ref={avatarInput} type="file" accept="image/*" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar.mutate(f); }} />
                <button type="button" onClick={() => avatarInput.current?.click()}
                  disabled={uploadAvatar.isPending}
                  style={{
                    background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
                    padding: '6px 12px', fontSize: 12, color: 'var(--text-1)', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}>
                  {uploadAvatar.isPending ? 'загрузка…' : 'Загрузить аватар'}
                </button>
                {avatarUrl && (
                  <button type="button" onClick={() => setAvatarUrl(null)}
                    style={{
                      background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                      padding: '6px 12px', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer',
                    }}>Удалить</button>
                )}
              </div>
            </div>

            {/* Username + Display Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <FieldLabel>Имя пользователя</FieldLabel>
                <input type="text" value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 31))}
                  placeholder="dev_handle" style={inputStyle} autoComplete="username" maxLength={31} />
              </div>
              <div>
                <FieldLabel>
                  Отображаемое имя
                  {displayName.length >= 48 && (
                    <span style={{ marginLeft: 6, color: displayName.length > LIMITS.displayName ? 'var(--error)' : 'var(--text-3)' }}>
                      {displayName.length}/{LIMITS.displayName}
                    </span>
                  )}
                </FieldLabel>
                <input type="text" placeholder="Ваше имя" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, LIMITS.displayName))}
                  style={inputStyle} maxLength={LIMITS.displayName} />
              </div>
            </div>

            {/* Bio */}
            <div>
              <FieldLabel>
                О себе
                {bio.length >= LIMITS.bio * 0.8 && (
                  <span style={{ marginLeft: 6, color: bio.length > LIMITS.bio ? 'var(--error)' : 'var(--text-3)' }}>
                    {bio.length}/{LIMITS.bio}
                  </span>
                )}
              </FieldLabel>
              <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical', lineHeight: 1.5 }}
                placeholder="Расскажите о себе..." value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, LIMITS.bio))} maxLength={LIMITS.bio} />
            </div>
          </SectionCard>

          {/* Links */}
          <SectionCard title="Ссылки и соцсети">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <FieldLabel>Сайт</FieldLabel>
                <input type="text" style={{ ...inputStyle, borderColor: website.trim() && !isValidUrl(website.trim()) ? 'var(--error)' : undefined }}
                  placeholder="https://yourwebsite.com" value={website}
                  onChange={(e) => setWebsite(e.target.value.slice(0, LIMITS.websiteUrl))} maxLength={LIMITS.websiteUrl} />
                {website.trim() && !isValidUrl(website.trim()) && (
                  <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>Введите корректный URL (https://...)</p>
                )}
              </div>
              {([
                { label: 'GitHub', icon: <GithubIcon />, val: githubUrl, set: setGithubUrl, valid: isValidGithubUrl, ph: 'https://github.com/username', err: 'Только ссылки на github.com' },
                { label: 'YouTube', icon: <YoutubeIcon />, val: youtubeUrl, set: setYoutubeUrl, valid: isValidYoutubeUrl, ph: 'https://youtube.com/@channel', err: 'Только ссылки на youtube.com' },
                { label: 'Twitch', icon: <TwitchIcon />, val: twitchUrl, set: setTwitchUrl, valid: isValidTwitchUrl, ph: 'https://twitch.tv/username', err: 'Только ссылки на twitch.tv' },
              ] as const).map(({ label, icon, val, set, valid, ph, err }) => (
                <div key={label}>
                  <FieldLabel>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{icon}{label}</span>
                  </FieldLabel>
                  <input type="text"
                    style={{ ...inputStyle, borderColor: val.trim() && !valid(val.trim()) ? 'var(--error)' : undefined }}
                    placeholder={ph} value={val}
                    onChange={(e) => (set as (v: string) => void)(e.target.value.slice(0, LIMITS.socialUrl))}
                    maxLength={LIMITS.socialUrl} />
                  {val.trim() && !valid(val.trim()) && (
                    <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{err}</p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          {statusMsg && (
            <div style={{
              fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 12,
              color: statusMsg.kind === 'err' ? 'var(--error)' : 'var(--success)',
            }}>{statusMsg.text}</div>
          )}

          <button type="submit" disabled={formInvalid}
            style={{
              background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 8,
              padding: '9px 20px', fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 600,
              color: 'oklch(0.15 0.01 60)', cursor: formInvalid ? 'not-allowed' : 'pointer',
              opacity: formInvalid ? 0.6 : 1, marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {saveProfile.isPending ? 'Сохранение...' : 'Сохранить профиль'}
          </button>
        </form>
      )}

      {/* Notifications */}
      <SectionCard title="Уведомления">
        <ToggleRow label="Лайки на мои посты" defaultOn />
        <ToggleRow label="Комментарии" defaultOn />
        <ToggleRow label="Новые подписчики" defaultOn />
        <ToggleRow label="Email-дайджест раз в неделю" />
        <ToggleRow label="Push-уведомления в браузере" />
      </SectionCard>

      {/* Privacy */}
      <SectionCard title="Приватность">
        <ToggleRow label="Профиль видят только подписчики" />
        <ToggleRow label="Скрыть лайкнутое" />
        <ToggleRow label="Двухфакторная аутентификация" defaultOn />
      </SectionCard>

      {/* Danger zone */}
      <div style={{
        border: '1px solid oklch(0.4 0.15 25)', borderRadius: 'var(--card-radius)', padding: 18,
      }}>
        <h3 style={{
          margin: '0 0 14px', fontSize: 11, fontWeight: 600,
          color: 'oklch(0.7 0.2 25)', fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>Опасная зона</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            { title: 'Выйти из аккаунта', desc: 'Завершить текущую сессию на этом устройстве', action: 'Выйти', onClick: handleSignOut, destructive: false },
          ].map(({ title, desc, action, onClick, destructive }) => (
            <div key={title} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 0', borderTop: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
              </div>
              <button onClick={onClick}
                style={{
                  background: destructive ? 'oklch(0.55 0.2 25)' : 'var(--bg-2)',
                  border: `1px solid ${destructive ? 'oklch(0.55 0.2 25)' : 'var(--border)'}`,
                  color: destructive ? '#fff' : 'var(--text-1)',
                  borderRadius: 6, padding: '6px 14px', fontSize: 12,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
              >{action}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
