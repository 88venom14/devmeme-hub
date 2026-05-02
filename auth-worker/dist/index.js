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
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (url.pathname === "/auth/github") {
      const nonce = crypto.randomUUID();
      const sig = await signState(env.STATE_SECRET, nonce);
      const state = `${nonce}.${sig}`;
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/auth/github/callback`,
        scope: "user:email read:user",
        state
      });
      return Response.redirect(
        `https://github.com/login/oauth/authorize?${params}`,
        302
      );
    }
    if (url.pathname === "/auth/github/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";
      if (!code)
        return errorRedirect(env.APP_URL, "github_no_code");
      const valid = await verifyState(env.STATE_SECRET, state);
      if (!valid)
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
      const ghToken = tokenData.access_token;
      const [userRes, emailsRes] = await Promise.all([
        fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${ghToken}`,
            "User-Agent": "devmeme-auth-worker",
            Accept: "application/vnd.github.v3+json"
          }
        }),
        fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${ghToken}`,
            "User-Agent": "devmeme-auth-worker",
            Accept: "application/vnd.github.v3+json"
          }
        })
      ]);
      const ghUser = await userRes.json();
      const emails = await emailsRes.json();
      const primaryEmail = ghUser.email ?? emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email;
      if (!primaryEmail)
        return errorRedirect(env.APP_URL, "github_no_email");
      const supabaseHeaders = {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json"
      };
      const userMeta = {
        provider: "github",
        github_id: String(ghUser.id),
        user_name: ghUser.login,
        full_name: ghUser.name ?? ghUser.login,
        avatar_url: ghUser.avatar_url,
        username: ghUser.login,
        display_name: ghUser.name ?? ghUser.login
      };
      const linkRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: supabaseHeaders,
        body: JSON.stringify({
          type: "magiclink",
          email: primaryEmail,
          options: {
            redirect_to: `${env.APP_URL}/`,
            data: userMeta
          }
        })
      });
      const linkData = await linkRes.json();
      if (!linkData.action_link) {
        console.error("generate_link failed:", JSON.stringify(linkData));
        return errorRedirect(env.APP_URL, "supabase_link_failed");
      }
      if (linkData.user?.id) {
        await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${linkData.user.id}`, {
          method: "PUT",
          headers: supabaseHeaders,
          body: JSON.stringify({ user_metadata: userMeta })
        });
      }
      return Response.redirect(linkData.action_link, 302);
    }
    return new Response("DevMeme Auth Worker", { status: 200, headers: CORS_HEADERS });
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
