#!/usr/bin/env bash
# Renders the Chrome Web Store images in images/ from the HTML in src/ with headless Chromium.
# Set CHROME to a Chrome/Chromium binary if the default below isn't found.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
chrome=${CHROME:-$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell 2>/dev/null | tail -1)}
[ -x "$chrome" ] || { echo "Set CHROME to a Chrome or Chromium binary"; exit 1; }
mkdir -p "$here/images"
render() { # name width height
  "$chrome" --headless --hide-scrollbars --force-device-scale-factor=1 --allow-file-access-from-files \
    --window-size="$2,$3" --screenshot="$here/images/$1.png" "file://$here/src/$1.html" >/dev/null 2>&1
  echo "images/$1.png ($2×$3)"
}
for name in screenshot-1-command-menu screenshot-2-dark-mode screenshot-3-attendance-marks screenshot-4-cgpa screenshot-5-documents; do
  render "$name" 1280 800
done
render promo-small 440 280
render promo-marquee 1400 560
