#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_FILE="$SCRIPT_DIR/IdeaboardMac/IdeaboardMac.xcodeproj"
DERIVED_DATA="$SCRIPT_DIR/.build"
INSTALL_PATH="$HOME/Applications/Ideaboard.app"
BACKUP_DIR="$HOME/Library/Application Support/Ideaboard/App Backups"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
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
  echo " Node.js is only needed while building the app from source."
  echo " Install the Node.js LTS version from https://nodejs.org"
  read -r "? Press Enter to close..."
  exit 1
fi

NPM_BIN="$(command -v npm || true)"
if [[ -z "$NPM_BIN" ]]; then
  echo " npm was not found. Install Node.js LTS, then run this installer again."
  read -r "? Press Enter to close..."
  exit 1
fi
NODE_BIN="$(command -v node)"
export PATH="$(dirname "$NODE_BIN"):$PATH"

SIGNING_IDENTITY="$(/usr/bin/security find-identity -v -p codesigning | /usr/bin/awk '/"Apple Development:/ { print $2; exit }')"
if [[ -z "$SIGNING_IDENTITY" ]]; then
  echo " No Apple Development signing identity was found in Keychain."
  echo " The existing app will not be replaced. Open Xcode and add a development certificate, then try again."
  read -r "? Press Enter to close..."
  exit 1
fi

echo " Building the standalone Ideaboard Mac app..."
echo " Installing project dependencies..."
"$NPM_BIN" --prefix "$PROJECT_ROOT" ci

echo " Building with Xcode..."
DEVELOPER_DIR="$DEVELOPER_DIR" xcodebuild \
	-quiet \
	-project "$PROJECT_FILE" \
  -scheme IdeaboardMac \
  -configuration Release \
  -derivedDataPath "$DERIVED_DATA" \
  IDEABOARD_NPM_EXECUTABLE="$NPM_BIN" \
  build

BUILT_APP="$DERIVED_DATA/Build/Products/Release/Ideaboard.app"
if [[ ! -f "$BUILT_APP/Contents/Resources/Web/ideaboard.html" ]]; then
  echo " The app build did not include its Ideaboard files."
  read -r "? Press Enter to close..."
  exit 1
fi

mkdir -p "$HOME/Applications"
echo " Signing the app with the local Apple Development identity..."
/usr/bin/codesign --force --deep --sign "$SIGNING_IDENTITY" --timestamp=none "$BUILT_APP"
/usr/bin/codesign --verify --deep --strict "$BUILT_APP"

if /usr/bin/pgrep -x Ideaboard >/dev/null 2>&1; then
  echo " Please quit Ideaboard before installing the update. The running app was left untouched."
  read -r "? Press Enter to close..."
  exit 1
fi

STAGING_DIR="$(/usr/bin/mktemp -d "$HOME/Applications/.ideaboard-install.XXXXXX")"
STAGED_APP="$STAGING_DIR/Ideaboard.app"
PREVIOUS_APP="$STAGING_DIR/previous/Ideaboard.app"
INSTALL_COMPLETE=false

cleanup_install() {
  local result=$?
  trap - EXIT
  set +e
  if [[ -e "$PREVIOUS_APP" && "$INSTALL_COMPLETE" != true ]]; then
    if [[ -e "$INSTALL_PATH" ]]; then
      /bin/mv "$INSTALL_PATH" "$STAGED_APP"
    fi
    if [[ ! -e "$INSTALL_PATH" ]] && /bin/mv "$PREVIOUS_APP" "$INSTALL_PATH"; then
      if [[ -x "$LSREGISTER" ]]; then "$LSREGISTER" -f "$INSTALL_PATH"; fi
      echo " The previous Ideaboard app was restored."
    else
      echo " The previous app is preserved at: $PREVIOUS_APP"
      echo " Installation could not restore it automatically."
      exit 1
    fi
  fi
  # This directory contains only installer-created files. The previous app is
  # removed only after successful installation and a verified archive backup.
  /bin/rm -rf "$STAGING_DIR"
  exit "$result"
}
trap cleanup_install EXIT

/usr/bin/ditto "$BUILT_APP" "$STAGED_APP"
/usr/bin/codesign --verify --deep --strict "$STAGED_APP"

BACKUP_PATH=""
if [[ -e "$INSTALL_PATH" ]]; then
  /bin/mkdir -p "$BACKUP_DIR" "$STAGING_DIR/previous"
  BACKUP_PATH="$BACKUP_DIR/Ideaboard-$(date +%Y%m%d-%H%M%S)-$$.zip"
  /usr/bin/ditto -c -k --sequesterRsrc --keepParent "$INSTALL_PATH" "$STAGING_DIR/previous-app.zip"
  /usr/bin/unzip -tq "$STAGING_DIR/previous-app.zip"
  /bin/mv "$STAGING_DIR/previous-app.zip" "$BACKUP_PATH"
  if [[ -x "$LSREGISTER" ]]; then "$LSREGISTER" -u "$INSTALL_PATH" || true; fi
  if ! /bin/mv "$INSTALL_PATH" "$PREVIOUS_APP"; then
    if [[ -x "$LSREGISTER" ]]; then "$LSREGISTER" -f "$INSTALL_PATH" || true; fi
    echo " The previous app could not be moved. The installed app was left untouched."
    exit 1
  fi
fi

if ! /bin/mv "$STAGED_APP" "$INSTALL_PATH"; then
  echo " The new app could not be moved into place."
  exit 1
fi
/usr/bin/codesign --verify --deep --strict "$INSTALL_PATH"
if [[ -x "$LSREGISTER" ]]; then
  "$LSREGISTER" -u "$BUILT_APP" || true
  "$LSREGISTER" -f "$INSTALL_PATH"
fi
INSTALL_COMPLETE=true

echo ""
echo " Ideaboard.app is installed in ~/Applications."
if [[ -n "$BACKUP_PATH" ]]; then echo " Previous app backup: $BACKUP_PATH"; fi
echo " The app now opens in its own window and does not need Node at runtime."
echo " Opening it now..."
echo ""
open -n "$INSTALL_PATH"
