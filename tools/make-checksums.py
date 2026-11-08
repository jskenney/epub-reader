#!/usr/bin/env python3
"""Write checksums/kokoro.sha256 and checksums/pocket.sha256: the SHA-256 of every file the fetch scripts can
download, which they then check after downloading. Run it after changing a version or revision pinned in
fetch-kokoro.sh or fetch-pocket.sh (and index.html):

    python3 tools/make-checksums.py            # both
    python3 tools/make-checksums.py pocket     # one

Large model files aren't downloaded: their SHA-256 comes from Hugging Face's file list for the pinned
revision (Git LFS records it). Everything else is downloaded with curl and hashed.
"""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JOBS = {"kokoro": [["./fetch-kokoro.sh", "--list"]],
        "pocket": [["./fetch-pocket.sh", "--list", "all"], ["./fetch-pocket.sh", "--list", "--int8", "all"]]}
HF = re.compile(r"^https://huggingface\.co/([^/]+/[^/]+)/resolve/([^/]+)/(.+)$")
trees = {}


def curl(url: str) -> bytes:
    return subprocess.run(["curl", "-sSfL", "--retry", "3", url], check=True, capture_output=True).stdout


def lfs_sha256(repo: str, rev: str, path: str):
    if (repo, rev) not in trees:
        listing = json.loads(curl(f"https://huggingface.co/api/models/{repo}/tree/{rev}?recursive=true"))
        trees[repo, rev] = {e["path"]: e for e in listing if e.get("type") == "file"}
    entry = trees[repo, rev].get(path)
    if entry is None:
        sys.exit(f"{path} isn't in {repo} at {rev}")
    return (entry.get("lfs") or {}).get("oid")


def main(names):
    for name in names:
        files = {}
        for cmd in JOBS[name]:
            for line in subprocess.run(cmd, cwd=ROOT, check=True, capture_output=True, text=True).stdout.splitlines():
                url, path = line.split("\t")
                files[path] = url
        lines = []
        for path, url in sorted(files.items()):
            m = HF.match(url)
            digest = lfs_sha256(*m.groups()) if m else None
            how = "lfs"
            if not digest:
                digest, how = hashlib.sha256(curl(url)).hexdigest(), "downloaded"
            print(f"  {how:10} {path}", file=sys.stderr)
            lines.append(f"{digest}  {path}")
        out = ROOT / "checksums" / f"{name}.sha256"
        out.parent.mkdir(exist_ok=True)
        out.write_text("\n".join(lines) + "\n")
        print(f"Wrote {out.relative_to(ROOT)} ({len(lines)} files)", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1:] or list(JOBS))
