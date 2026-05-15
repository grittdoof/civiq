#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Génère les icônes PNG PWA Android + apple-touch-icon iOS
# à partir des SVG officiels (charte République).
#
# Prérequis : ImageMagick (`brew install imagemagick`)
# Usage    : bash scripts/generate-icons.sh
# Sortie   : public/app-icon/*.png
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/app-icon"
SRC_ANY="$ROOT/public/favicon/favicon.svg"        # carré, fond azur, blanc sur azur
SRC_MASKABLE="$ROOT/public/favicon/favicon.svg"   # idem, safe-zone 80%
SRC_IOS="$ROOT/public/favicon/favicon.svg"

if ! command -v magick >/dev/null 2>&1 && ! command -v convert >/dev/null 2>&1; then
  echo "❌ ImageMagick non détecté. Installer avec :"
  echo "   brew install imagemagick  (macOS)"
  echo "   sudo apt install imagemagick  (Ubuntu)"
  exit 1
fi

# Choisit la commande disponible (v7 = magick, v6 = convert)
CMD="$(command -v magick || command -v convert)"

mkdir -p "$OUT"
echo "→ Source SVG : $SRC_ANY"
echo "→ Sortie : $OUT"

# Densité élevée pour rasterisation propre
DENSITY=384

# ── Android PWA ── (Lighthouse PWA audit attend 192 et 512)
echo "  • icon-192.png   (Android home/install)"
"$CMD" -background none -density $DENSITY "$SRC_ANY" \
  -resize 192x192 -strip "$OUT/icon-192.png"

echo "  • icon-512.png   (splash & store)"
"$CMD" -background none -density $DENSITY "$SRC_ANY" \
  -resize 512x512 -strip "$OUT/icon-512.png"

# ── Maskable (Android adaptive) ──
# Pour les icônes maskable, Android applique un crop circulaire/squircle :
# on doit garantir que le contenu visuel rentre dans le cercle interne
# (≈ 80% de la surface). On entoure d'une marge azur sécurisée.
echo "  • icon-maskable-512.png   (Android adaptive)"
"$CMD" -background "#2F6FDB" -density $DENSITY "$SRC_MASKABLE" \
  -resize 410x410 -gravity center -extent 512x512 -strip \
  "$OUT/icon-maskable-512.png"

# ── iOS apple-touch-icon (180×180 recommandé) ──
echo "  • apple-touch-icon.png   (iOS écran d'accueil)"
"$CMD" -background "#FFFFFF" -density $DENSITY "$SRC_IOS" \
  -resize 180x180 -gravity center -extent 180x180 -strip \
  "$OUT/apple-touch-icon.png"

# ── Badge notification (monochrome blanc sur fond transparent recommandé) ──
echo "  • notification-badge.png (status bar Android)"
"$CMD" -background none -density $DENSITY "$ROOT/public/brand/coq-couleur.svg" \
  -resize 72x72 -strip -fill white -colorize 100% \
  "$OUT/notification-badge.png"

echo ""
echo "✅ Icônes générées dans $OUT"
echo ""
echo "Penser à :"
echo "  1. Vérifier dans Chrome DevTools → Application → Manifest"
echo "  2. Mettre à jour manifest.webmanifest pour pointer sur les PNG"
echo "  3. Mettre à jour layout.tsx → icons.apple si nécessaire"
