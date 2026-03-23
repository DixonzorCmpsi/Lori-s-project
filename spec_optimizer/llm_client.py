import os
import json
import re
import subprocess

try:
    import litellm
except ImportError:
    litellm = None

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_prompt(filename):
    """Load a system prompt from a markdown file in the spec_optimizer directory."""
    path = os.path.join(SCRIPT_DIR, filename)
    with open(path, "r") as f:
        return f.read()


# ---------------------------------------------------------------------------
# LLM routing
# ---------------------------------------------------------------------------

def call_claude(system_prompt, user_prompt):
    if not litellm:
        raise ImportError("litellm is not installed. Please install it to use Claude.")
    response = litellm.completion(
        model="anthropic/claude-3-5-sonnet-20241022",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content


def call_opencode(system_prompt, user_prompt, agentic=False, timeout=180):
    import tempfile

    mode_label = "AGENTIC (tools enabled)" if agentic else "TEXT-ONLY (no tools)"
    print(f"[OpenCode API] Mode: {mode_label}")
    if agentic:
        combined = (
            f"{system_prompt}\n\n"
            "You have FULL access to tools: file writes, shell commands, web fetch, etc. "
            "Use them as needed to complete the task.\n\n"
            f"{user_prompt}"
        )
    else:
        combined = (
            f"{system_prompt}\n\n"
            "IMPORTANT: Do NOT use any tools, file writers, or actions. Only output raw text.\n\n"
            f"{user_prompt}"
        )

    # Write prompt to temp file to avoid CLI argument length limits
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as tmp:
        tmp.write(combined)
        tmp_path = tmp.name

    try:
        # Use shell to pipe the file content into opencode
        result = subprocess.run(
            f'cat "{tmp_path}" | opencode run -',
            capture_output=True,
            text=True,
            timeout=timeout,
            check=True,
            shell=True,
        )
        lines = result.stdout.strip().split("\n")
        cleaned: list[str] = []
        skip_header = True
        for line in lines:
            if skip_header and (line.startswith(">") or line.strip() == ""):
                continue
            skip_header = False
            cleaned.append(line)
        return "\n".join(cleaned)
    except subprocess.CalledProcessError as e:
        stderr_preview = (e.stderr or "")[:500]
        print(f"Error calling opencode CLI: {stderr_preview}")
        # Fallback: try passing the temp file path as argument
        try:
            with open(tmp_path, "r") as f:
                prompt_text = f.read()
            # Truncate to ~100k chars if too large for CLI arg
            if len(prompt_text) > 100000:
                prompt_text = prompt_text[:100000] + "\n\n[TRUNCATED — prompt too large]"
            result = subprocess.run(
                ["opencode", "run", prompt_text],
                capture_output=True,
                text=True,
                timeout=timeout,
                check=True,
            )
            lines = result.stdout.strip().split("\n")
            cleaned = []
            skip_header = True
            for line in lines:
                if skip_header and (line.startswith(">") or line.strip() == ""):
                    continue
                skip_header = False
                cleaned.append(line)
            return "\n".join(cleaned)
        except Exception:
            return "def example():\n    pass # OpenCode execution failed"
    except Exception as e:
        print(f"Error calling opencode: {e}")
        return "def example():\n    pass # OpenCode execution failed"
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def route_llm(model, system_prompt, user_prompt, agentic=False, timeout=180):
    if model.lower() == "claude":
        return call_claude(system_prompt, user_prompt)
    elif model.lower() == "opencode":
        return call_opencode(system_prompt, user_prompt, agentic=agentic, timeout=timeout)
    else:
        print(f"[{model}] Passing to litellm directly...")
        if litellm is None:
            raise ImportError("litellm is not installed.")
        response = litellm.completion(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content


# ---------------------------------------------------------------------------
# Stage 1 — Single-file agents
# ---------------------------------------------------------------------------

def run_coder_agent(specs, model, agentic=False):
    """Generate a single implementation.py from specs."""
    sys_prompt = _load_prompt("coder.md")
    user_prompt = f"SPECIFICATION:\n{specs}\n\nWrite the implementation code now."
    code = route_llm(model, sys_prompt, user_prompt, agentic=agentic)
    if code.startswith("```"):
        lines = code.split("\n")
        code = "\n".join(lines[1 : len(lines) - 1])
    return code


def run_researcher_agent(specs, code, test_logs, model, agentic=False):
    """Analyze failures and rewrite specs for Stage 1."""
    sys_prompt = _load_prompt("researcher.md")
    user_prompt = (
        f"ORIGINAL SPECS:\n{specs}\n\n"
        f"GENERATED CODE:\n{code}\n\n"
        f"TEST LOGS/ERRORS:\n{test_logs}\n\n"
        "Output the new, improved Markdown Specification."
    )
    return route_llm(model, sys_prompt, user_prompt, agentic=agentic)


# ---------------------------------------------------------------------------
# Stage 2 — Multi-file agents
# ---------------------------------------------------------------------------

def _extract_file_map(raw_output):
    """
    Parse the coder's output into a dict of {filepath: content}.

    Expected format from the coder:
        === FILE: app/main.py ===
        <code>
        === FILE: app/models.py ===
        <code>
        ...

    Falls back to trying JSON if the marker format isn't found.
    """
    file_map = {}

    # Try marker-delimited format: split on === FILE: ... === lines
    marker_pattern = re.compile(r"^===\s*FILE:\s*(.+?)\s*===$", re.MULTILINE)
    markers = list(marker_pattern.finditer(raw_output))
    if markers:
        for idx, match in enumerate(markers):
            filepath = match.group(1).strip()
            start = match.end()
            end = markers[idx + 1].start() if idx + 1 < len(markers) else len(raw_output)
            content = raw_output[start:end].strip()
            # Strip markdown code fences if wrapping the content
            if content.startswith("```"):
                lines = content.split("\n")
                content = "\n".join(lines[1:])
            if content.endswith("```"):
                content = content[: content.rfind("```")].rstrip()
            file_map[filepath] = content
        return file_map

    # Try JSON format: {"files": {"path": "content", ...}}
    try:
        data = json.loads(raw_output)
        if isinstance(data, dict) and "files" in data:
            return data["files"]
        if isinstance(data, dict):
            return data
    except (json.JSONDecodeError, TypeError):
        pass

    # Fallback: treat entire output as a single app/main.py
    file_map["app/main.py"] = raw_output
    return file_map


def run_multifile_coder_agent(specs, tests, output_dir, model, agentic=False):
    """
    Generate a multi-file FastAPI project from specs.
    Returns a dict of {filepath: content}.
    """
    sys_prompt = _load_prompt("coder_multifile.md")
    user_prompt = (
        f"SPECIFICATIONS:\n{specs}\n\n"
        f"TEST SUITE (your code must make these pass):\n{tests}\n\n"
        f"OUTPUT DIRECTORY: {output_dir}\n\n"
        "Generate all files now."
    )
    raw = route_llm(model, sys_prompt, user_prompt, agentic=agentic, timeout=300)
    return _extract_file_map(raw)


def run_multifile_researcher_agent(specs, file_map, test_logs, model, agentic=False):
    """
    Analyze multi-file test failures and rewrite specs.
    """
    sys_prompt = _load_prompt("researcher_multifile.md")

    # Summarize generated files (paths + first 50 lines each)
    files_summary = ""
    for path, content in file_map.items():
        lines = content.split("\n")[:50]
        preview = "\n".join(lines)
        files_summary += f"\n### {path}\n```python\n{preview}\n```\n"

    user_prompt = (
        f"ORIGINAL SPECS:\n{specs}\n\n"
        f"GENERATED FILES (preview):\n{files_summary}\n\n"
        f"TEST LOGS/ERRORS:\n{test_logs}\n\n"
        "Output the new, improved Markdown Specification."
    )
    return route_llm(model, sys_prompt, user_prompt, agentic=agentic, timeout=300)
