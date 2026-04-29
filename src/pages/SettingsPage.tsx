import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';
import { uploadPostMedia } from '../lib/storage';
import { useSession } from '../hooks/useSession';

const GithubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.01c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.21-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.05.78 2.12v3.14c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
  </svg>
);

const YoutubeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF0000" aria-hidden="true">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
  </svg>
);

const TwitchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#9146FF" aria-hidden="true">
    <path d="M2.149 0L.537 4.119v16.836h5.731V24h3.224l3.045-3.045h4.657L23.463 14.7V0H2.149zm19.164 13.612l-3.582 3.582h-5.731l-3.045 3.045v-3.045H4.119V1.612h17.194v12zM18.358 5.731h-1.971v5.731h1.971V5.731zm-5.731 0h-1.971v5.731h1.971V5.731z"/>
  </svg>
);

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  const userEmail = session?.user.email ?? '';
  const avatarInput = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [twitchUrl, setTwitchUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
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
    if (!profile) {
      setUsername(userEmail.split('@')[0] ?? '');
      return;
    }
    setUsername(profile.username ?? '');
    setDisplayName(profile.display_name ?? '');
    setBio(profile.bio ?? '');
    setWebsite(profile.website_url ?? '');
    setAvatarUrl(profile.avatar_url);
    setGithubUrl(profile.github_url ?? '');
    setYoutubeUrl(profile.youtube_url ?? '');
    setTwitchUrl(profile.twitch_url ?? '');
  }, [profile, userEmail]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Вы не авторизованы');
      const cleanUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9_-]{1,30}$/.test(cleanUsername)) {
        throw new Error('Имя пользователя: 2–31 символ, строчные буквы/цифры/-/_, начинается с буквы или цифры.');
      }

      const payload = {
        id: userId,
        username: cleanUsername,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        website_url: website.trim() || null,
        avatar_url: avatarUrl,
        github_url: githubUrl.trim() || null,
        youtube_url: youtubeUrl.trim() || null,
        twitch_url: twitchUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setStatusMsg({ kind: 'ok', text: 'Сохранено.' });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Настройки</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Profile card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Информация профиля</h3>

          {isLoading ? (
            <div className="mono text-secondary">ЗАГРУЗКА_ПРОФИЛЯ...</div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStatusMsg(null);
                saveProfile.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              {/* Avatar row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img
                  src={avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${username || 'anon'}`}
                  alt="аватар"
                  style={{ width: '80px', height: '80px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', flexShrink: 0 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    ref={avatarInput} type="file" accept="image/*" hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAvatar.mutate(f);
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => avatarInput.current?.click()}
                    disabled={uploadAvatar.isPending}
                    style={{ gap: 6 }}
                  >
                    <ImageIcon size={14} />
                    {uploadAvatar.isPending ? 'Загрузка...' : 'Загрузить аватар'}
                  </button>
                  {avatarUrl && (
                    <button type="button" className="btn btn-sm" onClick={() => setAvatarUrl(null)}>
                      Удалить
                    </button>
                  )}
                </div>
              </div>

              {/* Username + Display Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Имя пользователя</label>
                  <input
                    type="text" value={username}
                    onChange={(e) => setUsername(e.target.value.slice(0, 31))}
                    placeholder="dev_handle"
                    style={{ width: '100%' }}
                    autoComplete="username"
                    maxLength={31}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '8px' }}>
                    <label style={{ fontSize: '14px' }}>Отображаемое имя</label>
                    {displayName.length >= 48 && (
                      <span className="mono" style={{ fontSize: '11px', color: displayName.length > 60 ? 'var(--error)' : 'var(--text-secondary)', marginLeft: '8px' }}>
                        {displayName.length}/60
                      </span>
                    )}
                  </div>
                  <input
                    type="text" placeholder="Ваше имя"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
                    style={{ width: '100%' }}
                    maxLength={60}
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '8px' }}>
                  <label style={{ fontSize: '14px' }}>О себе</label>
                  {bio.length >= 240 && (
                    <span className="mono" style={{ fontSize: '11px', color: bio.length > 300 ? 'var(--error)' : 'var(--text-secondary)', marginLeft: '8px' }}>
                      {bio.length}/300
                    </span>
                  )}
                </div>
                <textarea
                  style={{ width: '100%', minHeight: '80px' }}
                  placeholder="Расскажите о себе..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 300))}
                  maxLength={300}
                />
              </div>

              {/* Website */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Сайт</label>
                <input
                  type="url" style={{ width: '100%' }}
                  placeholder="https://yourwebsite.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value.slice(0, 200))}
                  maxLength={200}
                />
              </div>

              {statusMsg && (
                <div className="mono" style={{ fontSize: '13px', color: statusMsg.kind === 'err' ? 'var(--error)' : 'var(--success)' }}>
                  {statusMsg.text}
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={saveProfile.isPending} style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
                {saveProfile.isPending ? 'Сохранение...' : 'Сохранить профиль'}
              </button>
            </form>
          )}
        </div>

        {/* Social links card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px' }}>Социальные ссылки</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <GithubIcon />
                <label style={{ fontSize: '14px' }}>GitHub</label>
              </div>
              <input
                type="url"
                style={{ width: '100%' }}
                placeholder="https://github.com/username"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value.slice(0, 200))}
                maxLength={200}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <YoutubeIcon />
                <label style={{ fontSize: '14px' }}>YouTube</label>
              </div>
              <input
                type="url"
                style={{ width: '100%' }}
                placeholder="https://youtube.com/@channel"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value.slice(0, 200))}
                maxLength={200}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <TwitchIcon />
                <label style={{ fontSize: '14px' }}>Twitch</label>
              </div>
              <input
                type="url"
                style={{ width: '100%' }}
                placeholder="https://twitch.tv/username"
                value={twitchUrl}
                onChange={(e) => setTwitchUrl(e.target.value.slice(0, 200))}
                maxLength={200}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saveProfile.isPending}
              onClick={() => { setStatusMsg(null); saveProfile.mutate(); }}
              style={{ alignSelf: 'flex-start', padding: '10px 24px' }}
            >
              {saveProfile.isPending ? 'Сохранение...' : 'Сохранить ссылки'}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--error)' }}>Опасная зона</h3>
          <button onClick={handleSignOut} className="btn" style={{ borderColor: 'var(--error)', color: 'var(--error)', padding: '10px 24px' }}>
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
