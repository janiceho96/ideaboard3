#!/bin/bash

# Change to the folder this script lives in (works wherever you put it)
cd "$(dirname "$0")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="$HOME/Applications/Ideaboard.app"

# ── Create a proper macOS .app shortcut ──────────────────────────────────────
create_app_shortcut() {
  mkdir -p "$HOME/Applications"
  mkdir -p "$APP_PATH/Contents/MacOS"

  # App metadata
  cat > "$APP_PATH/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Ideaboard</string>
  <key>CFBundleIdentifier</key>
  <string>com.ideaboard.app</string>
  <key>CFBundleName</key>
  <string>Ideaboard</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

  # Launcher executable — embeds the project path so the .app always finds it
  cat > "$APP_PATH/Contents/MacOS/Ideaboard" << LAUNCHER
#!/bin/bash
open "$SCRIPT_DIR/launch-ideaboard.command"
LAUNCHER

  chmod +x "$APP_PATH/Contents/MacOS/Ideaboard"

  echo ""
  echo " ✓ Ideaboard.app created in ~/Applications"
  echo ""
  echo " To add to your Dock:"
  echo "   1. Open Finder"
  echo "   2. Press Cmd+Shift+H (go to your home folder)"
  echo "   3. Open the Applications folder"
  echo "   4. Drag Ideaboard to the right side of your Dock"
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
clear
echo ""
echo " ============================="
echo "   Ideaboard - Starting up..."
echo " ============================="
echo ""

# Offer to install as an app the first time
if [ ! -d "$APP_PATH" ]; then
  echo " Tip: Add Ideaboard to your Dock as a proper app."
  read -p " Create app shortcut now? [y/N] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    create_app_shortcut
  else
    echo ""
  fi
fi

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

# Open browser after Vite has had time to start (default port 5173)
(sleep 4 && open http://localhost:5173) &

npm run dev
