import type {
  AdminGamesResponse, Comment, Game, GameModerationLogEntry, GameStatus,
  MyProfile, PostWithMeta, Profile, Tag, TopTag,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';
export const TOKEN_KEY = 'devmeme_token';

// Full URL the browser navigates to (top-level redirect) to start an OAuth
// flow. The backend handles the provider dance and redirects back to
// /auth/callback#token=… (see AuthCallbackPage).
export function oauthStartUrl(provider: 'github'): string {
  return `${API_BASE_URL}/api/auth/${provider}/start`;
}

// Absolute URL to a game's sandboxed entry file, served from the API origin's
// /games-static route. Loaded only inside the sandboxed GameFrame iframe.
export function gameEntryUrl(game: Pick<Game, 'slug' | 'entry_path'>): string {
  const entry = game.entry_path || 'index.html';
  return `${API_BASE_URL}/games-static/${encodeURIComponent(game.slug)}/${entry}`;
}

export type GameUploadInput = {
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  tags?: string[];
  archive?: File | null;
};

function buildGameForm(input: GameUploadInput): FormData {
  const form = new FormData();
  form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  if (input.thumbnail_url) form.append('thumbnail_url', input.thumbnail_url);
  for (const tag of input.tags ?? []) form.append('tags', tag);
  if (input.archive) form.append('archive', input.archive);
  return form;
}

async function multipartRequest<T>(path: string, method: string, form: FormData): Promise<T> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: form });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body as T;
}

type ApiPost = Omit<PostWithMeta, 'profiles' | 'stars' | 'comments' | 'post_tags'> & {
  profile?: Profile;
  profiles?: Profile | null;
  star_count?: number;
  comment_count?: number;
  tags?: Tag[];
  stars?: { count: number }[];
  comments?: { count: number }[];
  post_tags?: { tags: Tag | null }[];
};

type ApiComment = Omit<Comment, 'profiles'> & {
  profile?: Profile;
  profiles?: Profile | null;
};

export type AppSession = {
  access_token: string;
  user: { id: string; email: string; role?: string };
  profile?: Profile | null;
};

// register() either logs the user in (verification disabled) or asks them to
// confirm their email first (verification active). Discriminated by `kind`.
export type RegisterResult =
  | { kind: 'session'; token: string; user: AppSession['user']; profile: Profile }
  | { kind: 'verification'; email: string };

export type UserRole = 'user' | 'moderator' | 'admin';

// AdminUser is the moderation-panel projection returned by the /api/admin/users
// endpoints. ban_reason/locked_until are non-null while a ban is in effect.
export type AdminUser = {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: 'pending' | 'active' | 'suspended';
  locked_until: string | null;
  ban_reason: string | null;
  ban_by: string | null;
  created_at: string;
};

export type UserSettings = {
  notify_likes: boolean;
  notify_comments: boolean;
  notify_followers: boolean;
  email_digest: boolean;
  push_browser: boolean;
  profile_followers_only: boolean;
  hide_liked: boolean;
  two_factor: boolean;
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event('devmeme-auth-changed'));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event('devmeme-auth-changed'));
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

function adaptPost(post: ApiPost): PostWithMeta {
  return {
    ...post,
    profiles: post.profile ?? post.profiles ?? null,
    stars: [{ count: post.star_count ?? post.stars?.[0]?.count ?? 0 }],
    comments: [{ count: post.comment_count ?? post.comments?.[0]?.count ?? 0 }],
    post_tags: post.post_tags ?? (post.tags ?? []).map((tag) => ({ tags: tag })),
  };
}

function adaptComment(comment: ApiComment): Comment {
  return {
    ...comment,
    profiles: comment.profile ?? comment.profiles ?? null,
  };
}

