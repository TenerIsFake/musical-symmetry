import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * The iOS app icon, pinned.
 *
 * `npx cap add ios` ships Capacitor's own blue logo as AppIcon-512@2x.png, and
 * nothing in the toolchain objects: it builds, it installs, it reaches TestFlight.
 * Yissian's build 2 went out with the equivalent Expo placeholder. The only thing
 * that catches it before a reviewer does is a test.
 *
 * Apple's two hard requirements are checked by parsing the PNG's IHDR chunk
 * directly — a 25-byte header read, so this needs no image dependency.
 * Regenerate with `python3 packages/ui/scripts/make-icons.py`, which owns every icon output
 * from the canonical SVG — the web PNG, the App Store PNG and this slot. It was
 * already doing the first two when the iOS platform was added; adding a third
 * target beat adding a second script that renders the same SVG with a different
 * library and drifts from it silently.
 */

const ICON = resolve(
  __dirname,
  '../../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
);

/** Capacitor's stock template logo. If the icon ever hashes back to this, it was never replaced. */
const CAPACITOR_PLACEHOLDER_MD5 = '0ac741c9e1701ee14dd05ea131f7cfd8';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG layout: 8-byte magic, then the IHDR chunk — 4 length, 4 type, then width/height/depth/colourType. */
function readIHDR(buf: Buffer) {
  expect(buf.subarray(0, 8)).toEqual(PNG_MAGIC);
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colourType: buf[25],
  };
}

describe('iOS app icon', () => {
  it('exists — the ios/ platform is committed, so the icon must be too', () => {
    expect(existsSync(ICON)).toBe(true);
  });

  it('is exactly 1024x1024, the only size Contents.json declares', () => {
    const { width, height } = readIHDR(readFileSync(ICON));
    expect({ width, height }).toEqual({ width: 1024, height: 1024 });
  });

  it('has no alpha channel — App Store Connect rejects an icon that does', async () => {
    const { colourType } = readIHDR(readFileSync(ICON));
    // PNG colour types: 0 grey, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA.
    // 4 and 6 carry an alpha channel; 3 can carry one via a tRNS chunk.
    expect([4, 6]).not.toContain(colourType);
    expect(colourType).toBe(2);
    if (colourType === 3) throw new Error('palette PNG may carry alpha via tRNS');
  });

  it('is not still the Capacitor template placeholder', async () => {
    const { createHash } = await import('crypto');
    const md5 = createHash('md5').update(readFileSync(ICON)).digest('hex');
    expect(md5).not.toBe(CAPACITOR_PLACEHOLDER_MD5);
  });
});
