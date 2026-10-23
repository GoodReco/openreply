#!/usr/bin/env python3
"""Save a Resend setup key locally without displaying it."""
import getpass
import os
from pathlib import Path


def main():
    key = getpass.getpass("Resend API key (hidden): ").strip()
    if not key.startswith("re_") or len(key) < 15 or any(c.isspace() for c in key):
        raise SystemExit("That does not look like a Resend API key. Nothing saved.")
    path = Path(__file__).resolve().parents[1] / ".env.email"
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as out:
        out.write("RESEND_API_KEY=" + key + "\n")
    print("Saved email credentials locally. The key was not displayed.")


if __name__ == "__main__":
    main()
