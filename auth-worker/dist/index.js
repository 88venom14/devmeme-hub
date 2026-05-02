var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};
async function signState(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(signState, "signState");
async function verifyState(secret, stateParam) {
  const dot = stateParam.lastIndexOf(".");
  if (dot === -1)
    return false;
  const value = stateParam.slice(0, dot);
  const received = stateParam.slice(dot + 1);
  const expected = await signState(secret, value);
  return received === expected;
}
__name(verifyState, "verifyState");
function errorRedirect(appUrl, code) {
  return Response.redirect(`${appUrl}/login?auth_error=${code}`, 302);
}
__name(errorRedirect, "errorRedirect");
async function supabaseUpsertUser(supabaseUrl, serviceKey, email, userMeta, appUrl) {
  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    "Content-Type": "application/json"
  };
  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "magiclink",
      email,
      options: { redirect_to: `${appUrl}/`, data: userMeta }
    })
  });
  const linkData = await linkRes.json();
  if (!linkData.action_link) {
    console.error("generate_link failed:", JSON.stringify(linkData));
    return null;
  }
  if (linkData.user?.id) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${linkData.user.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ user_metadata: userMeta })
    });
  }
  return Response.redirect(linkData.action_link, 302);
}
__name(supabaseUpsertUser, "supabaseUpsertUser");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (url.pathname === "/auth/github") {
      const nonce = crypto.randomUUID();
      const sig = await signState(env.STATE_SECRET, nonce);
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/auth/github/callback`,
        scope: "user:email read:user",
        state: `${nonce}.${sig}`
      });
      return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
    }
    if (url.pathname === "/auth/github/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";
      if (!code)
        return errorRedirect(env.APP_URL, "github_no_code");
      if (!await verifyState(env.STATE_SECRET, state))
        return errorRedirect(env.APP_URL, "invalid_state");
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/auth/github/callback`
        })
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token)
        return errorRedirect(env.APP_URL, "github_token_failed");
      const [userRes, emailsRes] = await Promise.all([
        fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "devmeme-auth-worker", Accept: "application/vnd.github.v3+json" }
        }),
        fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "devmeme-auth-worker", Accept: "application/vnd.github.v3+json" }
        })
      ]);
      const ghUser = await userRes.json();
      const emails = await emailsRes.json();
      const email = ghUser.email ?? emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email;
      if (!email)
        return errorRedirect(env.APP_URL, "github_no_email");
      const userMeta = {
        provider: "github",
        github_id: String(ghUser.id),
        user_name: ghUser.login,
        full_name: ghUser.name ?? ghUser.login,
        avatar_url: ghUser.avatar_url,
        username: ghUser.login,
        display_name: ghUser.name ?? ghUser.login
      };
      const redirect = await supabaseUpsertUser(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, email, userMeta, env.APP_URL);
      return redirect ?? errorRedirect(env.APP_URL, "supabase_link_failed");
    }
    if (url.pathname === "/auth/google") {
      const nonce = crypto.randomUUID();
      const sig = await signState(env.STATE_SECRET, nonce);
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: `${url.origin}/auth/google/callback`,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        state: `${nonce}.${sig}`
      });
      return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
    }
    if (url.pathname === "/auth/google/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";
      if (!code)
        return errorRedirect(env.APP_URL, "google_no_code");
      if (!await verifyState(env.STATE_SECRET, state))
        return errorRedirect(env.APP_URL, "invalid_state");
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${url.origin}/auth/google/callback`,
          grant_type: "authorization_code"
        })
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token)
        return errorRedirect(env.APP_URL, "google_token_failed");
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const gUser = await userRes.json();
      if (!gUser.email || !gUser.email_verified)
        return errorRedirect(env.APP_URL, "google_no_email");
      const username = gUser.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
      const userMeta = {
        provider: "google",
        google_id: gUser.sub,
        user_name: username,
        full_name: gUser.name,
        avatar_url: gUser.picture,
        username,
        display_name: gUser.name
      };
      const redirect = await supabaseUpsertUser(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, gUser.email, userMeta, env.APP_URL);
      return redirect ?? errorRedirect(env.APP_URL, "supabase_link_failed");
    }
    return new Response("DevMeme Auth Worker", { status: 200, headers: CORS_HEADERS });
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
