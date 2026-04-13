#!/usr/bin/env bash
# Package the extension into a zip suitable for Chrome Web Store upload.
#
# Usage:  ./build.sh
# Output: dist/judicial-outline-extension-<version>.zip
#
# The zip contains only the runtime files (manifest.json, content.js,
# sidebar.css, icons/*.png) — no docs, no git, no source SVG.

set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(grep '"version"' manifest.json | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
OUT_DIR="dist"
OUT_FILE="${OUT_DIR}/judicial-outline-extension-${VERSION}.zip"

# Sanity check: all four icon sizes must exist
missing=0
for size in 16 32 48 128; do
  if [[ ! -f "icons/icon${size}.png" ]]; then
    echo "  ✗ missing icons/icon${size}.png"
    missing=1
  fi
done
if [[ $missing -ne 0 ]]; then
  echo ""
  echo "Please generate the PNG icons first. See icons/README.md for instructions."
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

zip -r "$OUT_FILE" \
  manifest.json \
  content.js \
  sidebar.css \
  icons/icon16.png \
  icons/icon32.png \
  icons/icon48.png \
  icons/icon128.png \
  -x "*.DS_Store"

echo ""
echo "✓ Packaged: $OUT_FILE"
echo ""
echo "Next step: upload this zip to https://chrome.google.com/webstore/devconsole"
