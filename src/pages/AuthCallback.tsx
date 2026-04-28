import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Get tokens from URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        // Try to set session
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          // Clear URL hash and redirect
          window.location.hash = '';
          navigate('/');
          return;
        }
        
        console.error('Session error:', error);
      }

      // Check for existing session as fallback
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        window.location.hash = '';
        navigate('/');
      } else {
        navigate('/login');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-app)',
      color: 'var(--text-primary)',
    }}>
      <div className="mono">AUTHENTICATING...</div>
    </div>
  );
};

export default AuthCallback;