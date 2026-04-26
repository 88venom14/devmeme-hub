import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';
import { uploadPostMedia } from '../lib/storage';
import { useSession } from '../hooks/useSession';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  const userEmail = session?.user.email ?? '';
  const avatarInput = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  useEffect(() => {
    if (!profile) {
      // No profile row yet — pre-fill sensible defaults from auth user
      setUsername(userEmail.split('@')[0] ?? '');
      return;
    }
    setUsername(profile.username ?? '');
    setDisplayName(profile.display_name ?? '');
    setBio(profile.bio ?? '');
    setWebsite(profile.website_url ?? '');
    setAvatarUrl(profile.avatar_url);
  }, [profile, userEmail]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const cleanUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9_-]{1,30}$/.test(cleanUsername)) {
        throw new Error('Username: 2-31 chars, lowercase letters/digits/-/_, must start with letter or digit.');
      }

      const payload = {
        id: userId,
        username: cleanUsername,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        website_url: website.trim() || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setStatusMsg({ kind: 'ok', text: 'Saved.' });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: (err: Error) => setStatusMsg({ kind: 'err', text: err.message }),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error('Not signed in');
      const url = await uploadPostMedia(file, userId);
      setAvatarUrl(url);
      return url;
    },
    onError: (err: Error) => setStatusMsg({ kind: 'err', text: err.message }),
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Settings</h1>

      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <section>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Profile Information</h3>

          {isLoading ? (
            <div className="mono text-secondary">LOADING_PROFILE...</div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStatusMsg(null);
                saveProfile.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img
                  src={avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${username || 'anon'}`}
                  alt="avatar"
                  style={{ width: '72px', height: '72px', borderRadius: '6px', backgroundColor: 'var(--bg-main)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    ref={avatarInput} type="file" accept="image/*" hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAvatar.mutate(f);
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => avatarInput.current?.click()}
                    disabled={uploadAvatar.isPending}
                    style={{ gap: 6 }}
                  >
                    <ImageIcon size={14} />
                    {uploadAvatar.isPending ? 'Uploading...' : 'Upload avatar'}
                  </button>
                  {avatarUrl && (
                    <button type="button" className="btn btn-sm" onClick={() => setAvatarUrl(null)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Username</label>
                <input
                  type="text" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="dev_handle"
                  style={{ width: '100%' }}
                  autoComplete="username"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Display Name</label>
                <input
                  type="text" placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Bio</label>
                <textarea
                  style={{ width: '100%', minHeight: '80px' }}
                  placeholder="Tell us about yourself..."
                  value={bio} onChange={(e) => setBio(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Website</label>
                <input
                  type="url" style={{ width: '100%' }}
                  placeholder="https://yourwebsite.com"
                  value={website} onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {statusMsg && (
                <div className="mono" style={{ fontSize: '13px', color: statusMsg.kind === 'err' ? 'var(--error)' : 'var(--success)' }}>
                  {statusMsg.text}
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={saveProfile.isPending} style={{ alignSelf: 'flex-start' }}>
                {saveProfile.isPending ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          )}
        </section>

        <section style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--error)' }}>Danger Zone</h3>
          <button onClick={handleSignOut} className="btn" style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
            Sign Out
          </button>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
