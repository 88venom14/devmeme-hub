import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

type State = 'verifying' | 'success' | 'error';

// Target of the verification link emailed at sign-up
// (FRONTEND_URL/verify-email?token=…). Consumes the token via the API and
// reports the result; on success the account is active and the user can log in.
const VerifyEmailPage: React.FC = () => {
  const [state, setState] = useState<State>('verifying');
  const [error, setError] = useState('');
  // StrictMode mounts effects twice in dev; guard so we don't fire the request
  // (which consumes the token) twice.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('error');
      setError('Ссылка повреждена: отсутствует токен подтверждения.');
      return;
    }

    api.verifyEmail(token)
      .then(() => setState('success'))
      .catch((err: unknown) => {
        setState('error');
        setError((err as Error).message || 'Ссылка недействительна или истекла.');
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg-0)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 400, padding: 28, textAlign: 'center',
        background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 14,
      }}>
        {state === 'verifying' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <p className="mono" style={{ color: 'var(--text-3)', fontSize: 13 }}>ПОДТВЕРЖДАЕМ EMAIL...</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-display)', margin: '0 0 10px' }}>
              Email подтверждён
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Ваш аккаунт активирован. Теперь вы можете войти.
            </p>
            <Link
              to="/login"
              style={{
                display: 'inline-block', padding: '9px 22px',
                background: 'var(--accent)', color: 'oklch(0.15 0.01 60)',
                borderRadius: 8, textDecoration: 'none', fontWeight: 600,
                fontSize: 13, fontFamily: 'var(--font-ui)',
              }}
            >
              Войти
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-display)', margin: '0 0 10px' }}>
              Не удалось подтвердить
            </h2>
            <p style={{ fontSize: 13, color: 'var(--error)', lineHeight: 1.5, margin: '0 0 20px', fontFamily: 'var(--font-mono)' }}>
              {error}
            </p>
            <Link
              to="/login"
              style={{
                display: 'inline-block', padding: '9px 22px',
                background: 'var(--bg-2)', color: 'var(--text-1)',
                border: '1px solid var(--border)',
                borderRadius: 8, textDecoration: 'none', fontWeight: 600,
                fontSize: 13, fontFamily: 'var(--font-ui)',
              }}
            >
              Вернуться ко входу
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
