import React, { useState } from 'react';
import { Terminal, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

const GithubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.01c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.21-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.05.78 2.12v3.14c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.1 0-9.5-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.9 35.8 44 30.4 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

const TwitchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#9146FF" aria-hidden="true">
    <path d="M2.149 0L.537 4.119v16.836h5.731V24h3.224l3.045-3.045h4.657L23.463 14.7V0H2.149zm19.164 13.612l-3.582 3.582h-5.731l-3.045 3.045v-3.045H4.119V1.612h17.194v12zM18.358 5.731h-1.971v5.731h1.971V5.731zm-5.731 0h-1.971v5.731h1.971V5.731z"/>
  </svg>
);

type Mode = 'signin' | 'signup';
type Provider = 'github' | 'google' | 'twitch';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const handleOAuth = async (provider: Provider) => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
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
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim() || email.split('@')[0],
              display_name: username.trim() || email.split('@')[0],
            },
          },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setMessage({
            kind: 'info',
            text: 'Check your inbox to confirm your email before signing in.',
          });
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
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-app)',
      padding: '20px',
    }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--accent-primary)', marginBottom: '12px' }}>
          <Terminal size={40} />
          <h1 style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>DevMeme Hub</h1>
        </div>
        <p className="text-secondary" style={{ fontSize: '1rem' }}>
          The social platform for technical memes and software projects.
        </p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '28px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            className={mode === 'signin' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
            style={{ flex: 1 }}
            onClick={() => { setMode('signin'); setMessage(null); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
            style={{ flex: 1 }}
            onClick={() => { setMode('signup'); setMessage(null); }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'signup' && (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="dev_handle"
                style={{ width: '100%' }}
                autoComplete="username"
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%' }}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%' }}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {message && (
            <div
              className="mono"
              style={{
                fontSize: '12px',
                color: message.kind === 'error' ? 'var(--error)' : 'var(--success)',
              }}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !email || !password}
            style={{ marginTop: '4px', gap: '8px' }}
          >
            <Mail size={16} />
            {busy ? 'Working...' : mode === 'signin' ? 'Sign in with email' : 'Create account'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 16px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          <span className="text-secondary" style={{ fontSize: '12px' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => handleOAuth('github')} className="btn" style={{ width: '100%', padding: '10px', gap: '12px', justifyContent: 'flex-start' }}>
            <GithubIcon />
            <span>Continue with GitHub</span>
          </button>
          <button onClick={() => handleOAuth('google')} className="btn" style={{ width: '100%', padding: '10px', gap: '12px', justifyContent: 'flex-start' }}>
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>
          <button onClick={() => handleOAuth('twitch')} className="btn" style={{ width: '100%', padding: '10px', gap: '12px', justifyContent: 'flex-start' }}>
            <TwitchIcon />
            <span>Continue with Twitch</span>
          </button>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
          By continuing, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
        </div>
      </div>

      <div className="mono" style={{ marginTop: '32px', fontSize: '11px', color: 'var(--text-secondary)' }}>
        v1.0.0-stable // READY_FOR_DEPLOYMENT
      </div>
    </div>
  );
};

export default LoginPage;
