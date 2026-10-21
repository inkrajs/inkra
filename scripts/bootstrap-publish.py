"""Keep npm's official web-2FA flow alive while Actions exposes its approval URL."""

import json
import os
from pathlib import Path
import pty
import re
import select
import signal
import subprocess
import sys
import time


AUTH_URL = re.compile(r"https://www\.npmjs\.com/auth/cli/[A-Za-z0-9_-]+")


def worker(directory, source, command=None):
    master, slave = pty.openpty()
    child = subprocess.Popen(
        command or ["node", str(Path(__file__).with_suffix(".mjs").resolve()), str(source)], cwd=source,
        stdin=slave, stdout=slave, stderr=slave, start_new_session=True,
    )
    os.close(slave)
    deadline = time.monotonic() + 600
    transcript = ""
    try:
        while True:
            if time.monotonic() > deadline:
                os.killpg(child.pid, signal.SIGKILL)
                transcript += "\nTimed out waiting for npm authorization.\n"
                break
            if select.select([master], [], [], 0.2)[0]:
                try:
                    chunk = os.read(master, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                transcript += chunk.decode("utf-8", errors="replace")
                match = AUTH_URL.search(transcript)
                if match:
                    (directory / "approval.txt").write_text(match.group(0) + "\n")
            elif child.poll() is not None:
                break
    finally:
        os.close(master)
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGKILL)
        code = child.wait()
        token = os.environ.get("NODE_AUTH_TOKEN")
        if token:
            transcript = transcript.replace(token, "[REDACTED]")
        (directory / "output.txt").write_text(transcript)
        temporary = directory / "result.tmp"
        temporary.write_text(json.dumps({"code": code}))
        temporary.replace(directory / "result.json")


def wait_for_result(directory, ready=False):
    deadline = time.monotonic() + (90 if ready else 620)
    while time.monotonic() < deadline:
        result = directory / "result.json"
        if result.exists():
            print((directory / "output.txt").read_text())
            return 0 if json.loads(result.read_text())["code"] == 0 else 1
        if ready and (directory / "approval.txt").exists():
            print("npm requires browser 2FA. See the npm-approval artifact.")
            return 0
        time.sleep(1)
    print("npm bootstrap did not finish within the allowed time.")
    return 1


def main():
    mode, destination, source = sys.argv[1:]
    directory = Path(destination).resolve()
    if mode == "worker":
        worker(directory, source)
        return 0
    if mode == "start":
        directory.mkdir(mode=0o700, parents=True, exist_ok=False)
        subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "worker", str(directory), source],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, start_new_session=True,
        )
        return wait_for_result(directory, ready=True)
    if mode == "wait":
        return wait_for_result(directory)
    raise ValueError("Expected start, worker or wait")


if __name__ == "__main__":
    sys.exit(main())
