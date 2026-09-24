#!/usr/bin/env python3
"""Render the iOS app icon from public/chrometria-icon.svg.

`npx cap add ios` ships Capacitor's own logo as AppIcon-512@2x.png. Shipping that
is not a cosmetic slip: Yissian's TestFlight build 2 went out with the stock Expo
placeholder for exactly this reason. Run this after `cap add ios`, and after any
change to the source SVG.

Two hard iOS requirements, both pinned by src/__tests__/ios-icon.test.ts:
  * exactly 1024x1024
  * NO alpha channel — App Store Connect rejects an icon that has one, and
    nothing local warns you. The source SVG renders RGBA, so it is composited
    onto its own background colour here.

Needs cairosvg and Pillow.
"""
import pathlib
import sys

import cairosvg
from PIL import Image

UI = pathlib.Path(__file__).resolve().parent.parent
SRC = UI / "public" / "chrometria-icon.svg"
OUT = UI / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
SIZE = 1024
# The SVG's own bgGrad start colour, so compositing away the alpha is invisible.
BACKDROP = (15, 23, 42)  # #0f172a

if not SRC.exists():
    sys.exit(f"missing source: {SRC}")
if not OUT.parent.exists():
    sys.exit(f"no ios/ platform at {OUT.parent} — run `npx cap add ios` first")

png = cairosvg.svg2png(url=str(SRC), output_width=SIZE, output_height=SIZE)
tmp = OUT.with_suffix(".rgba.tmp")
tmp.write_bytes(png)

rgba = Image.open(tmp).convert("RGBA")
flat = Image.new("RGB", rgba.size, BACKDROP)
flat.paste(rgba, mask=rgba.split()[3])
flat.save(OUT, "PNG")
tmp.unlink()

print(f"wrote {OUT.relative_to(UI)} — {flat.size[0]}x{flat.size[1]} {flat.mode}")
