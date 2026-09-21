#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_FILE="$SCRIPT_DIR/IdeaboardMac/IdeaboardMac.xcodeproj"
DERIVED_DATA="$SCRIPT_DIR/.build"
INSTALL_PATH="$HOME/Applications/Ideaboard.app"
DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

clear 2>/dev/null || true
echo ""
echo " ============================="
echo "   Installing Ideaboard for Mac"
echo " ============================="
echo ""

if [[ ! -d "$DEVELOPER_DIR" ]]; then
  echo " Xcode was not found at: $DEVELOPER_DIR"
  echo " Install Xcode from the Mac App Store, then run this installer again."
  read -r "? Press Enter to close..."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo " Node.js is not installed."
  echo " Install the Node.js LTS version from https://nodejs.org"
  read -r "? Press Enter to close..."
  exit 1
fi

echo " Building the native click-to-open app..."
DEVELOPER_DIR="$DEVELOPER_DIR" xcodebuild \
  -project "$PROJECT_FILE" \
  -scheme IdeaboardMac \
  -configuration Release \
  -derivedDataPath "$DERIVED_DATA" \
  IDEABOARD_PROJECT_ROOT="$PROJECT_ROOT" \
  build

mkdir -p "$HOME/Applications"
rm -rf "$INSTALL_PATH"
cp -R "$DERIVED_DATA/Build/Products/Release/Ideaboard.app" "$INSTALL_PATH"

echo ""
echo " Ideaboard.app is installed in ~/Applications."
echo " Opening it now..."
echo ""
open "$INSTALL_PATH"
