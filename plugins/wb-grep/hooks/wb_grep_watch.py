#!/usr/bin/env python3
"""Start wb-grep watch process on Droid session start."""

import os
import sys
import json
import subprocess
from datetime import datetime
from pathlib import Path

DEBUG_LOG_FILE = Path(os.environ.get("WB_GREP_WATCH_LOG", "/tmp/wb-grep-watch.log"))


def debug_log(message: str) -> None:
    """Log debug messages to file."""
    try:
        DEBUG_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(DEBUG_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{stamp}] {message}\n")
    except Exception:
        pass


def read_hook_input() -> dict | None:
    """Read hook input from stdin."""
    raw = sys.stdin.read()
    if not raw.strip():
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        debug_log(f"Failed to decode JSON: {e}")
        return None


def main():
    """Start wb-grep watch process."""
    payload = read_hook_input()
    if not payload:
        debug_log("No hook input received")
        sys.exit(0)

    session_id = payload.get("session_id", "unknown")
    cwd = payload.get("cwd", os.getcwd())
    
    pid_file = f"/tmp/wb-grep-watch-pid-{session_id}.txt"
    log_file = f"/tmp/wb-grep-watch-{session_id}.log"

    # Check if already running
    if os.path.exists(pid_file):
        debug_log(f"Watch process already running for session {session_id}")
        # Still report success
        context = f"wb-grep watch already running for this session (PID file: {pid_file})"
        output = {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": context,
            }
        }
        print(json.dumps(output))
        sys.exit(0)

    try:
        # Start wb-grep watch in background
        process = subprocess.Popen(
            ["wb-grep", "watch"],
            cwd=cwd,
            stdout=open(log_file, "w"),
            stderr=subprocess.STDOUT,
            preexec_fn=os.setsid if hasattr(os, 'setsid') else None,
        )
        
        debug_log(f"Started wb-grep watch process (PID: {process.pid}) for session {session_id}")
        
        # Save PID for cleanup
        with open(pid_file, "w") as f:
            f.write(str(process.pid))
        
        context = f"wb-grep watch started (PID: {process.pid}). Index updates will happen automatically."
        output = {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": context,
            }
        }
        print(json.dumps(output))
        sys.exit(0)
        
    except Exception as e:
        error_msg = f"Failed to start wb-grep watch: {e}"
        debug_log(error_msg)
        # Don't block session start if watch fails
        print(f"Warning: {error_msg}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
