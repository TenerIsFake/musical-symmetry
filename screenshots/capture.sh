#!/bin/bash
# Capture Play Store screenshots at Pixel 7 dimensions (1080x2400)
# Google Play requires: min 2 screenshots, max 8, 16:9 or 9:16 aspect ratio

OUTDIR="$(dirname "$0")"
BASE_URL="http://localhost:3009"
WIDTH=412
HEIGHT=915
SCALE=2.625

PAGES=(
  "home:Landing Page"
  "#classifier:Pitch Class Classifier"
  "#analyzer:File Analyzer"
  "#euclidean:Euclidean Rhythms"
  "#harmonic-path:Tonnetz Harmonic Paths"
  "#sketchpad:Composition Sketchpad"
  "#transform:Transform Chain"
  "#orchestration:Orchestration Engine"
)

CHROME=$(which chromium-browser 2>/dev/null || which chromium 2>/dev/null || which google-chrome 2>/dev/null)
if [ -z "$CHROME" ]; then
  echo "ERROR: No Chrome/Chromium found"
  exit 1
fi

for entry in "${PAGES[@]}"; do
  IFS=: read -r hash label <<< "$entry"
  filename=$(echo "$label" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
  url="${BASE_URL}/${hash}"

  echo "Capturing: $label -> ${filename}.png"

  "$CHROME" --headless --no-sandbox --disable-gpu --disable-software-rasterizer \
    --window-size=${WIDTH},${HEIGHT} \
    --force-device-scale-factor=${SCALE} \
    --screenshot="${OUTDIR}/${filename}.png" \
    --virtual-time-budget=5000 \
    "$url" 2>/dev/null
done

echo "Done. Screenshots in $OUTDIR/"
ls -la "$OUTDIR"/*.png 2>/dev/null
