/**
 * Icon generation script for Number Merge Puzzle.
 *
 * Usage:
 *   1. Save the game icon PNG as: public/source-icon.png
 *   2. Run: npm run generate:icons
 *
 * Outputs:
 *   public/favicon.ico              (multi-res: 16x16 + 32x32)
 *   public/favicon-16x16.png
 *   public/favicon-32x32.png
 *   public/apple-touch-icon.png    (180x180)
 *   public/icons/icon-{N}x{N}.png  (72, 96, 128, 144, 152, 192, 384, 512)
 *   public/icons/maskable-icon-{N}x{N}.png (192, 512)
 *
 * To replace the production domain later, search for the current production domain in:
 *   index.html, public/robots.txt, public/sitemap.xml
 */

import sharp from 'sharp';
import { writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'public', 'source-icon.png');
const PUBLIC = path.join(ROOT, 'public');
const ICONS_DIR = path.join(PUBLIC, 'icons');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];
const FAVICON_SIZES = [16, 32];
const APPLE_TOUCH_SIZE = 180;

// Maskable safe-zone: icon shrunk to 80% and centered on game bg (#05070d).
const MASKABLE_PADDING = 0.1;

// Build a proper multi-resolution ICO file with embedded PNG data.
function buildIco(pngBuffers, sizes) {
  const HEADER_SIZE = 6;
  const ENTRY_SIZE = 16;
  const numImages = pngBuffers.length;
  const directorySize = ENTRY_SIZE * numImages;

  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt16LE(0, 0);            // Reserved
  header.writeUInt16LE(1, 2);            // Type: 1 = ICO
  header.writeUInt16LE(numImages, 4);    // Number of images

  const directory = Buffer.alloc(directorySize);
  let imageOffset = HEADER_SIZE + directorySize;

  pngBuffers.forEach((buf, i) => {
    const base = i * ENTRY_SIZE;
    const size = sizes[i];
    // Width/height of 0 means 256; use actual size for ≤255.
    directory.writeUInt8(size >= 256 ? 0 : size, base + 0);
    directory.writeUInt8(size >= 256 ? 0 : size, base + 1);
    directory.writeUInt8(0, base + 2);             // ColorCount (0 = no palette)
    directory.writeUInt8(0, base + 3);             // Reserved
    directory.writeUInt16LE(1, base + 4);          // Planes
    directory.writeUInt16LE(32, base + 6);         // Bit count (32bpp RGBA)
    directory.writeUInt32LE(buf.length, base + 8); // Image data size
    directory.writeUInt32LE(imageOffset, base + 12); // Offset to image data
    imageOffset += buf.length;
  });

  return Buffer.concat([header, directory, ...pngBuffers]);
}

async function run() {
  console.log('');
  console.log('Number Merge Puzzle — Icon Generator');
  console.log('=====================================');

  // Verify source exists
  try {
    await readFile(SOURCE);
  } catch {
    console.error('');
    console.error('ERROR: public/source-icon.png not found.');
    console.error('Save the game icon PNG as public/source-icon.png and run this script again.');
    console.error('');
    process.exit(1);
  }

  await mkdir(ICONS_DIR, { recursive: true });

  const src = () => sharp(SOURCE);

  // ── Standard PWA icons ────────────────────────────────────────────────────
  for (const size of ICON_SIZES) {
    await src().resize(size, size).png().toFile(path.join(ICONS_DIR, `icon-${size}x${size}.png`));
    console.log(`  ✓  icons/icon-${size}x${size}.png`);
  }

  // ── Maskable icons (safe-zone padded) ─────────────────────────────────────
  for (const size of MASKABLE_SIZES) {
    const padPx = Math.round(size * MASKABLE_PADDING);
    const innerSize = size - padPx * 2;
    const innerBuf = await src().resize(innerSize, innerSize).png().toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 5, g: 7, b: 13, alpha: 1 }, // #05070d
      },
    })
      .composite([{ input: innerBuf, gravity: 'center' }])
      .png()
      .toFile(path.join(ICONS_DIR, `maskable-icon-${size}x${size}.png`));
    console.log(`  ✓  icons/maskable-icon-${size}x${size}.png`);
  }

  // ── Favicon PNGs ──────────────────────────────────────────────────────────
  const faviconBuffers = [];
  for (const size of FAVICON_SIZES) {
    const buf = await src().resize(size, size).png().toBuffer();
    faviconBuffers.push(buf);
    await writeFile(path.join(PUBLIC, `favicon-${size}x${size}.png`), buf);
    console.log(`  ✓  favicon-${size}x${size}.png`);
  }

  // ── favicon.ico (multi-res: 16×16 + 32×32 embedded PNG) ──────────────────
  const icoBuffer = buildIco(faviconBuffers, FAVICON_SIZES);
  await writeFile(path.join(PUBLIC, 'favicon.ico'), icoBuffer);
  console.log('  ✓  favicon.ico');

  // ── Apple touch icon (180×180) ────────────────────────────────────────────
  await src().resize(APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE).png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'));
  console.log('  ✓  apple-touch-icon.png');

  console.log('');
  console.log('All icons generated successfully.');
  console.log('');
  console.log('Next steps:');
  console.log('  npm run build');
  console.log('  npm run preview');
  console.log('');
  console.log('To set your production domain, update the canonical/social URLs in:');
  console.log('  index.html, public/robots.txt, public/sitemap.xml');
  console.log('');
}

run().catch((err) => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
