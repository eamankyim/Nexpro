/**
 * Generate PWA icons with ABS branding
 * Run with: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

// ABS brand colors
const BG_COLOR = '#166534'; // Dark green
const TEXT_COLOR = '#FFFFFF'; // White

async function generateIcon(size) {
  // Calculate font size relative to icon size (roughly 60% of icon size)
  const fontSize = Math.round(size * 0.6);
  const yOffset = Math.round(size * 0.7); // Adjust vertical centering

  // Create SVG with "A" letter (app logo)
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="${BG_COLOR}"/>
      <text 
        x="50%" 
        y="${yOffset}" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        font-weight="bold" 
        fill="${TEXT_COLOR}" 
        text-anchor="middle"
      >A</text>
    </svg>
  `;

  const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);
  
  console.log(`Generated: icon-${size}x${size}.png`);
}

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Generating ABS PWA icons...\n');
  
  for (const size of ICON_SIZES) {
    await generateIcon(size);
  }
  
  console.log('\nAll icons generated successfully!');
}

main().catch(console.error);
