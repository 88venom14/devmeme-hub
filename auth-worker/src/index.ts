interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_URL: string;
  STATE_SECRET: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Step 1: redirect to GitHub
    if (url.pathname === '/auth/github') {
      const nonce = crypto.randomUUID();
      const sig = await signState(env.STATE_SECRET, nonce);
      const state = `${nonce}.${sig}`;

      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/auth/github/callback`,
        scope: 'user:email read:user',
        state,
      });

      return Response.redirect(
        `https://github.com/login/oauth/authorize?${params}`,
        302,
      );
    }

    // Step 2: GitHub callback
    if (url.pathname === '/auth/github/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') ?? '';

      if (!code) return errorRedirect(env.APP_URL, 'github_no_code');

      // Verify CSRF state
      const valid = await verifyState(env.STATE_SECRET, state);
      if (!valid) return errorRedirect(env.APP_URL, 'invalid_state');

      // Exchange code for GitHub access token
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

      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) return errorRedirect(env.APP_URL, 'github_token_failed');

      const ghToken = tokenData.access_token;

      // Get GitHub user profile
      const [userRes, emailsRes] = await Promise.all([
        fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${ghToken}`,
            'User-Agent': 'devmeme-auth-worker',
            Accept: 'application/vnd.github.v3+json',
          },
        }),
        fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${ghToken}`,
            'User-Agent': 'devmeme-auth-worker',
            Accept: 'application/vnd.github.v3+json',
          },
        }),
      ]);

      const ghUser = await userRes.json() as {
        id: number;
        login: string;
        name: string | null;
        email: string | null;
        avatar_url: string;
        bio: string | null;
      };

      const emails = await emailsRes.json() as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;

      const primaryEmail =
        ghUser.email ??
        emails.find(e => e.primary && e.verified)?.email ??
        emails.find(e => e.verified)?.email;

      if (!primaryEmail) return errorRedirect(env.APP_URL, 'github_no_email');

      const supabaseHeaders = {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      };

      const userMeta = {
        provider: 'github',
        github_id: String(ghUser.id),
        user_name: ghUser.login,
        full_name: ghUser.name ?? ghUser.login,
        avatar_url: ghUser.avatar_url,
        username: ghUser.login,
        display_name: ghUser.name ?? ghUser.login,
      };

      // Generate magic link via Supabase Admin API.
      // This creates the user if they don't exist yet (no email sent).
      const linkRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: supabaseHeaders,
        body: JSON.stringify({
          type: 'magiclink',
          email: primaryEmail,
          options: {
            redirect_to: `${env.APP_URL}/`,
            data: userMeta,
          },
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
        return errorRedirect(env.APP_URL, 'supabase_link_failed');
      }

      // Update user metadata so GitHub info is always fresh
      if (linkData.user?.id) {
        await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${linkData.user.id}`, {
          method: 'PUT',
          headers: supabaseHeaders,
          body: JSON.stringify({ user_metadata: userMeta }),
        });
      }

      return Response.redirect(linkData.action_link, 302);
    }

    return new Response('DevMeme Auth Worker', { status: 200, headers: CORS_HEADERS });
  },
};
