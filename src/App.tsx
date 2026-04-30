import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from './hooks/useSession';
import { SessionContext } from './context/SessionContext';
import { supabase } from './lib/supabase';

import './styles/global.css';
import './styles/layout.css';

import FeedPage from './pages/FeedPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import CreatePostPage from './pages/CreatePostPage';
import PostDetailPage from './pages/PostDetailPage';
import SavedPostsPage from './pages/SavedPostsPage';
import SettingsPage from './pages/SettingsPage';
import FollowingPage from './pages/FollowingPage';
import TrendingPage from './pages/TrendingPage';
import TagPage from './pages/TagPage';

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

  const [oauthPending, setOauthPending] = React.useState(() =>
    new URLSearchParams(window.location.search).has('code'),
  );

  React.useEffect(() => {
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
        <BrowserRouter>
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
        </BrowserRouter>
      </QueryClientProvider>
    </SessionContext.Provider>
  );
};

export default App;
