/**
 * Resize and compress web images for faster load.
 * Run: node scripts/optimize-images.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');

async function optimizePngInDir(dir, maxWidth, quality = 82) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f));
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.promises.stat(filePath);
    const img = sharp(filePath);
    const meta = await img.metadata();
    const pipeline = img.resize({
      width: meta.width > maxWidth ? maxWidth : undefined,
      withoutEnlargement: true,
    });
    const webpPath = filePath.replace(/\.(png|jpe?g)$/i, '.webp');
    await pipeline.clone().webp({ quality }).toFile(webpPath);
    await pipeline
      .png({ compressionLevel: 9, palette: true })
      .toFile(filePath + '.tmp');
    await fs.promises.rename(filePath + '.tmp', filePath);
    const after = await fs.promises.stat(filePath);
    const webpStat = await fs.promises.stat(webpPath);
    console.log(
      `  ${path.relative(ROOT, filePath)}: ${(stat.size / 1024).toFixed(0)}KB -> ${(after.size / 1024).toFixed(0)}KB (+ webp ${(webpStat.size / 1024).toFixed(0)}KB)`
    );
  }
}

async function optimizeLogo(src, maxSize) {
  if (!fs.existsSync(src)) return;
  const stat = await fs.promises.stat(src);
  const tmp = src + '.tmp';
  await sharp(src)
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(tmp);
  await fs.promises.rename(tmp, src);
  const after = await fs.promises.stat(src);
  console.log(`  logo ${path.relative(ROOT, src)}: ${(stat.size / 1024).toFixed(0)}KB -> ${(after.size / 1024).toFixed(0)}KB`);
}

async function optimizeWebpVariant(src, maxWidth, quality = 82) {
  if (!fs.existsSync(src)) return;
  const webpPath = src.replace(/\.(png|jpe?g)$/i, '.webp');
  await sharp(src)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toFile(webpPath);
  const stat = await fs.promises.stat(webpPath);
  console.log(`  webp ${path.relative(ROOT, webpPath)}: ${(stat.size / 1024).toFixed(0)}KB`);
}

async function main() {
  console.log('Optimizing empty-state images (max 640px)...');
  await optimizePngInDir(path.join(ROOT, 'src/assets/empty-states'), 640);

  console.log('Optimizing tour images (max 720px)...');
  await optimizePngInDir(path.join(ROOT, 'src/assets/tour'), 720);

  console.log('Optimizing logos...');
  await optimizeLogo(path.join(ROOT, 'src/assets/abs-logo-icon.png'), 192);
  const publicLogo = path.join(ROOT, 'public/abs-logo-icon.png');
  if (fs.existsSync(publicLogo)) {
    await optimizeLogo(publicLogo, 192);
  }

  console.log('Optimizing auth artwork...');
  await optimizeWebpVariant(path.join(ROOT, 'src/assets/African focused woman.png'), 960);

  console.log('Regenerating PWA icons...');
  require('./generate-icons.js');

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
