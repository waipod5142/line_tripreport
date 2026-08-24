#!/usr/bin/env python3
"""Summarise a LINE message archive CSV exported from /messages/export.

Usage:
    python3 scripts/summarize_messages.py <file.csv> [more.csv ...]
    python3 scripts/summarize_messages.py <file.csv> --json

Standard library only — no pip install required.

The export is UTF-8 *with a BOM* (Excel needs the BOM to read Thai correctly).
Always open it as "utf-8-sig": plain "utf-8" leaves a stray ﻿ glued to the
first header, and latin-1 turns every Thai name into mojibake like "à¸à¸¡à¸ª".
"""

import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime

# Matches lib/utils.ts formatDateTime(): en-GB, 2-digit day, short month,
# 24-hour clock, already converted to Asia/Bangkok by the exporter.
STAMP = "%d %b %Y, %H:%M"


def read_rows(paths):
    rows = []
    for path in paths:
        with open(path, encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                row["_dt"] = parse_stamp(row.get("Sent at (Asia/Bangkok)", ""))
                rows.append(row)
    return rows


def parse_stamp(value):
    try:
        return datetime.strptime(value.strip(), STAMP)
    except ValueError:
        return None


def bar(n, peak, width=28):
    return "█" * max(1, round(n / peak * width)) if n else ""


def summarise(rows):
    dated = [r for r in rows if r["_dt"]]
    senders = Counter(r["Sender"] for r in rows)
    types = Counter(r["Type"] for r in rows)
    groups = Counter(r["Group"] for r in rows)
    by_day = Counter(r["_dt"].strftime("%Y-%m-%d") for r in dated)
    by_hour = Counter(r["_dt"].hour for r in dated)
    attachments = sum(
        len([p for p in r["Attachments"].split(" | ") if p]) for r in rows
    )
    texts = [r["Text"] for r in rows if r["Text"].strip()]
    return {
        "messages": len(rows),
        "groups": groups,
        "senders": senders,
        "types": types,
        "by_day": by_day,
        "by_hour": by_hour,
        "attachments": attachments,
        "texts": texts,
        "first": min((r["_dt"] for r in dated), default=None),
        "last": max((r["_dt"] for r in dated), default=None),
        "undated": len(rows) - len(dated),
    }


def report(s):
    out = []
    w = out.append

    w("═" * 60)
    for name, n in s["groups"].most_common():
        w(f"  {name}")
    w("═" * 60)

    span = ""
    if s["first"] and s["last"]:
        days = (s["last"].date() - s["first"].date()).days + 1
        span = (
            f'{s["first"]:%d %b %Y %H:%M} → {s["last"]:%d %b %Y %H:%M}'
            f"  ({days} day{'s' if days != 1 else ''})"
        )
    w(f'  {s["messages"]} messages · {len(s["senders"])} senders '
      f'· {s["attachments"]} attachments')
    if span:
        w(f"  {span}")
    if s["undated"]:
        w(f'  ⚠ {s["undated"]} row(s) had an unparseable timestamp')
    w("")

    w("BY TYPE")
    peak = max(s["types"].values(), default=1)
    for t, n in s["types"].most_common():
        w(f"  {t:<10} {n:>5}  {bar(n, peak)}")
    w("")

    w("BY SENDER")
    peak = max(s["senders"].values(), default=1)
    for who, n in s["senders"].most_common():
        pct = n / s["messages"] * 100
        w(f"  {who[:28]:<28} {n:>5}  {pct:>4.0f}%  {bar(n, peak, 18)}")
    w("")

    w("BY DAY")
    peak = max(s["by_day"].values(), default=1)
    for day in sorted(s["by_day"]):
        n = s["by_day"][day]
        label = datetime.strptime(day, "%Y-%m-%d").strftime("%a %d %b")
        w(f"  {label:<12} {n:>5}  {bar(n, peak)}")
    w("")

    if s["by_hour"]:
        w("BY HOUR (Asia/Bangkok)")
        peak = max(s["by_hour"].values())
        lo, hi = min(s["by_hour"]), max(s["by_hour"])
        for h in range(lo, hi + 1):
            n = s["by_hour"].get(h, 0)
            w(f"  {h:02d}:00 {n:>5}  {bar(n, peak, 24)}")
        w("")

    if s["texts"]:
        w(f'TEXT MESSAGES ({len(s["texts"])})')
        for t in s["texts"][:15]:
            w(f"  · {t[:70]}")
        if len(s["texts"]) > 15:
            w(f'  … {len(s["texts"]) - 15} more')
    return "\n".join(out)


def main():
    args = [a for a in sys.argv[1:]]
    as_json = "--json" in args
    paths = [a for a in args if not a.startswith("--")]
    if not paths:
        sys.exit(__doc__)

    rows = read_rows(paths)
    if not rows:
        sys.exit("No rows found — is that an export from /messages/export?")

    s = summarise(rows)
    if as_json:
        print(json.dumps({
            "messages": s["messages"],
            "attachments": s["attachments"],
            "first": s["first"].isoformat() if s["first"] else None,
            "last": s["last"].isoformat() if s["last"] else None,
            "groups": dict(s["groups"]),
            "senders": dict(s["senders"].most_common()),
            "types": dict(s["types"]),
            "by_day": dict(sorted(s["by_day"].items())),
            "by_hour": {str(k): v for k, v in sorted(s["by_hour"].items())},
        }, ensure_ascii=False, indent=2))
    else:
        print(report(s))


if __name__ == "__main__":
    main()
