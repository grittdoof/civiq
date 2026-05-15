#!/usr/bin/env node
/**
 * Génère les icônes PNG PWA via Sharp (alternative Node à ImageMagick).
 *
 * Prérequis : `npm i -D sharp`
 * Usage    : `node scripts/generate-icons.mjs`
 * Sortie   : public/app-icon/*.png
 */
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "public/app-icon");
const SRC = resolve(ROOT, "public/favicon/favicon.svg");
const SRC_TRANSP = resolve(ROOT, "public/favicon/favicon-transparent.svg");
const SRC_COQ = resolve(ROOT, "public/brand/coq-couleur.svg");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("❌ Module 'sharp' manquant. Installer avec :");
  console.error("   npm i -D sharp");
  process.exit(1);
}

if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

console.log("→ Génération des icônes PWA…");

// Android 192/512
await sharp(SRC).resize(192, 192).png({ compressionLevel: 9 }).toFile(`${OUT}/icon-192.png`);
console.log("  ✓ icon-192.png");

await sharp(SRC).resize(512, 512).png({ compressionLevel: 9 }).toFile(`${OUT}/icon-512.png`);
console.log("  ✓ icon-512.png");

// Maskable 512 avec safe-zone (80%)
const inner = await sharp(SRC_TRANSP).resize(410, 410).toBuffer();
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 3,
    background: { r: 0x2F, g: 0x6F, b: 0xDB }, // Azur République
  },
})
  .composite([{ input: inner, gravity: "center" }])
  .png({ compressionLevel: 9 })
  .toFile(`${OUT}/icon-maskable-512.png`);
console.log("  ✓ icon-maskable-512.png (safe-zone Android adaptive)");

// Apple touch icon 180×180 sur fond blanc
const innerIos = await sharp(SRC_TRANSP).resize(160, 160).toBuffer();
await sharp({
  create: {
    width: 180,
    height: 180,
    channels: 3,
    background: { r: 0xFF, g: 0xFF, b: 0xFF },
  },
})
  .composite([{ input: innerIos, gravity: "center" }])
  .png({ compressionLevel: 9 })
  .toFile(`${OUT}/apple-touch-icon.png`);
console.log("  ✓ apple-touch-icon.png (iOS)");

// Badge notification 72×72 monochrome (couche alpha du coq)
await sharp(SRC_COQ)
  .resize(72, 72)
  .png({ compressionLevel: 9 })
  .toFile(`${OUT}/notification-badge.png`);
console.log("  ✓ notification-badge.png");

console.log("\n✅ Icônes générées dans", OUT);
