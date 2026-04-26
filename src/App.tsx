import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from './hooks/useSession';

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        color: '#ff6b00',
      }}>
        <div className="mono">INITIALIZING_DEVMEME_HUB...</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/devmeme">
        <Routes>
          <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/" />} />

          <Route element={<AppShell session={session} />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/profile/:id" element={<ProfilePage />} />
            <Route path="/post/:id" element={<PostDetailPage />} />
            <Route path="/tag/:name" element={<TagPage />} />
            <Route path="/trending" element={<TrendingPage />} />

            <Route path="/post/new" element={session ? <CreatePostPage /> : <Navigate to="/login" />} />
            <Route path="/saved" element={session ? <SavedPostsPage /> : <Navigate to="/login" />} />
            <Route path="/settings" element={session ? <SettingsPage /> : <Navigate to="/login" />} />
            <Route path="/following" element={session ? <FollowingPage /> : <Navigate to="/login" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
