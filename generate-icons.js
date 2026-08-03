import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sizes = [57, 60, 72, 76, 96, 114, 120, 128, 144, 152, 167, 180, 192, 384, 512];
const inputPng = path.resolve('src/assets/Logo.png');
const outDir = path.resolve('public/icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function generate() {
  for (const size of sizes) {
    await sharp(inputPng)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outDir, `icon-${size}x${size}.png`));
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // 32px favicon — transparent
  await sharp(inputPng)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.resolve('public/favicon.png'));
  console.log('✓ favicon.png');

  // Also copy original as favicon.svg fallback (already exists, skip)
  console.log('\nAll icons generated (transparent background)!');
}

generate().catch(console.error);
