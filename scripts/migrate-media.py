#!/usr/bin/env python3
"""Download external (Supabase/Worker) media referenced by the JSONL backup,
optimize it (images -> WebP, videos -> 720p H.264 MP4), write optimized files
into media_out/ mirroring the original path, and emit a URL rewrite map.

Downloads go through the local HTTP proxy (honored automatically by curl via the
ALL_PROXY/HTTPS_PROXY environment), since the source hosts are only reachable
from this machine, not the target server.
"""
import json, os, subprocess, sys, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKUP = ROOT / "backups" / "devmeme_backup_jsonl"
SRC = ROOT / "backups" / "media_src"
OUT = ROOT / "backups" / "media_out"
MAP = ROOT / "backups" / "media_url_map.json"

NEW_BASE = "https://77.91.95.18.sslip.io/media"
HOSTS = ("supabase.co", "workers.dev")

# Per-field max longest-side (px) for images.
IMG_MAXDIM = {"avatar_url": 512, "banner_url": 1600, "image_url": 1920}
WEBP_Q = 80

FIELDS = ("image_url", "video_url", "avatar_url", "banner_url")

from PIL import Image

def rel_path(url: str) -> str:
    # everything after .../public/
    marker = "/public/"
    i = url.find(marker)
    return url[i + len(marker):] if i >= 0 else url.rsplit("/", 1)[-1]

def collect():
    seen = {}  # url -> field (first field wins for sizing)
    for fname in ("public_posts.jsonl", "public_profiles.jsonl"):
        p = BACKUP / fname
        if not p.exists():
            continue
        for line in p.open(encoding="utf-8-sig"):
            line = line.strip()
            if not line:
                continue
            d = json.loads(line)
            for f in FIELDS:
                v = d.get(f)
                if v and any(h in v for h in HOSTS):
                    seen.setdefault(v, f)
    return seen

def download(url: str, dst: Path) -> bool:
    if dst.exists() and dst.stat().st_size > 0:
        return True  # resume: already downloaded
    dst.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["curl", "-sS", "-L", "--fail", "-m", "120", "-o", str(dst), url])
    return r.returncode == 0 and dst.exists() and dst.stat().st_size > 0

def opt_image_ffmpeg(src: Path, out: Path, maxdim: int):
    # Fallback for formats Pillow can't decode (e.g. HEIC/HEVC mislabeled .png).
    vf = (f"scale='min({maxdim},iw)':'min({maxdim},ih)'"
          ":force_original_aspect_ratio=decrease:force_divisible_by=2")
    subprocess.run(["ffmpeg", "-y", "-i", str(src), "-vf", vf,
                    "-c:v", "libwebp", "-quality", str(WEBP_Q),
                    "-loglevel", "error", str(out)], check=True)

def opt_image(src: Path, out: Path, maxdim: int):
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        im = Image.open(src)
        im = im.convert("RGB") if im.mode not in ("RGB", "RGBA", "LA", "P") else (
            im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im)
        w, h = im.size
        scale = min(1.0, maxdim / max(w, h))
        if scale < 1.0:
            im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        im.save(out, "WEBP", quality=WEBP_Q, method=6)
    except Exception:
        opt_image_ffmpeg(src, out, maxdim)

def opt_video(src: Path, out: Path):
    out.parent.mkdir(parents=True, exist_ok=True)
    # Downscale to max 1280x720 only if larger; H.264 + faststart + AAC.
    vf = ("scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease"
          ":force_divisible_by=2")
    cmd = ["ffmpeg", "-y", "-i", str(src), "-vf", vf,
           "-c:v", "libx264", "-preset", "medium", "-crf", "28", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k",
           "-loglevel", "error", str(out)]
    subprocess.run(cmd, check=True)

def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    media = collect()
    print(f"media to migrate: {len(media)}")
    url_map = {}
    failed = []
    tot_src = tot_out = 0
    for i, (url, field) in enumerate(sorted(media.items()), 1):
        rel = rel_path(url)            # post-media/<folder>/<file.ext>
        stem = rel.rsplit(".", 1)[0]
        ext = rel.rsplit(".", 1)[-1].lower()
        src = SRC / rel
        try:
            if not download(url, src):
                raise RuntimeError("download failed")
            ssz = src.stat().st_size
            is_video = ext in ("mp4", "mov", "webm", "mkv", "avi")
            if is_video:
                newrel = stem + ".mp4"
                opt_video(src, OUT / newrel)
            else:
                newrel = stem + ".webp"
                opt_image(src, OUT / newrel, IMG_MAXDIM.get(field, 1920))
            osz = (OUT / newrel).stat().st_size
            tot_src += ssz; tot_out += osz
            url_map[url] = f"{NEW_BASE}/{newrel}"
            print(f"  [{i}] {('VID' if is_video else 'IMG')} {ssz//1024}K -> {osz//1024}K  {newrel}")
        except Exception as e:
            failed.append((url, str(e)))
            print(f"  [{i}] FAILED: {url} ({e})")
    MAP.write_text(json.dumps(url_map, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nmapped {len(url_map)} urls, failed {len(failed)}")
    for u, e in failed:
        print("  FAIL", u, e)
    print(f"original total: {tot_src/1024/1024:.2f} MB -> optimized: {tot_out/1024/1024:.2f} MB")
    if tot_src:
        print(f"reduction: {100*(1-tot_out/tot_src):.1f}%")

if __name__ == "__main__":
    main()
