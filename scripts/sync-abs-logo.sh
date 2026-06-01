#!/usr/bin/env bash
# Copy the master ABS Ghana logo into every app location. Usage: ./scripts/sync-abs-logo.sh [path-to-logo.png]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/ABS Ghana.png}"

if [[ ! -f "$SRC" ]]; then
  echo "Logo file not found: $SRC"
  echo "Usage: $0 [path-to-logo.png]  (default: ABS Ghana.png in repo root)"
  exit 1
fi

echo "Syncing logo from: $SRC"

mkdir -p "$ROOT/Frontend/public/icons" "$ROOT/mobile/assets/images"

cp "$SRC" "$ROOT/Frontend/src/assets/abs-logo-icon.png"
cp "$SRC" "$ROOT/Frontend/public/abs-logo-icon.png"
cp "$SRC" "$ROOT/marketing-site/public/abs-logo-icon.png"
cp "$SRC" "$ROOT/marketing-site/public/logo.png"
cp "$SRC" "$ROOT/marketing-site/app/icon.png"
cp "$SRC" "$ROOT/marketing-site/app/apple-icon.png"
cp "$SRC" "$ROOT/mobile/assets/images/abs-logo-icon.png"
for f in icon.png splash-icon.png adaptive-icon.png favicon.png; do
  cp "$SRC" "$ROOT/mobile/assets/images/$f"
done

for size in 72 96 128 152 192 384 512; do
  cp "$SRC" "$ROOT/Frontend/public/icons/icon-${size}x${size}.png"
done

node - "$ROOT" <<'NODE'
const path = require('path');
const sharp = require(path.join(process.argv[2], 'Frontend/node_modules/sharp'));

const root = process.argv[2];
const resizedLogos = [
  [path.join(root, 'Frontend/src/assets/abs-logo-icon.png'), 512],
  [path.join(root, 'Frontend/public/abs-logo-icon.png'), 512],
  [path.join(root, 'marketing-site/public/abs-logo-icon.png'), 512],
  [path.join(root, 'marketing-site/public/logo.png'), 512],
  [path.join(root, 'mobile/assets/images/abs-logo-icon.png'), 512],
  [path.join(root, 'mobile/assets/images/favicon.png'), 512],
];

(async () => {
  for (const [filePath, size] of resizedLogos) {
    await sharp(filePath)
      .resize(size, size, { fit: 'contain', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(`${filePath}.tmp`);
    await require('fs/promises').rename(`${filePath}.tmp`, filePath);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

node "$ROOT/Frontend/scripts/generate-icons.js"

echo "Logo synced to web, mobile, marketing, and PWA icons."
