import React from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Link as LinkIcon } from 'lucide-react';

const GithubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.01c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.79 0c2.21-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.05.78 2.12v3.14c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
  </svg>
);

const YoutubeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF0000" aria-hidden="true">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
  </svg>
);

const TwitchProfileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#9146FF" aria-hidden="true">
    <path d="M2.149 0L.537 4.119v16.836h5.731V24h3.224l3.045-3.045h4.657L23.463 14.7V0H2.149zm19.164 13.612l-3.582 3.582h-5.731l-3.045 3.045v-3.045H4.119V1.612h17.194v12zM18.358 5.731h-1.971v5.731h1.971V5.731zm-5.731 0h-1.971v5.731h1.971V5.731z"/>
  </svg>
);
import { supabase, POST_SELECT } from '../lib/supabase';
import type { Profile, PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import { useSessionContext } from '../context/SessionContext';

const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const queryClient = useQueryClient();
  const session = useSessionContext();
  const viewerId = session?.user.id;

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['profile', username],
    enabled: !!username,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const profileId = profile?.id;
  const isOwnProfile = !!viewerId && viewerId === profileId;

  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['profile-posts', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('user_id', profileId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PostWithMeta[];
    },
  });

  const { data: counts } = useQuery({
    queryKey: ['profile-counts', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('id', { head: true, count: 'exact' }).eq('following_id', profileId!),
        supabase.from('follows').select('id', { head: true, count: 'exact' }).eq('follower_id', profileId!),
      ]);
      return {
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      };
    },
  });

  const { data: isFollowing } = useQuery({
    queryKey: ['is-following', viewerId, profileId],
    enabled: !!viewerId && !!profileId && !isOwnProfile,
    queryFn: async () => {
      const { count } = await supabase
        .from('follows')
        .select('id', { head: true, count: 'exact' })
        .eq('follower_id', viewerId!)
        .eq('following_id', profileId!);
      return (count ?? 0) > 0;
    },
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!viewerId || !profileId) throw new Error('Войдите, чтобы подписаться');
      if (isFollowing) {
        const { error } = await supabase.from('follows').delete()
          .eq('follower_id', viewerId).eq('following_id', profileId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('follows')
          .insert({ follower_id: viewerId, following_id: profileId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['is-following', viewerId, profileId] });
      queryClient.invalidateQueries({ queryKey: ['profile-counts', profileId] });
    },
  });

  if (profileLoading) {
    return <div style={{ padding: '20px' }} className="mono">ЗАГРУЗКА_ПРОФИЛЯ...</div>;
  }
  if (profileError || !profile) {
    return <div style={{ padding: '20px', color: 'var(--error)' }} className="mono">ПРОФИЛЬ_НЕ_НАЙДЕН</div>;
  }

  const AVATAR_SIZE = 120;
  const AVATAR_OVERHANG = 60;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card">
        <div style={{
          height: '180px',
          backgroundColor: 'var(--bg-main)',
          borderBottom: '1px solid var(--border-color)',
          backgroundImage: profile.banner_url ? `url(${profile.banner_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div style={{ padding: '0 24px 24px 24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: `-${AVATAR_OVERHANG}px`,
            minHeight: `${AVATAR_SIZE - AVATAR_OVERHANG}px`,
          }}>
            <img
              src={profile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.username}`}
              alt={profile.username}
              style={{
                width: `${AVATAR_SIZE}px`,
                height: `${AVATAR_SIZE}px`,
                borderRadius: '6px',
                border: '4px solid var(--bg-surface)',
                backgroundColor: 'var(--bg-main)',
              }}
            />
            {!isOwnProfile && viewerId && (
              <button
                className={isFollowing ? 'btn' : 'btn btn-primary'}
                onClick={() => toggleFollow.mutate()}
                disabled={toggleFollow.isPending}
              >
                {isFollowing ? 'Отписаться' : 'Подписаться'}
              </button>
            )}
          </div>

          <div style={{ marginTop: '16px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>{profile.display_name || profile.username}</h1>
            <div className="text-secondary" style={{ fontSize: '16px' }}>@{profile.username}</div>

            {profile.bio && <p style={{ marginTop: '16px' }}>{profile.bio}</p>}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px', fontSize: '14px' }} className="text-secondary">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} />
                <span>На сайте с {new Date(profile.created_at).toLocaleDateString('ru-RU')}</span>
              </div>
              {profile.website_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LinkIcon size={16} />
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer">
                    {profile.website_url.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {profile.github_url && (
                <a href={profile.github_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GithubIcon />
                  <span>{profile.github_url.replace(/^https?:\/\/github\.com\//, '')}</span>
                </a>
              )}
              {profile.youtube_url && (
                <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <YoutubeIcon />
                  <span>{profile.youtube_url.replace(/^https?:\/\/(www\.)?youtube\.com\//, '')}</span>
                </a>
              )}
              {profile.twitch_url && (
                <a href={profile.twitch_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TwitchProfileIcon />
                  <span>{profile.twitch_url.replace(/^https?:\/\/(www\.)?twitch\.tv\//, '')}</span>
                </a>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', marginTop: '20px' }}>
            <div><span style={{ fontWeight: 'bold' }}>{counts?.following ?? 0}</span> <span className="text-secondary">Подписок</span></div>
            <div><span style={{ fontWeight: 'bold' }}>{counts?.followers ?? 0}</span> <span className="text-secondary">Подписчиков</span></div>
          </div>
        </div>
      </div>

      {postsLoading ? (
        <div className="mono text-secondary">ЗАГРУЗКА_ПОСТОВ...</div>
      ) : posts && posts.length > 0 ? (
        <div className="post-grid">
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      ) : (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div className="text-secondary">Постов пока нет.</div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
