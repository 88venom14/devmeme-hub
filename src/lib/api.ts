import type { Comment, MyProfile, PostWithMeta, Profile, Tag, TopTag } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';
export const TOKEN_KEY = 'devmeme_token';

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
  user: { id: string; email: string };
  profile?: Profile | null;
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

  async register(email: string, password: string, username: string) {
    const data = await request<{ token: string; user: AppSession['user']; profile: Profile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, display_name: username }),
    });
    setToken(data.token);
    return data;
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
