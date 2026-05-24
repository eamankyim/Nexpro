#!/usr/bin/env bash
# Copy the master ABS logo into every app location. Usage: ./scripts/sync-abs-logo.sh [path-to-logo.png]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/ABS NEW LOGO.png}"

if [[ ! -f "$SRC" ]]; then
  echo "Logo file not found: $SRC"
  echo "Usage: $0 [path-to-logo.png]  (default: ABS NEW LOGO.png in repo root)"
  exit 1
fi

echo "Syncing logo from: $SRC"

cp "$SRC" "$ROOT/Frontend/src/assets/abs-logo-icon.png"
cp "$SRC" "$ROOT/Frontend/public/abs-logo-icon.png"
cp "$SRC" "$ROOT/marketing-site/public/abs-logo-icon.png"
cp "$SRC" "$ROOT/marketing-site/public/logo.png"
cp "$SRC" "$ROOT/mobile/assets/images/abs-logo-icon.png"
for f in icon.png splash-icon.png adaptive-icon.png favicon.png; do
  cp "$SRC" "$ROOT/mobile/assets/images/$f"
done

for size in 72 96 128 152 192 384 512; do
  cp "$SRC" "$ROOT/Frontend/public/icons/icon-${size}x${size}.png"
done

echo "Logo synced to web, mobile, marketing, and PWA icons."
