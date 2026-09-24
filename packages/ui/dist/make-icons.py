#!/usr/bin/env python3
"""Render Chrometria's app icons from the canonical SVG.

Run from the repo root:  python3 packages/ui/public/make-icons.py
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
SVG = HERE / "chrometria-icon.svg"

# (filename, pixels, keep_alpha)
TARGETS = [
    ("chrometria-icon-512.png", 512, True),        # web / PWA, as before
    ("chrometria-icon-ios-1024.png", 1024, False),  # App Store: RGB, no alpha
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
    tmp = HERE / f".tmp-{px}.png"
    tmp.write_bytes(out)
    img = Image.open(tmp).convert("RGBA")
    img.load()
    tmp.unlink()
    return img


def main():
    if not SVG.exists():
        sys.exit(f"missing source: {SVG}")
    for name, px, keep_alpha in TARGETS:
        img = render(px)
        # Re-encoding a PNG whose pixels are unchanged still rewrites the file
        # (a different encoder produces different bytes), which shows up as a
        # meaningless diff on a committed asset. Skip when the content matches.
        existing = HERE / name
        if existing.exists():
            old = Image.open(existing).convert("RGBA")
            new = img if keep_alpha else flatten(img)
            if old.tobytes() == new.convert("RGBA").tobytes():
                print(f"  {name:32} unchanged — not rewritten")
                continue
        if keep_alpha:
            img.save(HERE / name)
        else:
            flatten(img).save(HERE / name)
        check = Image.open(HERE / name)
        alpha = "A" in check.mode
        assert check.size == (px, px), f"{name}: wrong size {check.size}"
        assert alpha == keep_alpha, f"{name}: alpha={alpha}, expected {keep_alpha}"
        print(f"  {name:32} {check.size[0]}x{check.size[1]} {check.mode}"
              f"{'  (no alpha — App Store safe)' if not keep_alpha else ''}")


if __name__ == "__main__":
    main()
