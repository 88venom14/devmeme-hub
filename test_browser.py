import subprocess
import time
import os
import sys

os.environ["PATH"] = r"C:\Users\Компьютер\.local\bin;" + os.environ.get("PATH", "")

def run(args):
    r = subprocess.run(["browser-act"] + args, capture_output=True, text=True, env=os.environ)
    out = (r.stdout + r.stderr).strip()
    print(f"$ browser-act {' '.join(args)}")
    print(out[:300] if out else "(no output)")
    print()
    return r.returncode == 0, out

steps = []

# Step 1: Open login page
ok, out = run(["browser", "real", "open", "https://fluttershy.horsefucker.ru/login", "--ba-kernel"])
steps.append(("Open login page", ok, out))
if not ok:
    print("FAILED to open browser, aborting")
    sys.exit(1)

time.sleep(3)

# Step 2: Wait stable
ok, out = run(["wait", "stable"])
steps.append(("Wait stable", ok, out))

# Step 3: Screenshot login
ok, out = run(["screenshot", "C:/tmp/01-login.png"])
steps.append(("Screenshot login page", ok, out))

# Step 4: Get state
ok, out = run(["state"])
steps.append(("Get page state", ok, out))

print("\n=== SUMMARY ===")
for name, ok, out in steps:
    status = "OK" if ok else "FAIL"
    print(f"[{status}] {name}")
    if not ok:
        print(f"  Error: {out[:100]}")
