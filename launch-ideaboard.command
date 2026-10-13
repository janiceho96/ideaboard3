#!/bin/bash

# Browser launcher only. The native Mac app is installed separately.
fail() {
  printf '\n ERROR: %s\n\n' "$1"
  if [[ -t 0 ]]; then
    read -r -p " Press Enter to close..."
  fi
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)" || exit 1
cd "$SCRIPT_DIR" || fail "Cannot open the Ideaboard project folder."

printf '\n =============================\n   Ideaboard - Starting up...\n =============================\n\n'

if ! command -v node >/dev/null 2>&1 || ! node --version >/dev/null 2>&1; then
  fail "Install Node.js 24 LTS from https://nodejs.org, then reopen this launcher."
fi
if ! command -v npm >/dev/null 2>&1 || ! npm --version >/dev/null 2>&1; then
  fail "npm is unavailable. Reinstall Node.js 24 LTS from https://nodejs.org, then reopen this launcher."
fi
if [[ ! -f package.json || ! -f package-lock.json ]]; then
  fail "Extract the entire Ideaboard download before opening this launcher."
fi

if [[ ! -d node_modules ]]; then
  printf ' First run - installing packages. An internet connection is required.\n\n'
  npm ci || fail "Package installation failed. Check the message above and your internet connection, then try again."
fi

printf ' The browser will open when Ideaboard is ready.\n'
printf ' Address: http://127.0.0.1:5174/ideaboard.html\n'
printf ' Keep this window open. Press Ctrl+C to stop Ideaboard.\n\n'

# A fixed host and port keep browser storage consistent between launches.
# strictPort prevents Vite from silently opening a different, empty board store.
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort --open /ideaboard.html \
  || fail "The server could not start. If port 5174 is already in use, stop the other browser launcher and try again."
