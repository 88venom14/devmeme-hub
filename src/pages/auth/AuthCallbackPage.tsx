import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '@/lib/api';

// Landing route for the backend OAuth redirect. The backend appends the app
// JWT in the URL fragment (#token=…) — kept out of the query string so it is
// never sent to a server or written to access logs. We read it, store it, and
// bounce to the feed. OAuth errors come back as /login?auth_error=… (handled
// by LoginPage), so they never reach this page.
const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const token = new URLSearchParams(hash).get('token');

    if (token) {
      setToken(token);
      // Clear the token from the URL before leaving this route.
      window.history.replaceState({}, '', window.location.pathname);
      navigate('/feed', { replace: true });
    } else {
      navigate('/login?auth_error=auth_link_failed', { replace: true });
    }
  }, [navigate]);

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-0)', color: 'var(--accent)',
    }}>
      <div className="mono">ЗАВЕРШАЕМ ВХОД...</div>
    </div>
  );
};

export default AuthCallbackPage;
