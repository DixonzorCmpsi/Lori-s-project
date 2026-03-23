"""
Spec Optimizer — Two-Stage Pipeline

Stage 1 (Pure Logic):
    Fast loop. Coder generates a single implementation.py with pure functions.
    Tests validate business logic (schedule gen, permissions, age gate, etc.).
    Runs until 100% or max-iters.

Stage 2 (Multi-File):
    Slow loop. Coder generates a full FastAPI project structure across multiple files.
    Tests validate API endpoints, middleware, auth flows, RBAC, etc.
    Requires agentic mode (file writes).
    Runs against the real test suite.

Usage:
    # Stage 1 only (fast, pure logic)
    python optimizer.py --spec-dir your_specs --test-dir your_test_suite \\
        --test-cmd "python3 -m pytest test_spec_validation.py -v" --model opencode

    # Stage 2 only (multi-file FastAPI)
    python optimizer.py --spec-dir your_specs --test-dir your_test_suite \\
        --test-cmd "python3 -m pytest -v" --model opencode --stage 2

    # Both stages (Stage 1 first, then Stage 2)
    python optimizer.py --spec-dir your_specs --test-dir your_test_suite \\
        --test-cmd "python3 -m pytest test_spec_validation.py -v" --model opencode --stage both \\
        --stage2-test-dir ../backend/tests --stage2-test-cmd "python3 -m pytest -v"
"""

import argparse
import os
import shutil
import json
from llm_client import run_coder_agent, run_multifile_coder_agent, run_researcher_agent, run_multifile_researcher_agent
from evaluator import evaluate_tests


def read_specs(spec_dir):
    """Read all .md specs from directory, return dict of filename -> content."""
    specs = {}
    for root, _, files in os.walk(spec_dir):
        for filename in sorted(files):
            if filename.endswith(".md"):
                path = os.path.join(root, filename)
                with open(path, "r") as f:
                    specs[filename] = f.read()
    return specs


def read_tests(test_dir):
    """Read all test files, return dict of filename -> content."""
    tests = {}
    for root, _, files in os.walk(test_dir):
        for filename in sorted(files):
            if filename.endswith(".py") and filename.startswith("test_"):
                path = os.path.join(root, filename)
                with open(path, "r") as f:
                    tests[filename] = f.read()
    return tests


def run_stage1(args, specs_contents):
    """Stage 1: Single-file pure logic optimization."""
    print("\n" + "=" * 60)
    print("STAGE 1: Pure Logic Validation")
    print("=" * 60)

    spec_text = "\n\n".join([f"### {k}\n{v}" for k, v in specs_contents.items()])

    for i in range(args.max_iters):
        print(f"\n--- Stage 1 · Iteration {i+1}/{args.max_iters} ---")

        # 1. Coder generates single implementation.py
        print("Generating implementation.py from specs...")
        generated_code = run_coder_agent(spec_text, args.model, agentic=False)

        main_code_path = os.path.join(args.test_dir, "implementation.py")
        with open(main_code_path, "w") as f:
            f.write(generated_code)

        # 2. Run pure logic tests
        print(f"Running tests: {args.test_cmd}")
        success, logs = evaluate_tests(args.test_dir, args.test_cmd)

        if success:
            print(f"\n✓ STAGE 1 PASSED — Pure logic specs are correct.")
            return True

        print("Tests failed. Researcher is optimizing specs...")

        # 3. Researcher rewrites specs — to a separate file, never overwrites originals
        new_specs = run_researcher_agent(spec_text, generated_code, logs, args.model, agentic=False)

        optimized_path = os.path.join(args.spec_dir, "_optimized_spec.md")
        with open(optimized_path, "w") as f:
            f.write(new_specs)

        # Reload specs (includes the new optimized file)
        specs_contents = read_specs(args.spec_dir)
        spec_text = "\n\n".join([f"### {k}\n{v}" for k, v in specs_contents.items()])

    print(f"\n✗ Stage 1 reached max iterations ({args.max_iters}) without 100% pass.")
    return False


