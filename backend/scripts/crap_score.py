#!/usr/bin/env python3
"""CRAP(m) = complexity(m)^2 * (1 - coverage(m))^3 + complexity(m)

Ranks functions by Change Risk Anti-Pattern score (cyclomatic complexity
combined with test coverage) and fails if any function exceeds a threshold.
Run after `pytest --cov=app --cov-report=` from the backend/ directory.
"""

import argparse
import json
import os
import subprocess
import sys


def get_complexity():
    out = subprocess.run(["radon", "cc", "app", "-j"], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def get_line_coverage():
    if not os.path.exists("coverage.json"):
        subprocess.run(["coverage", "json", "-o", "coverage.json"], check=True)
    with open("coverage.json") as f:
        return json.load(f)["files"]


def func_coverage(missing: set[int], lineno: int, endline: int) -> float:
    total = endline - lineno + 1
    if total <= 0:
        return 1.0
    miss = sum(1 for line in range(lineno, endline + 1) if line in missing)
    return 1 - (miss / total)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=float(os.environ.get("CRAP_THRESHOLD", 30)))
    args = ap.parse_args()

    complexity = get_complexity()
    coverage = get_line_coverage()
    rows = []
    for path, blocks in complexity.items():
        rel = path.replace("\\", "/")
        cov_file = next(
            (v for k, v in coverage.items() if k.replace("\\", "/").endswith(rel)), None
        )
        missing = set(cov_file["missing_lines"]) if cov_file else set()
        for block in blocks:
            if block["type"] not in ("function", "method"):
                continue
            endline = block.get("endline", block["lineno"])
            cov = func_coverage(missing, block["lineno"], endline) if cov_file else 0.0
            complexity_score = block["complexity"]
            crap = complexity_score**2 * (1 - cov) ** 3 + complexity_score
            rows.append((crap, path, block["name"], complexity_score, cov))

    rows.sort(reverse=True)
    failed = [r for r in rows if r[0] > args.threshold]

    print(f"{'CRAP':>8}  {'CC':>4}  {'COV':>6}  FUNCTION")
    for crap, path, name, cc, cov in rows[:40]:
        print(f"{crap:8.1f}  {cc:4d}  {cov * 100:5.1f}%  {path}:{name}")

    if failed:
        print(
            f"\nFAIL: {len(failed)} function(s) exceed CRAP threshold {args.threshold}",
            file=sys.stderr,
        )
        sys.exit(1)
    print(f"\nOK: all functions under CRAP threshold {args.threshold}")


if __name__ == "__main__":
    main()
