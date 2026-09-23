/**
 * The per-platform purchase contract.
 *
 * Yissian's scar, and the trap this exists to hold shut: every intermediate state
 * between "SDK key set" and "store product live" is a contradiction. A key with no
 * product behind it is a Guideline 2.1 non-functional purchase; a product with no
 * key is an invisible upsell. So the key doubles as the off switch — an empty
 * string means "this platform cannot sell anything yet", and the UI must believe it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

async function loadFor(platform: 'ios' | 'android' | 'web') {
  vi.resetModules();
  vi.doMock('../platform', () => ({
    isNativePlatform: platform !== 'web',
    platform,
  }));
  return await import('../revenuecat');
}

afterEach(() => { vi.resetModules(); vi.doUnmock('../platform'); });

describe('purchase API key selection', () => {
  it('uses the Google key on Android', async () => {
    const rc = await loadFor('android');
    expect(rc.purchaseApiKey).toMatch(/^goog_/);
  });

  it('never offers the Google key to iOS — RevenueCat rejects a cross-platform key', async () => {
    const rc = await loadFor('ios');
    expect(rc.purchaseApiKey).not.toMatch(/^goog_/);
  });

  it('has no key at all on the web, where Stripe sells instead', async () => {
    const rc = await loadFor('web');
    expect(rc.purchaseApiKey).toBe('');
    expect(rc.purchasesSupported).toBe(false);
  });
});

describe('the iOS off switch', () => {
  it('is OFF: no appl_ key is configured yet, so iOS offers no purchase', async () => {
    // ⚠️ When you fill in the appl_ key, this test SHOULD fail — that is its job.
    // Before you change it, confirm in App Store Connect that the $12.99
    // non-consumable exists AND is wired into the offering's FIRST package
    // (the code reads availablePackages[0]). Set the key LAST, in the same
    // change that ships it. Otherwise the app shows a purchase that cannot
    // complete, which is a Guideline 2.1 rejection.
    const rc = await loadFor('ios');
    expect(rc.purchaseApiKey).toBe('');
    expect(rc.purchasesSupported).toBe(false);
  });

  it('is ON for Android, which has a key', async () => {
    const rc = await loadFor('android');
    expect(rc.purchasesSupported).toBe(true);
  });

  it('validates the shape of whatever key each platform is given', async () => {
    const { isValidKeyForPlatform } = await loadFor('web');
    expect(isValidKeyForPlatform('ios', 'appl_abc')).toBe(true);
    expect(isValidKeyForPlatform('ios', 'goog_abc')).toBe(false);
    expect(isValidKeyForPlatform('android', 'goog_abc')).toBe(true);
    expect(isValidKeyForPlatform('android', 'appl_abc')).toBe(false);
    // An empty key is a deliberate off switch, not a malformed one.
    expect(isValidKeyForPlatform('ios', '')).toBe(true);
  });
});

describe('unlockForSale — which platform sells the one-time unlock', () => {
  it('is false on Android even though Android HAS a key', async () => {
    // The distinction that matters: `purchasesSupported` means "this platform has a
    // key", `unlockForSale` means "this platform sells THIS product". Android's key
    // is for a product of its own; no Play product maps to ios_unlock. Without this
    // split, the safety of ~23 gated screens on Android would rest on a RevenueCat
    // dashboard configuration rather than on anything in the code.
    const rc = await loadFor('android');
    expect(rc.purchasesSupported).toBe(true);
    expect(rc.unlockForSale).toBe(false);
  });

  it('is false on the web', async () => {
    expect((await loadFor('web')).unlockForSale).toBe(false);
  });

  it('is false on iOS today, because the key is still empty', async () => {
    expect((await loadFor('ios')).unlockForSale).toBe(false);
  });
});

describe('no entitlement-to-tier mapping', () => {
  it('does not export tierFromEntitlements', async () => {
    // It mapped a RevenueCat entitlement onto User['tier'], and tier is the
    // server's rate limit. See utils/entitlements.ts.
    const rc = await loadFor('ios');
    expect(rc).not.toHaveProperty('tierFromEntitlements');
  });
});
