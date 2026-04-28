import React from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Link as LinkIcon } from 'lucide-react';
import { supabase, POST_SELECT } from '../lib/supabase';
import type { Profile, PostWithMeta } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import { useSession } from '../hooks/useSession';

const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const queryClient = useQueryClient();
  const { session } = useSession();
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
        <div style={{ height: '150px', backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }} />
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
