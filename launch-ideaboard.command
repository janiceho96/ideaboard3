#!/bin/bash

# Change to the folder this script lives in (works wherever you put it)
cd "$(dirname "$0")"

clear
echo ""
echo " ============================="
echo "   Ideaboard - Starting up..."
echo " ============================="
echo ""

# Check Node.js is installed
if ! command -v node &> /dev/null; then
  echo " ERROR: Node.js is not installed."
  echo " Download it from https://nodejs.org"
  echo ""
  read -p " Press Enter to close..."
  exit 1
fi

# Install packages on first run
if [ ! -d "node_modules" ]; then
  echo " First run - installing packages, please wait..."
  echo ""
  npm install
  echo ""
fi

echo " Starting server... browser will open in a few seconds."
echo " Keep this window open while using Ideaboard."
echo " Press Ctrl+C to stop the app."
echo ""

# Open browser after short delay (Vite default port is 5173)
(sleep 4 && open http://localhost:5173) &

npm run dev
