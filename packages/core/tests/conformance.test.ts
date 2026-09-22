/**
 * Conformance vectors — the contract between this TypeScript engine and the
 * Swift port planned for the iOS app (docs/specs/2026-09-21-ios-native-v1-design.md).
 *
 * The decision to port rather than embed a JS runtime is only defensible if
 * something proves the two implementations agree. That is this file, plus the
 * generated `test-vectors.json` beside it:
 *
 *   - here, Vitest replays every recorded case and asserts TypeScript still
 *     produces the recorded value  (regression)
 *   - later, XCTest loads the SAME file and asserts Swift produces it too
 *     (conformance)
 *
 * One artefact, two consumers. Regenerate with `npm -w packages/core run
 * vectors` and commit the diff — a change there is a deliberate statement that
 * the engine's behaviour moved, and it must move in both languages.
 *
 * The bar is every export, not a sample. `docs/specs/ios-app-spec.md` claimed a
 * vector file covering "every core function"; it held 13 vectors across 3
 * functions. The coverage test below exists so that cannot be true again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as core from '../src/index';
import { VECTOR_CASES, EXCLUDED_EXPORTS, FLOAT_TOLERANCE, encodeValue } from '../src/conformance/corpus';

const VECTORS_PATH = join(import.meta.dirname, '..', 'test-vectors.json');

type Vector = { name: string; args?: unknown[]; value: unknown };

function loadVectors(): Vector[] {
  if (!existsSync(VECTORS_PATH)) {
    throw new Error(
      `test-vectors.json is missing — run \`npm -w packages/core run vectors\`. ` +
      `It is a committed artefact, not a build product.`);
  }
  return JSON.parse(readFileSync(VECTORS_PATH, 'utf8')).vectors as Vector[];
}

/** Deep compare, tolerating float drift in the last places. */
function matches(actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
    return Math.abs(actual - expected) <= FLOAT_TOLERANCE;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length &&
      actual.every((v, i) => matches(v, expected[i]));
  }
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const a = actual as Record<string, unknown>, e = expected as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(e)]);
    return [...keys].every(k => matches(a[k], e[k]));
  }
  return Object.is(actual, expected);
}

describe('conformance vectors', () => {
  it('cover every public export of the engine', () => {
    const exported = Object.keys(core).sort();
    const covered = new Set([
      ...VECTOR_CASES.map(c => c.name),
      ...EXCLUDED_EXPORTS.map(e => e.name),
    ]);
    const missing = exported.filter(name => !covered.has(name));
    expect(exported.length).toBeGreaterThan(50);   // the scan must not find nothing
    expect(missing).toEqual([]);
  });

  it('exclude nothing without a recorded reason', () => {
    // An exclusion list is where coverage quietly rots. Every entry must say
    // why, and must still name a real export.
    const exported = new Set(Object.keys(core));
    for (const { name, reason } of EXCLUDED_EXPORTS) {
      expect(reason.length).toBeGreaterThan(20);
      expect(exported.has(name)).toBe(true);
    }
  });

  it('replay against the current implementation', () => {
    const vectors = loadVectors();
    expect(vectors.length).toBeGreaterThan(1000);

    const drifted: string[] = [];
    for (const v of vectors) {
      const target = (core as Record<string, unknown>)[v.name];
      let actual: unknown;
      try {
        actual = typeof target === 'function'
          ? (target as (...a: unknown[]) => unknown)(...(v.args ?? []))
          : target;
      } catch (err) {
        // errors are recorded, not skipped — see the generator
        actual = { throws: err instanceof Error ? err.message : String(err) };
      }
      // compare in the encoded domain, so NaN/Infinity are represented
      if (!matches(encodeValue(actual), v.value)) {
        drifted.push(`${v.name}(${JSON.stringify(v.args ?? []).slice(0, 60)})`);
      }
    }
    expect(drifted.slice(0, 10)).toEqual([]);
    expect(drifted).toHaveLength(0);
  });

  it('record a case for every module, including the nine with no unit tests', () => {
    // contour, rhythm, tuning, transform-chain, euclidean, constraint-composer,
    // orchestration, quantize and voicings had NO tests at all. For those the
    // vectors are characterization tests — they pin current behaviour so the
    // Swift port has something to agree with, and so a refactor here cannot
    // change them silently. That gap is the reason this file is worth its size.
    const covered = new Set(VECTOR_CASES.map(c => c.name));
    for (const name of [
      'analyzeContour', 'analyzeRhythm', 'frequencyInTuning', 'evaluateChain',
      'euclidean', 'generateCandidates', 'suggestOrchestrations', 'quantizeToSet',
      'allForms',
    ]) {
      expect(covered.has(name), `${name} has no conformance vector`).toBe(true);
    }
  });
});
