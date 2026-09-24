/**
 * The sketch-count limit, mirrored from the server.
 *
 * The page already displays "Free tier: up to 3 sketches" and already shows a
 * "limit reached" notice — but the Save button never consulted either, so the
 * refusal arrived as a 403 after a round trip instead of as a disabled button.
 * The limit was real; only the feedback was missing.
 *
 * The trap in fixing it, and the reason this is a function with tests rather
 * than a condition inlined into the button: the server checks the count on
 * POST only (packages/analyzer/src/sketches/routes.ts:52-58). PUT — saving an
 * EXISTING sketch — is not counted. So a naive `disabled={atLimit}` would stop
 * a free user at capacity from editing the three sketches they already have,
 * which is worse than the papercut it set out to fix.
 */
import { describe, it, expect } from 'vitest';
import { sketchSaveBlocked } from '../useSketchpad';

describe('creating a new sketch', () => {
  it('is blocked at the limit — the server would 403', () => {
    expect(sketchSaveBlocked({ isNew: true, savedCount: 3, limit: 3 })).toBe(true);
  });

  it('is blocked past the limit too', () => {
    expect(sketchSaveBlocked({ isNew: true, savedCount: 9, limit: 3 })).toBe(true);
  });

  it('is allowed below it', () => {
    expect(sketchSaveBlocked({ isNew: true, savedCount: 2, limit: 3 })).toBe(false);
  });

  it('is allowed with no saved sketches', () => {
    expect(sketchSaveBlocked({ isNew: true, savedCount: 0, limit: 3 })).toBe(false);
  });
});

describe('saving an EXISTING sketch', () => {
  it('is never blocked, even at capacity — PUT is not counted', () => {
    // The regression this exists to prevent: locking a free user out of editing
    // the sketches they already have.
    expect(sketchSaveBlocked({ isNew: false, savedCount: 3, limit: 3 })).toBe(false);
  });

  it('is never blocked past capacity either', () => {
    expect(sketchSaveBlocked({ isNew: false, savedCount: 99, limit: 3 })).toBe(false);
  });
});

describe('research tier', () => {
  it('has no ceiling', () => {
    expect(sketchSaveBlocked({ isNew: true, savedCount: 10_000, limit: Infinity })).toBe(false);
  });
});
