#!/usr/bin/env python3
"""Render Chrometria's app icons from the canonical SVG.

Run from anywhere:  python3 packages/ui/scripts/make-icons.py
Requires: rsvg-convert (librsvg) and Pillow.

`chrometria-icon.svg` is the single source of truth for the mark — twelve
pitch-class dots on the chromatic circle with two symmetry chords across it.
Before this script the PNGs beside it were produced by hand, so nothing
guaranteed they still matched the SVG. They did, as it happens (verified
2026-09-21 by rendering and comparing pixel-for-pixel), but that was luck
rather than process.

The iOS output is the one with a hard requirement the others do not share:

    App Store icons must be RGB with NO alpha channel. Apple rejects an icon
    that carries transparency, and nothing in a local build warns about it.

Apple also applies its own rounded-corner mask, so the square is rendered
full-bleed here and must NOT be pre-rounded.
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
# The assets live in public/ (Vite copies that directory to dist/ verbatim), but
# this script does NOT — it used to, and Vite duly published a build script at
# the site root. Nothing secret in it; simply the wrong place for it.
PUBLIC = HERE.parent / "public"
SVG = PUBLIC / "chrometria-icon.svg"

# (path relative to packages/ui/public, pixels, keep_alpha)
TARGETS = [
    ("chrometria-icon-512.png", 512, True),        # web / PWA, as before
    ("chrometria-icon-ios-1024.png", 1024, False),  # App Store: RGB, no alpha
    # The Capacitor iOS app icon. `npx cap add ios` ships Capacitor's own blue
    # logo here and nothing objects — it builds, installs, and reaches
    # TestFlight. Yissian's build 2 went out with the equivalent Expo
    # placeholder for exactly this reason, so the slot is generated rather than
    # left to whoever remembers. Same no-alpha rule as the App Store target.
    ("../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024, False),
]


def flatten(img):
    """Composite onto the SVG's own dark ground and drop the alpha channel."""
    flat = Image.new("RGB", img.size, "#0f172a")
    flat.paste(img, mask=img.split()[3])
    return flat


def render(px):
    out = subprocess.run(
        ["rsvg-convert", "-w", str(px), "-h", str(px), str(SVG)],
        capture_output=True, check=True).stdout
    tmp = PUBLIC / f".tmp-{px}.png"
    tmp.write_bytes(out)
    img = Image.open(tmp).convert("RGBA")
    img.load()
    tmp.unlink()
    return img


def main():
    if not SVG.exists():
        sys.exit(f"missing source: {SVG}")
    for name, px, keep_alpha in TARGETS:
        dest = (PUBLIC / name).resolve()
        if not dest.parent.is_dir():
            # The iOS target lives outside public/ and only exists once the
            # platform has been added. Say so rather than failing on write.
            print(f"  {name:32} skipped — {dest.parent} does not exist")
            continue
        img = render(px)
        # Re-encoding a PNG whose pixels are unchanged still rewrites the file
        # (a different encoder produces different bytes), which shows up as a
        # meaningless diff on a committed asset. Skip when the content matches.
        existing = dest
        if existing.exists():
            old = Image.open(existing).convert("RGBA")
            new = img if keep_alpha else flatten(img)
            if old.tobytes() == new.convert("RGBA").tobytes():
                print(f"  {dest.name:32} unchanged — not rewritten")
                continue
        if keep_alpha:
            img.save(dest)
        else:
            flatten(img).save(dest)
        check = Image.open(dest)
        alpha = "A" in check.mode
        assert check.size == (px, px), f"{name}: wrong size {check.size}"
        assert alpha == keep_alpha, f"{name}: alpha={alpha}, expected {keep_alpha}"
        print(f"  {dest.name:32} {check.size[0]}x{check.size[1]} {check.mode}"
              f"{'  (no alpha — App Store safe)' if not keep_alpha else ''}")


if __name__ == "__main__":
    main()
