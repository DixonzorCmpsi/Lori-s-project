# Spec Autoresearch — Program Instructions

This is the equivalent of Karpathy's `program.md`. It instructs an AI agent to autonomously optimize specs.

## Setup

```bash
cd /Users/dixon.zor/Documents/Lori-s-project
node tools/spec-eval.mjs > results-baseline.tsv 2> results-baseline.log
```

## Files

- `tools/spec-eval.mjs` — **READ-ONLY.** The evaluation harness. Do NOT modify.
- `spec/SPEC-001-*.md` through `spec/SPEC-010-*.md` — **EDITABLE.** The specs you optimize.
- `results.tsv` — **APPEND-ONLY.** Log each experiment result here.

## Objective

**Achieve the lowest total composite score across all 10 specs.** Lower is better (like val_bpb).

The composite score penalizes:
- Weasel words (should, could, may, might, etc.) — 8 points each
- Ambiguity patterns (X or Y, vague plurals, examples instead of lists) — 5 points each
- Missing schemas (tables mentioned but not defined) — 15 points each
- Uncovered MUST statements (no nearby test ID) — 2 points each

And rewards:
- Constraint density (MUST/MUST NOT per line) — up to -200 points
- Error coverage (HTTP codes per behavioral statement) — up to -80 points

## Constraints

- Do NOT modify `tools/spec-eval.mjs`
- Do NOT modify the Goals, Non-Goals, Success Metric, or Immutable Constraints sections of any spec
- Do NOT modify SQL CREATE TABLE blocks
- Do NOT modify test scenario tables
- Do NOT change the meaning of any behavioral requirement — only tighten the language
- Do NOT add new features or requirements — only make existing ones more precise
- Every MUST statement should be verifiable by a test

## Experiment Loop

```
1. Run baseline: node tools/spec-eval.mjs 2>/dev/null
2. Pick the spec with the highest (worst) composite score
3. Read that spec, identify the highest-scoring problem (weasel words, ambiguities, missing error codes)
4. Make ONE targeted edit to fix that problem
5. Run eval: node tools/spec-eval.mjs 2>/dev/null
6. If total composite improved (lower): KEEP the edit
   If total composite stayed same or got worse: REVERT the edit
7. Log result to results.tsv
8. Repeat from step 2
```

## Results Format (results.tsv)

```
iteration	spec_changed	composite_before	composite_after	delta	status	description
1	SPEC-006	45.2	38.1	-7.1	keep	Replaced "should validate" with "MUST validate, returns 400"
2	SPEC-001	22.3	22.3	0.0	discard	Tried removing "for example" but it was in a locked section
```
