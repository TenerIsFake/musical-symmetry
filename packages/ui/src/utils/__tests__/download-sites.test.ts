/**
 * Exports must go through utils/download.ts.
 *
 * The pattern this forbids — `URL.createObjectURL` then a synthetic `<a download>`
 * click — works in a browser and is **silently inert in WKWebView**, which is what
 * Capacitor runs on iOS. No file, no error, nothing in the console. Fourteen sites
 * had it, and every one of them is a feature the US$12.99 unlock advertises.
 *
 * It is the kind of thing that comes back: the five lines are muscle memory, and
 * the reviewer of a future PR has no way to know they are wrong on one platform.
 * Hence a test rather than a comment.
 *
 * ⚠️ `createObjectURL` is NOT banned outright. SharePanel rasterises an SVG by
 * loading an object URL into an <img> and painting it to a canvas — a completely
 * legitimate use with no download involved. So the rule is narrower and matches
 * what actually breaks: an object URL followed by an anchor's `download`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';

const SRC = resolve(__dirname, '../..');
/** The one place allowed to do the browser dance. */
const HELPER = 'utils/download.ts';

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

/** An object URL is a download site only if an anchor's `download` follows it closely. */
function downloadSites(body: string): number[] {
  const lines = body.split('\n');
  const hits: number[] = [];
  lines.forEach((line, i) => {
    if (!line.includes('createObjectURL')) return;
    const window = lines.slice(i, i + 7).join(' ');
    if (/\.download\s*=/.test(window)) hits.push(i + 1);
  });
  return hits;
}

describe('file exports', () => {
  it('are funnelled through utils/download.ts, which handles WKWebView', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file);
      if (rel === HELPER) continue;
      for (const line of downloadSites(readFileSync(file, 'utf8'))) {
        offenders.push(`${rel}:${line}`);
      }
    }
    expect(offenders, 'these will silently do nothing on iOS — use saveFile()').toEqual([]);
  });

  it('still allows object URLs that are not downloads', () => {
    // SharePanel loads an SVG object URL into an <img> to rasterise it on a canvas.
    // A blanket ban on createObjectURL would have broken that for no reason.
    const body = readFileSync(join(SRC, 'components/SharePanel.tsx'), 'utf8');
    expect(body).toContain('createObjectURL');
    expect(downloadSites(body)).toEqual([]);
  });

  it('has a helper that actually branches on platform', () => {
    const helper = readFileSync(join(SRC, HELPER), 'utf8');
    expect(helper).toMatch(/isNativePlatform/);
    expect(helper).toMatch(/@capacitor\/filesystem/);
    expect(helper).toMatch(/@capacitor\/share/);
  });
});
