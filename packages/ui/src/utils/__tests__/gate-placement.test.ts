/**
 * Where the device unlock is allowed to be consulted.
 *
 * `canUseServer` takes no unlock parameter, so no single call site can leak server
 * quota to a one-time purchase. But a whole FILE can still be wrong: a screen whose
 * gated feature hits the API could import the on-device gate and open it anyway.
 * That mistake type-checks, passes every unit test, and is invisible in a diff.
 *
 * So this walks the source and asserts that the screens whose gates are entirely
 * server-backed never import the on-device gate at all. Classifications come from a
 * read of every gate in packages/ui/src on 2026-09-23; the evidence is the endpoint
 * named beside each entry.
 *
 * If you are here because this test failed: the feature you just gated probably
 * calls the API. Use the account tier (`canUseServer`) for it. See
 * docs/specs/2026-09-21-ios-native-v1-design.md §6.1.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const SRC = resolve(__dirname, '../..');

/** Screens whose every tier gate opens something the server has to do. */
const SERVER_ONLY_GATES: Record<string, string> = {
  'pages/RoomPage.tsx': 'submitting pitch classes relays over the room WebSocket',
  'pages/AssignmentsPage.tsx': 'the educator view is GET/POST /api/assignments',
  'pages/CorpusPage.tsx': 'every corpus feature is POST /api/corpus*',
  'components/WorkspaceList.tsx': 'sharing is POST /api/workspaces/:id/share',
  'components/CollectionsSidebar.tsx': 'publishing is POST /api/public/collections/:id/publish',
  'components/StripeCheckout.tsx': 'checkout is POST /api/billing/checkout',
};

/**
 * Screens that mix both kinds. A file-level rule cannot judge them, so they are excluded
 * here and the reviewer carries it: the on-device half may use the unlock, the
 * server half must not.
 */
const MIXED_REVIEW_BY_HAND = [
  'pages/ProgressionPage.tsx',
  'pages/QuizPage.tsx', // genre-DNA matches are POST /api/genre/detect
  'pages/ComparePage.tsx', // the file upload is POST /api/analyze
  'pages/HistoryPage.tsx', // CSV export is GET /api/history/export.csv
];


/**
 * The screens the unlock actually reaches, as a checked inventory.
 *
 * 70 tests pass in this workspace and almost none of them render these pages, so a
 * green suite says very little about whether the unlock is wired. This says it: if
 * one of these screens loses its gate — reverted, refactored, rewritten — the buyer
 * silently stops getting something they paid for, and nothing else would notice.
 *
 * Adding a screen here is correct when its gate is on-device. Removing one should
 * take a reason.
 */
const UNLOCK_AWARE = [
  'components/ClassificationPanel.tsx',
  'components/ExportMenu.tsx',
  'components/ProgressionTemplates.tsx',
  'components/TonnetzViz.tsx',
  'hooks/useLiveMidi.ts',
  'pages/ClassifierPage.tsx',
  'pages/ConstraintComposerPage.tsx',
  'pages/EarTrainingPage.tsx',
  'pages/EuclideanPage.tsx',
  'pages/HarmonicPathPage.tsx',
  'pages/LiveDetectionPage.tsx',
  'pages/MelodyPage.tsx',
  'pages/MidiIOPage.tsx',
  'pages/OrchestrationPage.tsx',
  'pages/PracticePage.tsx',
  'pages/ProgressionPage.tsx',
  'pages/QuizPage.tsx',
  'pages/ScoreAnnotationPage.tsx',
  'pages/SearchPage.tsx',
  'pages/SetClassPalettePage.tsx',
  'pages/SketchpadPage.tsx',
  'pages/TimelinePage.tsx',
  'pages/TransformChainPage.tsx',
  'pages/TuningPage.tsx',
  'pages/VoiceLeadingGraphPage.tsx',
];

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

const USES_ON_DEVICE_GATE = /useOnDeviceGate|canUseOnDevice/;

describe('on-device gate placement', () => {
  it('is never imported by a screen whose gates are all server-backed', () => {
    const offenders: string[] = [];
    for (const [rel, why] of Object.entries(SERVER_ONLY_GATES)) {
      const body = readFileSync(join(SRC, rel), 'utf8');
      if (USES_ON_DEVICE_GATE.test(body)) offenders.push(`${rel} — ${why}`);
    }
    expect(offenders).toEqual([]);
  });

  it('keeps canUseServer out of reach of the unlock everywhere it is used', () => {
    // canUseServer(tier, required) takes two arguments. A third would mean someone
    // threaded the unlock through it.
    const bad: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const body = readFileSync(file, 'utf8');
      for (const call of body.match(/canUseServer\([^)]*\)/g) ?? []) {
        const args = call.slice('canUseServer('.length, -1).split(',');
        if (args.length > 2) bad.push(`${file.replace(SRC, '')}: ${call}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('is still consulted by every screen that sells it', () => {
    const missing = UNLOCK_AWARE.filter(
      rel => !USES_ON_DEVICE_GATE.test(readFileSync(join(SRC, rel), 'utf8')),
    );
    expect(missing).toEqual([]);
  });

  it('never widens a limit the SERVER also enforces', () => {
    // The trap that actually caught us: SketchpadPage's bar count reads like a local
    // editor cap, but `bars` is persisted and revalidated against the account tier in
    // packages/analyzer/src/sketches/routes.ts. Widening it client-side does not grant
    // anything — it just moves the refusal from the editor to a 403 on save, shown to
    // the one user who paid. If a limit has a server-side twin, it stays on the tier.
    const body = readFileSync(join(SRC, 'pages/SketchpadPage.tsx'), 'utf8');
    const leaked = body
      .split('\n')
      .filter(line => /BAR_LIMITS|SKETCH_LIMITS/.test(line) && /allow\(/.test(line));
    expect(leaked).toEqual([]);
  });

  it('lists the mixed screens so they are reviewed rather than assumed', () => {
    // Not an assertion about behaviour — a checked inventory. If one of these is
    // renamed or deleted, this fails and the list gets corrected instead of rotting.
    for (const rel of MIXED_REVIEW_BY_HAND) {
      expect(() => readFileSync(join(SRC, rel), 'utf8')).not.toThrow();
    }
  });
});
