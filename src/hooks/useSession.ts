import { useEffect, useState } from 'react';
import { api, clearToken, getToken, type AppSession } from '../lib/api';

export function useSession() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!getToken()) {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
        return;
      }
      try {
        const next = await api.me();
        if (!cancelled) setSession(next);
      } catch {
        clearToken();
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    window.addEventListener('devmeme-auth-changed', load);
    return () => {
      cancelled = true;
      window.removeEventListener('devmeme-auth-changed', load);
    };
  }, []);

  return { session, loading };
}