export const api = {
  async login(email: string, password: string) {
    const data = await request<{ token: string; user: AppSession['user']; profile: Profile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data;
  },

  async register(email: string, password: string, username: string): Promise<RegisterResult> {
    const data = await request<{
      token?: string;
      user?: AppSession['user'];
      profile?: Profile;
      status?: string;
      email?: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, display_name: username }),
    });
    // When email verification is active the backend does NOT log the user in —
    // it returns a status + email and expects the client to prompt for inbox.
    if (data.status === 'verification_sent' || data.status === 'verification_pending') {
      return { kind: 'verification', email: data.email ?? email };
    }
    setToken(data.token!);
    return { kind: 'session', token: data.token!, user: data.user!, profile: data.profile! };
  },

  // Consume the emailed verification token; activates a pending account.
  verifyEmail(token: string) {
    return request<{ status: string }>(`/api/auth/verify?token=${encodeURIComponent(token)}`);
  },

  // Re-send the verification email. Always resolves 200 (no email enumeration).
  resendVerification(email: string) {
    return request<{ status: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async me(): Promise<AppSession> {
    const token = getToken();
    if (!token) throw new Error('No token');
    const data = await request<{ user: AppSession['user']; profile: Profile }>('/api/auth/me');
    return { access_token: token, user: data.user, profile: data.profile };
  },

  signOut() {
    clearToken();
  },

  async listPosts() {
    return (await request<ApiPost[]>('/api/posts')).map(adaptPost);
  },

  async getPost(id: string) {
    return adaptPost(await request<ApiPost>(`/api/posts/${encodeURIComponent(id)}`));
  },

  async createPost(payload: {
    title: string;
    description?: string | null;
    content_md?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    github_url?: string | null;
    tags?: string[];
  }) {
    return adaptPost(await request<ApiPost>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
  },

  deletePost(id: string) {
    return request<void>(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getPostInteractions(id: string) {
    return request<{ isStarred: boolean; isSaved: boolean }>(`/api/posts/${encodeURIComponent(id)}/interactions`);
  },

  starPost(id: string) {
    return request<void>(`/api/posts/${encodeURIComponent(id)}/star`, { method: 'POST' });
  },

  unstarPost(id: string) {
    return request<void>(`/api/posts/${encodeURIComponent(id)}/star`, { method: 'DELETE' });
  },

  savePost(id: string) {
    return request<void>(`/api/posts/${encodeURIComponent(id)}/save`, { method: 'POST' });
  },

  unsavePost(id: string) {
    return request<void>(`/api/posts/${encodeURIComponent(id)}/save`, { method: 'DELETE' });
  },

  async listComments(postId: string) {
    return (await request<ApiComment[]>(`/api/posts/${encodeURIComponent(postId)}/comments`)).map(adaptComment);
  },

  async createComment(payload: { post_id: string; text: string; parent_id?: string | null }) {
    return adaptComment(await request<ApiComment>('/api/comments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));
  },

  deleteComment(id: string) {
    return request<void>(`/api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  getMyProfile() {
    return request<Profile>('/api/profiles/me');
  },

  async getMyProfileMini(): Promise<MyProfile | null> {
    const profile = await api.getMyProfile();
    return {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    };
  },

  getProfileByUsername(username: string) {
    return request<Profile>(`/api/profiles/username/${encodeURIComponent(username)}`);
  },

  async listProfilePosts(profileId: string) {
    return (await request<ApiPost[]>(`/api/profiles/${encodeURIComponent(profileId)}/posts`)).map(adaptPost);
  },

  async listProfileLikedPosts(profileId: string) {
    return (await request<ApiPost[]>(`/api/profiles/${encodeURIComponent(profileId)}/liked`)).map(adaptPost);
  },

  getProfileStats(profileId: string) {
    return request<{ followers: number; following: number }>(`/api/profiles/${encodeURIComponent(profileId)}/stats`);
  },

  getFollowStatus(profileId: string) {
    return request<{ isFollowing: boolean }>(`/api/profiles/${encodeURIComponent(profileId)}/follow-status`);
  },

  followProfile(profileId: string) {
    return request<void>(`/api/profiles/${encodeURIComponent(profileId)}/follow`, { method: 'POST' });
  },

  unfollowProfile(profileId: string) {
    return request<void>(`/api/profiles/${encodeURIComponent(profileId)}/follow`, { method: 'DELETE' });
  },

  updateMyProfile(payload: Partial<Profile>) {
    return request<Profile>('/api/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getSettings() {
    return request<UserSettings>('/api/settings');
  },

  updateSettings(patch: Partial<UserSettings>) {
    return request<UserSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  },

  async uploadMedia(file: File) {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${API_BASE_URL}/api/media`, {
      method: 'POST',
      headers,
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
    return body as { url: string };
  },

  async listSavedPosts() {
    return (await request<ApiPost[]>('/api/saved-posts')).map(adaptPost);
  },

  async listFollowingPosts() {
    return (await request<ApiPost[]>('/api/following/posts')).map(adaptPost);
  },

  async listTagPosts(name: string) {
    return (await request<ApiPost[]>(`/api/tags/${encodeURIComponent(name)}/posts`)).map(adaptPost);
  },

  async listTrendingPosts() {
    return (await request<ApiPost[]>('/api/trending/posts')).map(adaptPost);
  },

  async listTopTags(limit = 12): Promise<TopTag[]> {
    const tags = await request<(Tag & { post_count: number })[]>(`/api/tags/top?limit=${limit}`);
    return tags.map((tag) => ({ id: tag.id, name: tag.name, count: tag.post_count }));
  },

  search(q: string) {
    return request<{
      tags: Tag[];
      profiles: { username: string; display_name: string | null }[];
      posts: { id: string; title: string }[];
    }>(`/api/search?q=${encodeURIComponent(q)}`);
  },

  // ── Mini-games ──
  listGames(params: { q?: string; tag?: string; limit?: number } = {}) {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.tag) search.set('tag', params.tag);
    if (params.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return request<Game[]>(`/api/games${qs ? `?${qs}` : ''}`);
  },

  getGame(slug: string) {
    return request<Game>(`/api/games/${encodeURIComponent(slug)}`);
  },

  playGame(slug: string) {
    return request<void>(`/api/games/${encodeURIComponent(slug)}/play`, { method: 'POST' });
  },

  listMyGames() {
    return request<Game[]>('/api/me/games');
  },

  uploadGame(input: GameUploadInput) {
    return multipartRequest<Game>('/api/games', 'POST', buildGameForm(input));
  },

  updateGame(slug: string, input: GameUploadInput) {
    return multipartRequest<Game>(`/api/games/${encodeURIComponent(slug)}`, 'PUT', buildGameForm(input));
  },

  deleteGame(slug: string) {
    return request<void>(`/api/games/${encodeURIComponent(slug)}`, { method: 'DELETE' });
  },

  adminListGames(status?: GameStatus) {
    const qs = status ? `?status=${status}` : '';
    return request<AdminGamesResponse>(`/api/admin/games${qs}`);
  },

  approveGame(slug: string) {
    return request<Game>(`/api/admin/games/${encodeURIComponent(slug)}/approve`, { method: 'POST' });
  },

  rejectGame(slug: string, reason: string) {
    return request<Game>(`/api/admin/games/${encodeURIComponent(slug)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  removeGame(slug: string, reason?: string) {
    return request<Game>(`/api/admin/games/${encodeURIComponent(slug)}/remove`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? '' }),
    });
  },

  gameModerationLog(slug: string) {
    return request<GameModerationLogEntry[]>(`/api/admin/games/${encodeURIComponent(slug)}/moderation-log`);
  },

  // ── Admin: post moderation ──
  async adminListPosts(params: { limit?: number; q?: string } = {}) {
    const search = new URLSearchParams();
    search.set('limit', String(params.limit ?? 100));
    if (params.q) search.set('q', params.q);
    return (await request<ApiPost[]>(`/api/admin/posts?${search.toString()}`)).map(adaptPost);
  },

  adminDeletePost(id: string) {
    return request<void>(`/api/admin/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── Admin: user moderation ──
  adminListUsers(q?: string) {
    const search = new URLSearchParams();
    search.set('limit', '100');
    if (q) search.set('q', q);
    return request<AdminUser[]>(`/api/admin/users?${search.toString()}`);
  },

  // Grant/revoke the moderator role (главный админ only).
  adminSetUserRole(id: string, role: 'user' | 'moderator') {
    return request<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/role`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  // Ban a user. durationDays 0 = permanent; a positive value sets a ban that
  // auto-expires server-side.
  adminBanUser(id: string, reason: string, durationDays = 0) {
    return request<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason, duration_days: durationDays }),
    });
  },

  adminUnbanUser(id: string) {
    return request<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}/unban`, { method: 'POST' });
  },

  listConversations() {
    return request<import('../hooks/useChat').ChatConversation[]>('/api/chat/conversations');
  },

  createConversation(title?: string) {
    return request<import('../hooks/useChat').ChatConversation>('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: title ?? 'Новый чат' }),
    });
  },

  deleteConversation(id: string) {
    return request<void>(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  listMessages(conversationId: string) {
    return request<import('../hooks/useChat').ChatMessage[]>(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`);
  },

  createMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
    return request<import('../hooks/useChat').ChatMessage>(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content }),
    });
  },
};
