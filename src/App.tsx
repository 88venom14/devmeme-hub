import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from './hooks/useSession';
import { SessionContext } from './context/SessionContext';
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
const ChatPage = React.lazy(() => import('./pages/ChatPage'));
const GamesPage = React.lazy(() => import('./pages/GamesPage'));
const GamePlayPage = React.lazy(() => import('./pages/GamePlayPage'));
const GameUploadPage = React.lazy(() => import('./pages/GameUploadPage'));
const MyGamesPage = React.lazy(() => import('./pages/MyGamesPage'));
const AdminGamesPage = React.lazy(() => import('./pages/AdminGamesPage'));

import AppShell from './components/layout/AppShell';
import AdminRoute from './components/AdminRoute';

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

  if (loading) {
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

              {/* Mini-games */}
              <Route path="/games" element={<GamesPage />} />
              <Route
                path="/games/upload"
                element={session ? <GameUploadPage /> : <Navigate to="/login" replace />}
              />
              <Route path="/games/:slug" element={<GamePlayPage />} />
              <Route
                path="/me/games"
                element={session ? <MyGamesPage /> : <Navigate to="/login" replace />}
              />
              <Route path="/admin" element={<Navigate to="/admin/games" replace />} />
              <Route
                path="/admin/games"
                element={<AdminRoute><AdminGamesPage /></AdminRoute>}
              />

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
              <Route
                path="/chat"
                element={session ? <ChatPage /> : <Navigate to="/login" replace />}
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
