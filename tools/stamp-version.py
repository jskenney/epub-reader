#!/usr/bin/env python3
"""Write the version line shown at the top of the Settings dialog in index.html: one patch release above the
latest release tag (v0.60.0 gives v0.60.1) and the date and time now, in UTC, as "v0.60.1 - 20261111.1430".

    python3 tools/stamp-version.py           # stamp index.html
    python3 tools/stamp-version.py --check   # print what it would write, change nothing

Run it before committing a change to index.html. Without any v* tag (a clone without tags), the version is
left as it is and only the time changes.
"""
import datetime
import re
import subprocess
import sys
from pathlib import Path

PAGE = Path(__file__).resolve().parent.parent / "index.html"
LINE = re.compile(r'(<span id="setVer">)(v\d+\.\d+\.\d+)( - )\d{8}\.\d{4}(</span>)')


def latest_tag():
    try:
        out = subprocess.run(["git", "-C", str(PAGE.parent), "tag", "--list", "v*", "--sort=-v:refname"],
                             capture_output=True, text=True, check=True).stdout.split()
    except (OSError, subprocess.CalledProcessError):
        return None
    return next((t for t in out if re.fullmatch(r"v\d+\.\d+\.\d+", t)), None)


def main():
    # (Line endings kept as they are: round 25 review, M-121.)
    with open(PAGE, encoding="utf-8", newline="") as f:
        text = f.read()
    m = LINE.search(text)
    if not m:
        sys.exit('index.html has no version line (<span id="setVer">vX.Y.Z - YYYYMMDD.HHMM</span>)')
    tag = latest_tag()
    if tag:
        major, minor, patch = map(int, tag[1:].split("."))
        version = f"v{major}.{minor}.{patch + 1}"
    else:
        version = m.group(2)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d.%H%M")
    if "--check" in sys.argv:
        print(f"{version} - {stamp}")
        return
    with open(PAGE, "w", encoding="utf-8", newline="") as f:
        f.write(LINE.sub(lambda x: x.group(1) + version + x.group(3) + stamp + x.group(4), text, count=1))
    print(f"index.html: Version {version} - {stamp}")


if __name__ == "__main__":
    main()
