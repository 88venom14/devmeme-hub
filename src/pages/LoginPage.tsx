import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LIMITS, validateUsername } from '../lib/validation';

const GithubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.01c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.21-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.05.78 2.12v3.14c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.1 0-9.5-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.9 35.8 44 30.4 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const AUTH_WORKER_URL = import.meta.env.VITE_AUTH_WORKER_URL as string | undefined;

type Mode = 'signin' | 'signup';
type Provider = 'github' | 'google';

const OAuthBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%', padding: '9px 14px',
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 8, color: 'var(--text-1)',
      fontSize: 13, fontFamily: 'var(--font-ui)',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10,
      justifyContent: 'flex-start',
      transition: 'filter 0.15s',
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.12)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)'; }}
  >
    {children}
  </button>
);

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  github_no_code: 'GitHub не вернул код авторизации.',
  invalid_state: 'Ошибка безопасности — попробуйте ещё раз.',
  github_token_failed: 'Не удалось получить токен GitHub.',
  github_no_email: 'GitHub аккаунт не имеет публичного email. Добавьте email в настройках GitHub.',
  google_no_code: 'Google не вернул код авторизации.',
  google_token_failed: 'Не удалось получить токен Google.',
  google_no_email: 'Google аккаунт не имеет подтверждённого email.',
supabase_link_failed: 'Ошибка сервера авторизации — попробуйте позже.',
};

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(() => {
    const err = new URLSearchParams(window.location.search).get('auth_error');
    if (err) {
      window.history.replaceState({}, '', window.location.pathname);
      return { kind: 'error', text: AUTH_ERROR_MESSAGES[err] ?? `Ошибка входа: ${err}` };
    }
    return null;
  });

  const handleOAuth = async (provider: Provider) => {
    setMessage(null);

    if (provider === 'github' || provider === 'google') {
      if (!AUTH_WORKER_URL) {
        setMessage({ kind: 'error', text: 'VITE_AUTH_WORKER_URL не задан. Задеплойте auth-worker и добавьте переменную.' });
        return;
      }
      window.location.href = `${AUTH_WORKER_URL}/auth/${provider}`;
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/', scopes: 'user:email read:user' },
    });
    if (error) {
      setMessage({
        kind: 'error',
        text: `${provider}: ${error.message}. Enable this provider in Supabase Dashboard → Authentication → Providers.`,
      });
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || busy) return;

    if (email.length > LIMITS.email) {
      setMessage({ kind: 'error', text: `Email не может превышать ${LIMITS.email} символов` });
      return;
    }
    if (password.length < LIMITS.password.min) {
      setMessage({ kind: 'error', text: `Пароль: минимум ${LIMITS.password.min} символов` });
      return;
    }
    if (password.length > LIMITS.password.max) {
      setMessage({ kind: 'error', text: `Пароль: максимум ${LIMITS.password.max} символов` });
      return;
    }
    if (mode === 'signup' && username.trim()) {
      const err = validateUsername(username);
      if (err) { setMessage({ kind: 'error', text: err }); return; }
    }

    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin + '/',
            data: {
              username: username.trim() || email.split('@')[0],
              display_name: username.trim() || email.split('@')[0],
            },
          },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setMessage({ kind: 'info', text: '📨 Письмо отправлено на ' + email + '. Перейдите по ссылке в письме для подтверждения.' });
        }
      }
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-0)', padding: 20,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 42, height: 42,
          }}><svg viewBox="0 0 24 20" width="42" height="42"><path clipRule="evenodd" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" fill="#D97757" fillRule="evenodd" /></svg></div>
          <h1 style={{
            fontSize: '1.9rem', fontWeight: 700, color: 'var(--accent)',
            fontFamily: 'var(--font-display)', letterSpacing: '-0.02em',
          }}>devMeme</h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-ui)' }}>
          Социальная платформа для технических мемов и IT-проектов.
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400, padding: 24,
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 14,
      }}>
        {/* Mode toggle */}
        <div style={{
          display: 'inline-flex', width: '100%',
          background: 'var(--bg-0)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 3, marginBottom: 20,
        }}>
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setMessage(null); }}
              style={{
                flex: 1, padding: '7px 0',
                background: mode === m ? 'var(--bg-3)' : 'transparent',
                border: 'none', borderRadius: 6,
                color: mode === m ? 'var(--text-1)' : 'var(--text-3)',
                fontSize: 13, fontFamily: 'var(--font-ui)',
                fontWeight: mode === m ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { if (mode !== m) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
              onMouseLeave={(e) => { if (mode !== m) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {m === 'signin' ? 'Войти' : 'Регистрация'}
            </button>
          ))}
        </div>

        {/* Email form */}
        <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Имя пользователя
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, LIMITS.username.max))}
                placeholder="dev_handle"
                style={{ width: '100%' }}
                autoComplete="username"
                maxLength={LIMITS.username.max}
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, LIMITS.email))}
              placeholder="you@example.com"
              style={{ width: '100%' }}
              required
              maxLength={LIMITS.email}
              autoComplete="email"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, LIMITS.password.max))}
              placeholder="••••••••"
              style={{ width: '100%' }}
              required
              minLength={LIMITS.password.min}
              maxLength={LIMITS.password.max}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {message && (
            <div style={{
              fontSize: 12, fontFamily: 'var(--font-mono)',
              color: message.kind === 'error' ? 'var(--error)' : 'var(--success)',
              lineHeight: 1.4,
            }}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password}
            style={{
              marginTop: 4,
              padding: '9px 14px',
              background: 'var(--accent)', border: '1px solid var(--accent)',
              borderRadius: 8, color: 'oklch(0.15 0.01 60)',
              fontSize: 13, fontFamily: 'var(--font-ui)',
              fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
              opacity: (busy || !email || !password) ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'filter 0.15s',
            }}
            onMouseEnter={(e) => { if (!busy && email && password) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
            {busy ? 'Загрузка...' : mode === 'signin' ? 'Войти через email' : 'Создать аккаунт'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>ИЛИ</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* OAuth */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <OAuthBtn onClick={() => handleOAuth('github')}>
            <GithubIcon /><span>Войти через GitHub</span>
          </OAuthBtn>
          <OAuthBtn onClick={() => handleOAuth('google')}>
            <GoogleIcon /><span>Войти через Google</span>
          </OAuthBtn>

        </div>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Продолжая, вы соглашаетесь с <a href="#" style={{ color: 'var(--accent)' }}>Условиями</a> и <a href="#" style={{ color: 'var(--accent)' }}>Политикой конфиденциальности</a>.
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        v1.0.0-stable // READY_FOR_DEPLOYMENT
      </div>
    </div>
  );
};

export default LoginPage;
