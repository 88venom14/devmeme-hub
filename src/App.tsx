import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from './hooks/useSession';
import { SessionContext } from './context/SessionContext';
import { supabase } from './lib/supabase';
import ErrorBoundary from './components/ErrorBoundary';

import './styles/variables.css';
import './styles/global.css';
import './styles/layout.css';

const FeedPage = React.lazy(() => import('./pages/FeedPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const CreatePostPage = React.lazy(() => import('./pages/CreatePostPage'));
const PostDetailPage = React.lazy(() => import('./pages/PostDetailPage'));
const SavedPostsPage = React.lazy(() => import('./pages/SavedPostsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const FollowingPage = React.lazy(() => import('./pages/FollowingPage'));
const TrendingPage = React.lazy(() => import('./pages/TrendingPage'));
const TagPage = React.lazy(() => import('./pages/TagPage'));

import AppShell from './components/layout/AppShell';

// Module-level singleton — never recreated across renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const App: React.FC = () => {
  const { session, loading } = useSession();

  const [oauthPending, setOauthPending] = React.useState(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return search.has('code') || hash.has('access_token');
  });

  React.useEffect(() => {
    // Implicit flow: #access_token= from magic link (GitHub via Worker)
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (accessToken && refreshToken) {
      window.history.replaceState({}, '', window.location.pathname);
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .finally(() => setOauthPending(false));
      return;
    }

    // PKCE flow: ?code= from direct Supabase OAuth (Google, Twitch)
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) return;
    supabase.auth.exchangeCodeForSession(code).finally(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());
      setOauthPending(false);
    });
  }, []);

  if (loading || oauthPending) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          color: '#ff6b00',
        }}
      >
        <div className="mono">INITIALIZING_DEVMEME_HUB...</div>
      </div>
    );
  }

  return (
    // SessionContext.Provider wraps everything — one subscription, one source of truth
    <SessionContext.Provider value={session}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
        <BrowserRouter>
          <React.Suspense fallback={
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000', color: '#ff6b00' }}>
              <div className="mono">LOADING...</div>
            </div>
          }>
          <Routes>
            <Route
              path="/login"
              element={!session ? <LoginPage /> : <Navigate to="/feed" replace />}
            />
            <Route path="/" element={<Navigate to="/feed" replace />} />

            <Route element={<AppShell session={session} />}>
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/profile/:username" element={<ProfilePage />} />
              <Route path="/post/:id" element={<PostDetailPage />} />
              <Route path="/tag/:name" element={<TagPage />} />
              <Route path="/trending" element={<TrendingPage />} />

              <Route
                path="/post/new"
                element={session ? <CreatePostPage /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/saved"
                element={session ? <SavedPostsPage /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/settings"
                element={session ? <SettingsPage /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/following"
                element={session ? <FollowingPage /> : <Navigate to="/login" replace />}
              />
            </Route>

            <Route path="*" element={<Navigate to="/feed" replace />} />
          </Routes>
          </React.Suspense>
        </BrowserRouter>
        </ErrorBoundary>
      </QueryClientProvider>
    </SessionContext.Provider>
  );
};

export default App;
