import subprocess


def evaluate_tests(test_dir, test_cmd, timeout=120):
    """
    Executes the test command inside `test_dir`.
    Returns (success_boolean, full_logs).
    """
    try:
        result = subprocess.run(
            test_cmd,
            cwd=test_dir,
            shell=True,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
        logs = f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
        success = result.returncode == 0
        return success, logs
    except subprocess.TimeoutExpired as e:
        stdout = e.stdout or ""
        stderr = e.stderr or ""
        return False, f"Tests timed out after {timeout} seconds.\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}"
    except Exception as e:
        return False, f"Failed to execute tests:\n{str(e)}"
