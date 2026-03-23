# Spec Optimizer

A two-stage pipeline that optimizes Markdown specifications against test suites using AI agents.

## How It Works

```text
STAGE 1 — Pure Logic (fast, ~30s per iteration)
    Spec (.md) → Coder generates implementation.py → pytest runs → PASS or FAIL
    If FAIL: Researcher rewrites spec → loop

STAGE 2 — Multi-File (slower, ~5min per iteration)
    Spec (.md) → Coder generates full FastAPI project (10+ files) → pytest runs → PASS or FAIL
    If FAIL: Researcher rewrites spec → loop
```

Stage 1 validates that specs are unambiguous (pure business logic).
Stage 2 validates that specs are implementable (full API with routes, middleware, auth).

## Setup

**OpenCode (recommended):** Just have `opencode` installed. No API keys needed.

**Claude:** Set `ANTHROPIC_API_KEY` and install litellm:
```bash
pip install litellm python-dotenv
```

## Usage

### Stage 1 — Pure Logic (default)

```bash
python optimizer.py \
    --spec-dir your_specs \
    --test-dir your_test_suite \
    --test-cmd "python3 -m pytest test_spec_validation.py -v" \
    --model opencode
```

### Stage 2 — Multi-File FastAPI

```bash
python optimizer.py \
    --spec-dir your_specs \
    --test-dir your_test_suite \
    --test-cmd "python3 -m pytest -v" \
    --model opencode \
    --stage 2 \
    --stage2-test-dir ../backend/tests \
    --stage2-test-cmd "python3 -m pytest -v" \
    --stage2-output-dir ../backend/app \
    --agentic
```

### Both Stages

```bash
python optimizer.py \
    --spec-dir your_specs \
    --test-dir your_test_suite \
    --test-cmd "python3 -m pytest test_spec_validation.py -v" \
    --model opencode \
    --stage both \
    --stage2-test-dir ../backend/tests \
    --stage2-test-cmd "python3 -m pytest -v" \
    --stage2-output-dir ../backend/app
```

## Flags

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `--spec-dir` | required | Path to your specification markdown files |
| `--test-dir` | required | Path to Stage 1 test suite |
| `--test-cmd` | required | Shell command for Stage 1 tests |
| `--model` | `opencode` | Model: `opencode`, `claude`, or litellm string |
| `--max-iters` | `10` | Max iterations per stage |
| `--stage` | `1` | `1`, `2`, or `both` |
| `--stage2-test-dir` | same as --test-dir | Test directory for Stage 2 |
| `--stage2-test-cmd` | same as --test-cmd | Test command for Stage 2 |
| `--stage2-output-dir` | `generated_app/` | Where Stage 2 writes generated files |
| `--agentic` | `false` | Allow OpenCode tool use (needed for Stage 2) |

## Customizing Agent Behavior

Edit these markdown files to change how the agents work:

| File | Stage | Purpose |
| ---- | ----- | ------- |
| `coder.md` | 1 | Single-file code generation |
| `researcher.md` | 1 | Single-file spec optimization |
| `coder_multifile.md` | 2 | Multi-file FastAPI project generation |
| `researcher_multifile.md` | 2 | Multi-file failure analysis + spec optimization |

## Project Structure

```text
spec_optimizer/
├── optimizer.py              # Main orchestration (two-stage pipeline)
├── llm_client.py             # Model router + file map extraction
├── evaluator.py              # Test runner
├── coder.md                  # Stage 1 coder prompt
├── researcher.md             # Stage 1 researcher prompt
├── coder_multifile.md        # Stage 2 coder prompt
├── researcher_multifile.md   # Stage 2 researcher prompt
├── your_specs/               # Drop spec markdown files here
├── your_test_suite/          # Drop test files here
└── requirements.txt
```
