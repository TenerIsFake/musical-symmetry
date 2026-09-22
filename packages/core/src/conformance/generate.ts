/**
 * Writes `test-vectors.json` from the corpus.
 *
 * Run: `npm -w packages/core run vectors`
 *
 * The output is a COMMITTED ARTEFACT, not a build product. A diff in it means
 * the engine's observable behaviour changed — which is sometimes correct, but
 * should always be deliberate, reviewed, and mirrored into the Swift port.
 *
 * Deliberately absent: any timestamp, version string or machine detail. The
 * file must be byte-identical when regenerated from unchanged code, or every
 * regeneration produces noise and the diff stops meaning anything.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as core from '../index';
import { VECTOR_CASES, EXCLUDED_EXPORTS, encodeValue } from './corpus';

interface Vector {
  name: string;
  args?: unknown[];
  value: unknown;
}

function build(): Vector[] {
  const api = core as Record<string, unknown>;
  return VECTOR_CASES.map(({ name, args }) => {
    const target = api[name];
    if (target === undefined) {
      throw new Error(`corpus names "${name}", which the engine does not export`);
    }
    // A thrown error is part of the contract too — `voiceLeadingDistance`
    // rejects sets of unequal cardinality, and a Swift port that returned a
    // number there would be wrong in a way no happy-path vector would catch.
    // Recorded as `{ throws: message }` rather than skipped.
    let value: unknown;
    try {
      value = typeof target === 'function'
        ? (target as (...a: unknown[]) => unknown)(...(args ?? []))
        : target;
    } catch (err) {
      value = { throws: err instanceof Error ? err.message : String(err) };
    }
    const encoded = encodeValue(value);
    return args ? { name, args, value: encoded } : { name, value: encoded };
  });
}

function main(): void {
  const vectors = build();

  // Guard against a corpus that silently shrinks. The spec this replaces
  // claimed to cover "every core function" while holding 13 vectors across 3.
  const distinct = new Set(vectors.map(v => v.name));
  const exported = Object.keys(core).length;
  const expected = exported - EXCLUDED_EXPORTS.length;
  if (distinct.size < expected) {
    const missing = Object.keys(core).filter(
      n => !distinct.has(n) && !EXCLUDED_EXPORTS.some(e => e.name === n));
    throw new Error(`no vectors for: ${missing.join(', ')}`);
  }

  // One vector per line. Still valid JSON, but a regeneration produces a
  // line-oriented diff naming exactly which cases moved — as a single 2.7MB
  // line it would be one unreviewable blob, and nobody would read it.
  const out = join(import.meta.dirname, '..', '..', 'test-vectors.json');
  const body = vectors.map(v => '  ' + JSON.stringify(v)).join(',\n');
  writeFileSync(out, `{"vectors":[\n${body}\n]}\n`);
  console.log(`${vectors.length} vectors across ${distinct.size} exports -> test-vectors.json`);
}

main();