def run_stage2(args, specs_contents):
    """Stage 2: Multi-file FastAPI project generation and testing."""
    print("\n" + "=" * 60)
    print("STAGE 2: Multi-File Project Validation")
    print("=" * 60)

    test_dir = args.stage2_test_dir or args.test_dir
    test_cmd = args.stage2_test_cmd or args.test_cmd
    output_dir = args.stage2_output_dir or os.path.join(os.path.dirname(args.test_dir), "generated_app")

    # Read the test files so the coder can see what it needs to satisfy
    test_contents = read_tests(test_dir)
    test_text = "\n\n".join([f"### {k}\n```python\n{v}\n```" for k, v in test_contents.items()])

    spec_text = "\n\n".join([f"### {k}\n{v}" for k, v in specs_contents.items()])

    for i in range(args.max_iters):
        print(f"\n--- Stage 2 · Iteration {i+1}/{args.max_iters} ---")

        # 1. Coder generates multi-file project
        print(f"Generating multi-file project into {output_dir}...")
        os.makedirs(output_dir, exist_ok=True)

        file_map = run_multifile_coder_agent(
            spec_text, test_text, output_dir, args.model, agentic=args.agentic
        )

        # Write all generated files
        files_written = 0
        for filepath, content in file_map.items():
            full_path = os.path.join(output_dir, filepath)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w") as f:
                f.write(content)
            files_written += 1
        print(f"  Wrote {files_written} files.")

        # 2. Run the full test suite
        print(f"Running tests: {test_cmd}")
        success, logs = evaluate_tests(test_dir, test_cmd, timeout=300)

        # Parse pass/fail counts from pytest output
        pass_count, fail_count = parse_pytest_results(logs)
        print(f"  Results: {pass_count} passed, {fail_count} failed")

        if success:
            print(f"\n✓ STAGE 2 PASSED — Full project generation validated!")
            return True

        print("Tests failed. Researcher is analyzing failures...")

        # 3. Multi-file researcher — analyzes which files need spec fixes
        new_specs = run_multifile_researcher_agent(
            spec_text, file_map, logs, args.model, agentic=args.agentic
        )

        # Write updated spec — never overwrite originals
        optimized_path = os.path.join(args.spec_dir, "_optimized_spec.md")
        with open(optimized_path, "w") as f:
            f.write(new_specs)

        specs_contents = read_specs(args.spec_dir)
        spec_text = "\n\n".join([f"### {k}\n{v}" for k, v in specs_contents.items()])

    print(f"\n✗ Stage 2 reached max iterations ({args.max_iters}) without 100% pass.")
    return False


def parse_pytest_results(logs):
    """Extract pass/fail counts from pytest output."""
    import re
    # Look for "X passed, Y failed" or "X passed"
    match = re.search(r"(\d+) passed", logs)
    passed = int(match.group(1)) if match else 0
    match = re.search(r"(\d+) failed", logs)
    failed = int(match.group(1)) if match else 0
    return passed, failed


def main():
    parser = argparse.ArgumentParser(
        description="Spec Optimizer — Two-Stage Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--spec-dir", required=True, help="Path to specification directory")
    parser.add_argument("--test-dir", required=True, help="Path to test directory (Stage 1)")
    parser.add_argument("--test-cmd", required=True, help="Test command for Stage 1")
    parser.add_argument("--model", default="opencode", help="Model: opencode, claude, or litellm string")
    parser.add_argument("--max-iters", type=int, default=10, help="Max iterations per stage")
    parser.add_argument("--agentic", action="store_true", default=False, help="Allow agentic mode (file writes)")
    parser.add_argument(
        "--stage", default="1", choices=["1", "2", "both"],
        help="Which stage to run: 1 (pure logic), 2 (multi-file), both"
    )
    parser.add_argument("--stage2-test-dir", help="Test directory for Stage 2 (defaults to --test-dir)")
    parser.add_argument("--stage2-test-cmd", help="Test command for Stage 2 (defaults to --test-cmd)")
    parser.add_argument("--stage2-output-dir", help="Where Stage 2 writes generated code")

    args = parser.parse_args()

    print(f"Spec Optimizer — Model: {args.model.upper()} — Stage: {args.stage}")

    # Backup
    backup_dir = args.spec_dir + ".backup"
    if not os.path.exists(backup_dir) and os.path.exists(args.spec_dir):
        shutil.copytree(args.spec_dir, backup_dir)
        print(f"Backed up original specs to {backup_dir}")

    specs_contents = read_specs(args.spec_dir)

    if args.stage in ("1", "both"):
        stage1_passed = run_stage1(args, specs_contents)
        if args.stage == "1":
            return
        if not stage1_passed:
            print("\nStage 1 did not pass — skipping Stage 2.")
            return
        # Reload specs (may have been modified by Stage 1)
        specs_contents = read_specs(args.spec_dir)

    if args.stage in ("2", "both"):
        run_stage2(args, specs_contents)


if __name__ == "__main__":
    main()
