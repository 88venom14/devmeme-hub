interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_URL: string;
  STATE_SECRET: string;
}

function allowedOrigins(env: Env): string[] {
  return [env.APP_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
}

// Reflect the request origin only when allowlisted; never emit a wildcard.
function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const list = allowedOrigins(env);
  const allow = origin && list.includes(origin) ? origin : list[0] ?? env.APP_URL;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  };
}

async function signState(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function verifyState(secret: string, stateParam: string): Promise<boolean> {
  const dot = stateParam.lastIndexOf('.');
  if (dot === -1) return false;
  const value = stateParam.slice(0, dot);
  const received = stateParam.slice(dot + 1);
  const expected = await signState(secret, value);
  return received === expected;
}

function errorRedirect(appUrl: string, code: string): Response {
  return Response.redirect(`${appUrl}/login?auth_error=${code}`, 302);
}

async function supabaseUpsertUser(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
  userMeta: Record<string, string>,
  appUrl: string,
): Promise<Response | null> {
  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  };

  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'magiclink',
      email,
      options: { redirect_to: `${appUrl}/`, data: userMeta },
    }),
  });

  const linkData = await linkRes.json() as {
    action_link?: string;
    user?: { id: string };
    error?: string;
    msg?: string;
  };

  if (!linkData.action_link) {
    console.error('generate_link failed:', JSON.stringify(linkData));
    return null;
  }

  if (linkData.user?.id) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${linkData.user.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ user_metadata: userMeta }),
    });
  }

  return Response.redirect(linkData.action_link, 302);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get('Origin'), env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // ── GitHub ──────────────────────────────────────────────────────────────

    if (url.pathname === '/auth/github') {
      const nonce = crypto.randomUUID();
      const sig = await signState(env.STATE_SECRET, nonce);
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/auth/github/callback`,
        scope: 'user:email read:user',
        state: `${nonce}.${sig}`,
      });
      return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
    }

    if (url.pathname === '/auth/github/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') ?? '';
      if (!code) return errorRedirect(env.APP_URL, 'github_no_code');
      if (!await verifyState(env.STATE_SECRET, state)) return errorRedirect(env.APP_URL, 'invalid_state');

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/auth/github/callback`,
        }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string };
      if (!tokenData.access_token) return errorRedirect(env.APP_URL, 'github_token_failed');

      const [userRes, emailsRes] = await Promise.all([
        fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'devmeme-auth-worker', Accept: 'application/vnd.github.v3+json' },
        }),
        fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'devmeme-auth-worker', Accept: 'application/vnd.github.v3+json' },
        }),
      ]);

      const ghUser = await userRes.json() as { id: number; login: string; name: string | null; email: string | null; avatar_url: string };
      const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      const email = ghUser.email ?? emails.find(e => e.primary && e.verified)?.email ?? emails.find(e => e.verified)?.email;
      if (!email) return errorRedirect(env.APP_URL, 'github_no_email');

      const userMeta = {
        provider: 'github',
        github_id: String(ghUser.id),
        user_name: ghUser.login,
        full_name: ghUser.name ?? ghUser.login,
        avatar_url: ghUser.avatar_url,
        username: ghUser.login,
        display_name: ghUser.name ?? ghUser.login,
      };

      const redirect = await supabaseUpsertUser(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, email, userMeta, env.APP_URL);
      return redirect ?? errorRedirect(env.APP_URL, 'supabase_link_failed');
    }

    // ── Google ──────────────────────────────────────────────────────────────

    if (url.pathname === '/auth/google') {
      const nonce = crypto.randomUUID();
      const sig = await signState(env.STATE_SECRET, nonce);
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: `${url.origin}/auth/google/callback`,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        state: `${nonce}.${sig}`,
      });
      return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
    }

    if (url.pathname === '/auth/google/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') ?? '';
      if (!code) return errorRedirect(env.APP_URL, 'google_no_code');
      if (!await verifyState(env.STATE_SECRET, state)) return errorRedirect(env.APP_URL, 'invalid_state');

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${url.origin}/auth/google/callback`,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) return errorRedirect(env.APP_URL, 'google_token_failed');

      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const gUser = await userRes.json() as { sub: string; email: string; name: string; picture: string; email_verified: boolean };
      if (!gUser.email || !gUser.email_verified) return errorRedirect(env.APP_URL, 'google_no_email');

      const username = gUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      const userMeta = {
        provider: 'google',
        google_id: gUser.sub,
        user_name: username,
        full_name: gUser.name,
        avatar_url: gUser.picture,
        username,
        display_name: gUser.name,
      };

      const redirect = await supabaseUpsertUser(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, gUser.email, userMeta, env.APP_URL);
      return redirect ?? errorRedirect(env.APP_URL, 'supabase_link_failed');
    }

    return new Response('DevMeme Auth Worker', { status: 200, headers: cors });
  },
};
