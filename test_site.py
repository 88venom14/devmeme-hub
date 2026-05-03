"""
Test devMeme Hub mutations by testing against Supabase directly.
Tests: login, like, save, comment, create post.
"""
import json
import urllib.request
import urllib.parse

# Direct Supabase URL (bypasses Cloudflare bot protection on the proxy Worker)
BASE = "https://noozgghctswdfnicmcnd.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vb3pnZ2hjdHN3ZGZuaWNtY25kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzE4NDIsImV4cCI6MjA5MTk0Nzg0Mn0.-fPUn24LpHxMehJV8dahUo_DYrtuG4J8KmTCqNiZsY4"

def req(method, url, data=None, headers=None):
    body = json.dumps(data).encode() if data else None
    h = {
        "apikey": ANON_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if headers:
        h.update(headers)
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw.decode()[:200]

results = {}

# --- 1. LOGIN ---
print("=== 1. LOGIN ===")
status, body = req("POST", f"{BASE}/auth/v1/token?grant_type=password", {
    "email": "test@test.com",
    "password": "123123",
})
print(f"Status: {status}")
if status == 200 and "access_token" in body:
    access_token = body["access_token"]
    user_id = body.get("user", {}).get("id", "?")
    print(f"OK — user_id={user_id}")
    results["login"] = "PASS"
else:
    print(f"FAIL — {body}")
    results["login"] = f"FAIL: {body}"
    access_token = None

if not access_token:
    print("\nCannot proceed without access token.")
    for k, v in results.items():
        print(f"  {k}: {v}")
    exit(1)

AUTH_HEADER = {"Authorization": f"Bearer {access_token}"}

# --- 2. GET FEED ---
print("\n=== 2. GET FEED ===")
status, body = req("GET", f"{BASE}/rest/v1/posts?select=id,title&order=created_at.desc&limit=5", headers=AUTH_HEADER)
print(f"Status: {status}")
if status == 200 and isinstance(body, list) and len(body) > 0:
    first_post = body[0]
    post_id = first_post["id"]
    print(f"OK — got {len(body)} posts, using: '{first_post.get('title','')[:40]}'")
    results["get_feed"] = "PASS"
else:
    print(f"FAIL — {body}")
    results["get_feed"] = f"FAIL: {status}"
    post_id = None

# --- 3. LIKE POST ---
print("\n=== 3. LIKE POST ===")
if post_id:
    # cleanup first
    req("DELETE", f"{BASE}/rest/v1/stars?post_id=eq.{post_id}&user_id=eq.{user_id}",
        headers={**AUTH_HEADER, "Content-Profile": "public"})
    # like
    status, body = req("POST", f"{BASE}/rest/v1/stars",
        {"post_id": post_id, "user_id": user_id},
        headers={**AUTH_HEADER, "Prefer": "return=representation", "Content-Profile": "public"})
    print(f"Status: {status}")
    if status in (200, 201):
        print(f"OK — liked post {post_id}")
        results["like_post"] = "PASS"
    else:
        print(f"FAIL — {body}")
        results["like_post"] = f"FAIL: {status} {str(body)[:100]}"
else:
    results["like_post"] = "SKIP"

# --- 4. SAVE POST ---
print("\n=== 4. SAVE POST ===")
if post_id:
    # cleanup first
    req("DELETE", f"{BASE}/rest/v1/saved_posts?post_id=eq.{post_id}&user_id=eq.{user_id}",
        headers={**AUTH_HEADER, "Content-Profile": "public"})
    # save
    status, body = req("POST", f"{BASE}/rest/v1/saved_posts",
        {"post_id": post_id, "user_id": user_id},
        headers={**AUTH_HEADER, "Prefer": "return=representation", "Content-Profile": "public"})
    print(f"Status: {status}")
    if status in (200, 201):
        print(f"OK — saved post {post_id}")
        results["save_post"] = "PASS"
    else:
        print(f"FAIL — {body}")
        results["save_post"] = f"FAIL: {status} {str(body)[:100]}"
else:
    results["save_post"] = "SKIP"

# --- 5. COMMENT ---
print("\n=== 5. SUBMIT COMMENT ===")
if post_id:
    status, body = req("POST", f"{BASE}/rest/v1/comments",
        {"post_id": post_id, "user_id": user_id, "text": "Automated browser test comment", "parent_id": None},
        headers={**AUTH_HEADER, "Prefer": "return=representation", "Content-Profile": "public"})
    print(f"Status: {status}")
    if status in (200, 201):
        comment_id = body[0]["id"] if isinstance(body, list) else body.get("id", "?")
        print(f"OK — comment_id={comment_id}")
        results["submit_comment"] = "PASS"
        # cleanup
        req("DELETE", f"{BASE}/rest/v1/comments?id=eq.{comment_id}",
            headers={**AUTH_HEADER, "Content-Profile": "public"})
    else:
        print(f"FAIL — {body}")
        results["submit_comment"] = f"FAIL: {status} {str(body)[:100]}"
else:
    results["submit_comment"] = "SKIP"

# --- 6. CREATE POST ---
print("\n=== 6. CREATE POST ===")
status, body = req("POST", f"{BASE}/rest/v1/posts",
    {"user_id": user_id, "title": "Browser Test", "content_md": "Automated test post",
     "image_url": None, "video_url": None, "github_url": None},
    headers={**AUTH_HEADER, "Prefer": "return=representation", "Content-Profile": "public"})
print(f"Status: {status}")
if status in (200, 201):
    new_post = body[0] if isinstance(body, list) else body
    new_post_id = new_post.get("id", "?")
    print(f"OK — new post_id={new_post_id}")
    results["create_post"] = "PASS"
    req("DELETE", f"{BASE}/rest/v1/posts?id=eq.{new_post_id}",
        headers={**AUTH_HEADER, "Content-Profile": "public"})
    print(f"Cleaned up test post")
else:
    print(f"FAIL — {body}")
    results["create_post"] = f"FAIL: {status} {str(body)[:100]}"

# --- SUMMARY ---
print("\n" + "="*50)
print("FINAL TEST RESULTS")
print("="*50)
all_pass = True
for test, result in results.items():
    icon = "✓" if result.startswith("PASS") else ("~" if result == "SKIP" else "✗")
    print(f"  {icon} {test}: {result}")
    if not result.startswith("PASS") and result != "SKIP":
        all_pass = False

print()
print("ALL TESTS PASSED" if all_pass else "SOME TESTS FAILED")
