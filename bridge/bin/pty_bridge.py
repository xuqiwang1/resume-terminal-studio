#!/usr/bin/env python3

import os
import pty
import select
import signal
import sys


def main() -> int:
    cwd = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    master_fd, slave_fd = pty.openpty()
    pid = os.fork()

    if pid == 0:
      os.setsid()
      os.close(master_fd)
      os.dup2(slave_fd, 0)
      os.dup2(slave_fd, 1)
      os.dup2(slave_fd, 2)
      if slave_fd > 2:
          os.close(slave_fd)
      os.chdir(cwd)
      env = os.environ.copy()
      env["TERM"] = "dumb"
      env["PS1"] = "resume-terminal $ "
      env["PATH"] = f"{cwd}:{env.get('PATH', '')}"
      os.execvpe("/bin/bash", ["/bin/bash", "--noprofile", "--norc", "-i"], env)
      return 0

    os.close(slave_fd)

    def shutdown(_signum, _frame):
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    while True:
        read_targets = [master_fd, sys.stdin.fileno()]
        readable, _, _ = select.select(read_targets, [], [])

        if master_fd in readable:
            try:
                data = os.read(master_fd, 4096)
            except OSError:
                break
            if not data:
                break
            os.write(sys.stdout.fileno(), data)

        if sys.stdin.fileno() in readable:
            try:
                incoming = os.read(sys.stdin.fileno(), 4096)
            except OSError:
                incoming = b""
            if incoming:
                os.write(master_fd, incoming)

    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
