/**
 * Generate PWA icons with ABS branding
 * Run with: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

const SOURCE_LOGO = path.join(__dirname, '../public/abs-logo-icon.png');

async function generateIcon(size) {
  const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);

  await sharp(SOURCE_LOGO)
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`Generated: icon-${size}x${size}.png`);
}

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  if (!fs.existsSync(SOURCE_LOGO)) {
    throw new Error(`Source logo not found: ${SOURCE_LOGO}`);
  }

  console.log('Generating ABS PWA icons...\n');
  
  for (const size of ICON_SIZES) {
    await generateIcon(size);
  }
  
  console.log('\nAll icons generated successfully!');
}

main().catch(console.error);
