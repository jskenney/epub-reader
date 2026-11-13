#!/usr/bin/env python3
"""Write the version line shown at the top of the Settings dialog in index.html: the date and time now, in UTC, as
"20261113.0416".

    python3 tools/stamp-version.py           # stamp index.html
    python3 tools/stamp-version.py --check   # print what it would write, change nothing

Run it before committing a change to index.html (.githooks/pre-commit does). A line in the earlier form, with a
release number before the date ("v0.60.1 - 20261111.1430"), is written in the new form.
"""
import datetime
import re
import sys
from pathlib import Path

PAGE = Path(__file__).resolve().parent.parent / "index.html"
LINE = re.compile(r'(<span id="setVer">)(?:v\d+\.\d+\.\d+ - )?\d{8}\.\d{4}(</span>)')


def main():
    # (Line endings kept as they are: round 25 review, M-121.)
    with open(PAGE, encoding="utf-8", newline="") as f:
        text = f.read()
    if not LINE.search(text):
        sys.exit('index.html has no version line (<span id="setVer">YYYYMMDD.HHMM</span>)')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d.%H%M")
    if "--check" in sys.argv:
        print(stamp)
        return
    with open(PAGE, "w", encoding="utf-8", newline="") as f:
        f.write(LINE.sub(lambda x: x.group(1) + stamp + x.group(2), text, count=1))
    print(f"index.html: Version {stamp}")


if __name__ == "__main__":
    main()
