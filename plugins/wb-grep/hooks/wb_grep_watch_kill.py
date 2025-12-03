#!/usr/bin/env python3
"""Kill wb-grep watch process on Droid session end."""

import os
import sys
import json
import signal
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


def kill_process_tree(pid: int, sig: signal.Signals = signal.SIGTERM) -> bool:
    """Kill process and its children (if on Unix)."""
    try:
        if hasattr(os, 'killpg'):
            # Unix: kill process group
            os.killpg(os.getpgid(pid), sig)
            debug_log(f"Sent signal {sig} to process group of PID {pid}")
        else:
            # Windows: kill single process
            os.kill(pid, sig)
            debug_log(f"Sent signal {sig} to PID {pid}")
        return True
    except ProcessLookupError:
        debug_log(f"Process {pid} not found (already terminated)")
        return True
    except Exception as e:
        debug_log(f"Error killing process {pid}: {e}")
        return False


def main():
    """Kill wb-grep watch process."""
    payload = read_hook_input()
    if not payload:
        debug_log("No hook input received")
        sys.exit(0)

    session_id = payload.get("session_id", "unknown")
    pid_file = f"/tmp/wb-grep-watch-pid-{session_id}.txt"
    log_file = f"/tmp/wb-grep-watch-{session_id}.log"

    try:
        # Read and kill process
        if os.path.exists(pid_file):
            with open(pid_file, "r") as f:
                pid_str = f.read().strip()
            
            try:
                pid = int(pid_str)
                debug_log(f"Killing wb-grep watch process (PID: {pid}) for session {session_id}")
                
                # Try graceful shutdown first
                if kill_process_tree(pid, signal.SIGTERM):
                    debug_log(f"Successfully terminated PID {pid}")
                
                # Clean up PID file
                os.remove(pid_file)
                debug_log(f"Removed PID file: {pid_file}")
                
            except ValueError:
                debug_log(f"Invalid PID in file: {pid_str}")
        else:
            debug_log(f"No PID file found for session {session_id}")

        # Clean up log file if it exists
        if os.path.exists(log_file):
            try:
                os.remove(log_file)
                debug_log(f"Cleaned up log file: {log_file}")
            except Exception as e:
                debug_log(f"Could not remove log file: {e}")

        sys.exit(0)

    except Exception as e:
        error_msg = f"Error during cleanup: {e}"
        debug_log(error_msg)
        # Don't block session end
        print(f"Warning: {error_msg}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
