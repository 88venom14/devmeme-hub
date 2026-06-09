// End-to-end smoke test for the devmeme-hub Go API.
//
// Exercises the main flows the frontend depends on: auth, posts, comments,
// stars/saves, follows, profile updates (including null-clearing), search,
// tags, trending, chat, media upload + content-type sniffing, and auth guards.
//
// Usage:
//   node scripts/smoke-api.mjs            # defaults to http://127.0.0.1:8080
//   API=http://127.0.0.1:8080 node scripts/smoke-api.mjs
//
// Requires the Go API (and its database) to be running locally.

const BASE = process.env.API ?? 'http://127.0.0.1:8080';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(path, { method = 'GET', token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined && !raw) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { status: res.status, data };
}

const rnd = Math.random().toString(36).slice(2, 8);

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  // ── health ──────────────────────────────────────────────────────────────
  console.log('health:');
  const health = await api('/healthz');
  check('GET /healthz -> 200', health.status === 200);
  check('healthz status ok', health.data?.status === 'ok');

  // ── auth ────────────────────────────────────────────────────────────────
  console.log('auth:');
  const email = `smoke_${rnd}@example.com`;
  const username = `smoke${rnd}`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'supersecret123', username, display_name: username },
  });
  check('register -> 201', reg.status === 201, `got ${reg.status}`);
  const token = reg.data?.token;
  check('register returns token', typeof token === 'string' && token.length > 20);
  check('register returns profile', reg.data?.profile?.username === username);

  const dupe = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password: 'supersecret123', username: `${username}x` },
  });
  check('duplicate email -> 409', dupe.status === 409, `got ${dupe.status}`);

  const shortPw = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `x_${rnd}@example.com`, password: 'short', username: `x${rnd}` },
  });
  check('short password -> 400', shortPw.status === 400, `got ${shortPw.status}`);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'supersecret123' },
  });
  check('login -> 200', login.status === 200, `got ${login.status}`);
  check('login returns token', typeof login.data?.token === 'string');

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'wrongpassword' },
  });
  check('wrong password -> 401', badLogin.status === 401, `got ${badLogin.status}`);

  const me = await api('/api/auth/me', { token });
  check('GET /api/auth/me -> 200', me.status === 200);
  check('me email matches', me.data?.user?.email === email);

  const noAuth = await api('/api/posts', { method: 'POST', body: { title: 'x' } });
  check('create post without token -> 401', noAuth.status === 401, `got ${noAuth.status}`);

  // ── posts ───────────────────────────────────────────────────────────────
  console.log('posts:');
  const tag1 = `smoketag${rnd}`;
  const created = await api('/api/posts', {
    method: 'POST',
    token,
    body: { title: `Smoke post ${rnd}`, content_md: '# hello\n\nbody', tags: [tag1, 'shared'] },
  });
  check('create post -> 201', created.status === 201, `got ${created.status}`);
  const postId = created.data?.id;
  check('created post has id', !!postId);
  check('created post has 2 tags', created.data?.tags?.length === 2, `tags=${created.data?.tags?.length}`);

  const tooLong = await api('/api/posts', {
    method: 'POST',
    token,
    body: { title: 'x'.repeat(200) },
  });
  check('over-long title -> 400', tooLong.status === 400, `got ${tooLong.status}`);

  const got = await api(`/api/posts/${postId}`);
  check('get post -> 200', got.status === 200);
  check('get post title matches', got.data?.title === `Smoke post ${rnd}`);
  check('get post embeds author profile', !!got.data?.profile?.username);

  const list = await api('/api/posts?limit=2');
  check('list posts respects limit=2', Array.isArray(list.data) && list.data.length <= 2);
  const listBadLimit = await api('/api/posts?limit=abc');
  check('list posts tolerates bad limit', Array.isArray(listBadLimit.data) && listBadLimit.data.length > 0);

  // ── comments ──────────────────────────────────────────────────────────────
  console.log('comments:');
  const comment = await api('/api/comments', {
    method: 'POST',
    token,
    body: { post_id: postId, text: 'nice post' },
  });
  check('create comment -> 201', comment.status === 201, `got ${comment.status}`);
  const comments = await api(`/api/posts/${postId}/comments`);
  check('list comments includes new comment', Array.isArray(comments.data) && comments.data.some((c) => c.text === 'nice post'));

  // ── stars / saves ───────────────────────────────────────────────────────
  console.log('stars/saves:');
  const star = await api(`/api/posts/${postId}/star`, { method: 'POST', token });
  check('star post -> 204', star.status === 204, `got ${star.status}`);
  const save = await api(`/api/posts/${postId}/save`, { method: 'POST', token });
  check('save post -> 204', save.status === 204, `got ${save.status}`);
  const inter = await api(`/api/posts/${postId}/interactions`, { token });
  check('interactions isStarred true', inter.data?.isStarred === true);
  check('interactions isSaved true', inter.data?.isSaved === true);
  const saved = await api('/api/saved-posts', { token });
  check('saved-posts includes post', Array.isArray(saved.data) && saved.data.some((p) => p.id === postId));
  const unstar = await api(`/api/posts/${postId}/star`, { method: 'DELETE', token });
  check('unstar -> 204', unstar.status === 204);
  const inter2 = await api(`/api/posts/${postId}/interactions`, { token });
  check('interactions isStarred false after unstar', inter2.data?.isStarred === false);

  // ── profile update incl. null-clearing (COALESCE fix) ─────────────────────
  console.log('profile update:');
  const setBio = await api('/api/profiles/me', { method: 'PATCH', token, body: { bio: 'hello bio' } });
  check('set bio -> 200', setBio.status === 200 && setBio.data?.bio === 'hello bio');
  const clearBio = await api('/api/profiles/me', { method: 'PATCH', token, body: { bio: null } });
  check('clear bio with null works (COALESCE fix)', clearBio.status === 200 && clearBio.data?.bio === null, `bio=${JSON.stringify(clearBio.data?.bio)}`);
  const unknownField = await api('/api/profiles/me', { method: 'PATCH', token, body: { nope: 'x' } });
  check('unknown profile field -> 400', unknownField.status === 400, `got ${unknownField.status}`);
  const nullUsername = await api('/api/profiles/me', { method: 'PATCH', token, body: { username: null } });
  check('null username -> 400', nullUsername.status === 400, `got ${nullUsername.status}`);

  // ── follows ───────────────────────────────────────────────────────────────
  console.log('follows:');
  const others = (await api('/api/posts')).data.filter((p) => p.user_id !== me.data.user.id);
  const targetId = others[0]?.user_id;
  if (targetId) {
    const follow = await api(`/api/profiles/${targetId}/follow`, { method: 'POST', token });
    check('follow -> 204', follow.status === 204, `got ${follow.status}`);
    const fs = await api(`/api/profiles/${targetId}/follow-status`, { token });
    check('follow-status isFollowing true', fs.data?.isFollowing === true);
    const stats = await api(`/api/profiles/${targetId}/stats`);
    check('target stats followers >= 1', (stats.data?.followers ?? 0) >= 1);
    const followingPosts = await api('/api/following/posts', { token });
    check('following/posts returns array', Array.isArray(followingPosts.data));
    const unfollow = await api(`/api/profiles/${targetId}/follow`, { method: 'DELETE', token });
    check('unfollow -> 204', unfollow.status === 204);
  } else {
    check('found another profile to follow', false, 'no other users seeded');
  }

  // ── search / tags / trending ──────────────────────────────────────────────
  console.log('search/tags/trending:');
  const search = await api(`/api/search?q=${encodeURIComponent(username.slice(0, 5))}`);
  check('search -> 200 with shape', search.status === 200 && 'profiles' in search.data && 'posts' in search.data && 'tags' in search.data);
  const tagSearch = await api(`/api/search?q=${encodeURIComponent('#' + tag1)}`);
  check('tag search returns the new tag', Array.isArray(tagSearch.data?.tags) && tagSearch.data.tags.some((t) => t.name === tag1));
  const topTags = await api('/api/tags/top?limit=5');
  check('tags/top -> array', Array.isArray(topTags.data));
  const tagPosts = await api(`/api/tags/${tag1}/posts`);
  check('tag posts includes our post', Array.isArray(tagPosts.data) && tagPosts.data.some((p) => p.id === postId));
  const trending = await api('/api/trending/posts');
  check('trending/posts -> array', Array.isArray(trending.data));
  const byUsername = await api(`/api/profiles/username/${username}`);
  check('profile by username -> 200', byUsername.status === 200 && byUsername.data?.username === username);
  const profilePosts = await api(`/api/profiles/${me.data.user.id}/posts`);
  check('profile posts includes our post', Array.isArray(profilePosts.data) && profilePosts.data.some((p) => p.id === postId));

  // ── chat ──────────────────────────────────────────────────────────────────
  console.log('chat:');
  const conv = await api('/api/chat/conversations', { method: 'POST', token, body: { title: 'Smoke chat' } });
  check('create conversation -> 201', conv.status === 201, `got ${conv.status}`);
  const convId = conv.data?.id;
  const msg = await api(`/api/chat/conversations/${convId}/messages`, {
    method: 'POST', token, body: { role: 'user', content: 'hi there' },
  });
  check('post chat message -> 201', msg.status === 201, `got ${msg.status}`);
  const msgs = await api(`/api/chat/conversations/${convId}/messages`, { token });
  check('list chat messages includes message', Array.isArray(msgs.data) && msgs.data.some((m) => m.content === 'hi there'));
  const convList = await api('/api/chat/conversations', { token });
  check('list conversations includes new one', Array.isArray(convList.data) && convList.data.some((c) => c.id === convId));
  const badRole = await api(`/api/chat/conversations/${convId}/messages`, {
    method: 'POST', token, body: { role: 'system', content: 'x' },
  });
  check('invalid chat role -> 400', badRole.status === 400, `got ${badRole.status}`);

  // ── media upload + content-type sniffing ──────────────────────────────────
  console.log('media:');
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const pngForm = new FormData();
  pngForm.append('file', new Blob([pngBytes], { type: 'image/png' }), 'pic.png');
  const upload = await fetch(`${BASE}/api/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: pngForm });
  const uploadData = await upload.json().catch(() => null);
  check('upload real PNG -> 201', upload.status === 201, `got ${upload.status}`);
  check('upload returns media url ending .png', typeof uploadData?.url === 'string' && uploadData.url.endsWith('.png'), uploadData?.url);

  const fakeForm = new FormData();
  fakeForm.append('file', new Blob(['this is plain text not an image at all'], { type: 'image/png' }), 'fake.png');
  const fakeUpload = await fetch(`${BASE}/api/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fakeForm });
  check('spoofed content-type rejected -> 400', fakeUpload.status === 400, `got ${fakeUpload.status}`);

  // ── settings ───────────────────────────────────────────────────────────────
  console.log('settings:');
  const settingsNoAuth = await api('/api/settings');
  check('settings without token -> 401', settingsNoAuth.status === 401, `got ${settingsNoAuth.status}`);
  const settings = await api('/api/settings', { token });
  check('GET settings -> 200', settings.status === 200);
  check('settings has all 8 keys', settings.data && Object.keys(settings.data).length === 8);
  check('default notify_likes is true', settings.data?.notify_likes === true);
  check('default two_factor is false', settings.data?.two_factor === false);
  const upd = await api('/api/settings', { method: 'PUT', token, body: { two_factor: true, notify_likes: false } });
  check('PUT settings -> 200', upd.status === 200);
  check('settings updated in response', upd.data?.two_factor === true && upd.data?.notify_likes === false);
  check('untouched setting unchanged', upd.data?.notify_comments === true);
  const reloaded = await api('/api/settings', { token });
  check('settings persisted across reload', reloaded.data?.two_factor === true && reloaded.data?.notify_likes === false);
  const badKey = await api('/api/settings', { method: 'PUT', token, body: { not_a_setting: true } });
  check('unknown setting -> 400', badKey.status === 400, `got ${badKey.status}`);
  const badType = await api('/api/settings', { method: 'PUT', token, body: { two_factor: 'yes' } });
  check('non-boolean setting -> 400', badType.status === 400, `got ${badType.status}`);

  // ── privacy: profile_followers_only ──────────────────────────────────────
  console.log('privacy (followers-only profile):');
  const viewer = await api('/api/auth/register', {
    method: 'POST',
    body: { email: `viewer_${rnd}@example.com`, password: 'supersecret123', username: `viewer${rnd}` },
  });
  const viewerToken = viewer.data?.token;
  check('register viewer -> 201', viewer.status === 201 && !!viewerToken);

  await api('/api/settings', { method: 'PUT', token, body: { profile_followers_only: true } });

  const asStranger = await api(`/api/profiles/username/${username}`, { token: viewerToken });
  check('stranger sees is_private=true', asStranger.data?.is_private === true, JSON.stringify(asStranger.data?.is_private));
  check('private profile hides bio', asStranger.data?.bio == null);
  const strangerPosts = await api(`/api/profiles/${me.data.user.id}/posts`, { token: viewerToken });
  check('stranger gets empty posts list', Array.isArray(strangerPosts.data) && strangerPosts.data.length === 0);

  const asAnon = await api(`/api/profiles/username/${username}`);
  check('anonymous sees is_private=true', asAnon.data?.is_private === true);

  const asOwner = await api(`/api/profiles/username/${username}`, { token });
  check('owner sees own full profile', asOwner.data?.is_private !== true && asOwner.data?.username === username);

  await api(`/api/profiles/${me.data.user.id}/follow`, { method: 'POST', token: viewerToken });
  const asFollower = await api(`/api/profiles/username/${username}`, { token: viewerToken });
  check('follower sees full profile after following', asFollower.data?.is_private !== true && asFollower.data?.username === username);
  const followerPosts = await api(`/api/profiles/${me.data.user.id}/posts`, { token: viewerToken });
  check('follower sees posts after following', Array.isArray(followerPosts.data) && followerPosts.data.length >= 1);

  // reset
  await api('/api/settings', { method: 'PUT', token, body: { profile_followers_only: false } });

  // ── cleanup ────────────────────────────────────────────────────────────────
  console.log('cleanup:');
  const del = await api(`/api/posts/${postId}`, { method: 'DELETE', token });
  check('delete own post -> 204', del.status === 204, `got ${del.status}`);
  const goneAfter = await api(`/api/posts/${postId}`);
  check('deleted post -> 404', goneAfter.status === 404, `got ${goneAfter.status}`);

  // ── summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err);
  process.exit(1);
});
