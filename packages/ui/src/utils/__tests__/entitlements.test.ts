/**
 * The iOS unlock must never become server quota.
 *
 * The design record (docs/specs/2026-09-21-ios-native-v1-design.md §6.1) originally
 * had the $12.99 one-time purchase grant the `pro_access` entitlement, with
 * "effective tier = max(server tier, RevenueCat entitlement)". `pro_access` maps to
 * User['tier'], and tier is what the server's TIER_LIMITS reads — so that priced
 * 1,000 classify calls a day, forever, at $12.99 against $7/month on the web.
 *
 * The fix is not a cheaper price. It is that a device purchase and an account tier
 * are separate axes, and the code must make the leak *unrepresentable*: `canUseServer`
 * does not accept the unlock at all, so no call site can pass it by mistake.
 */
import { describe, it, expect } from 'vitest';
import * as entitlements from '../entitlements';
import {
  DEVICE_UNLOCK_ENTITLEMENT,
  hasDeviceUnlock,
  canUseOnDevice,
  canUseServer,
} from '../entitlements';

/** The shape RevenueCat's CustomerInfo has in the part we read. */
const withEntitlements = (...names: string[]) => ({
  entitlements: { active: Object.fromEntries(names.map(n => [n, { isActive: true }])) },
});

describe('the unlock entitlement', () => {
  it('is its own name, not a tier entitlement', () => {
    expect(DEVICE_UNLOCK_ENTITLEMENT).toBe('ios_unlock');
    expect(['pro_access', 'research_access', 'student_access']).not.toContain(
      DEVICE_UNLOCK_ENTITLEMENT,
    );
  });

  it('is recognised when active', () => {
    expect(hasDeviceUnlock(withEntitlements('ios_unlock'))).toBe(true);
  });

  it('is NOT granted by a tier entitlement', () => {
    // If someone wires the ASC product to pro_access by mistake, this fails loudly
    // rather than quietly handing out server quota.
    expect(hasDeviceUnlock(withEntitlements('pro_access'))).toBe(false);
    expect(hasDeviceUnlock(withEntitlements('research_access'))).toBe(false);
    expect(hasDeviceUnlock(withEntitlements('student_access'))).toBe(false);
  });

  it('is absent for a customer with nothing, and for junk input', () => {
    expect(hasDeviceUnlock(withEntitlements())).toBe(false);
    expect(hasDeviceUnlock(null)).toBe(false);
    expect(hasDeviceUnlock(undefined)).toBe(false);
    expect(hasDeviceUnlock({})).toBe(false);
    expect(hasDeviceUnlock({ entitlements: {} })).toBe(false);
  });
});

describe('canUseOnDevice — the unlock opens these', () => {
  it('opens a pro-gated on-device feature for a free account that bought the unlock', () => {
    expect(canUseOnDevice('free', 'pro', true)).toBe(true);
  });

  it('keeps it shut for a free account without the unlock', () => {
    expect(canUseOnDevice('free', 'pro', false)).toBe(false);
  });

  it('still respects the subscription when there is no unlock', () => {
    expect(canUseOnDevice('pro', 'pro', false)).toBe(true);
    expect(canUseOnDevice('research', 'pro', false)).toBe(true);
    expect(canUseOnDevice('student', 'pro', false)).toBe(false);
  });

  it('opens everything free-tier regardless', () => {
    expect(canUseOnDevice('free', 'free', false)).toBe(true);
  });
});

describe('canUseServer — the unlock must not reach these', () => {
  it('cannot even be told about the unlock', () => {
    // The structural guarantee: the leak is unrepresentable because there is no
    // parameter to pass it through. A third argument would mean someone added one.
    expect(canUseServer.length).toBe(2);
  });

  it('gates purely on the account tier', () => {
    expect(canUseServer('free', 'pro')).toBe(false);
    expect(canUseServer('pro', 'pro')).toBe(true);
    expect(canUseServer('research', 'pro')).toBe(true);
    expect(canUseServer('student', 'pro')).toBe(false);
  });
});

describe('no entitlement-to-tier mapping exists', () => {
  it('does not export tierFromEntitlements or anything like it', () => {
    // The function this replaces. Its return type was User['tier'], which is
    // exactly the leak; a reintroduction should fail here, not in production.
    expect(entitlements).not.toHaveProperty('tierFromEntitlements');
    const tierish = Object.keys(entitlements).filter(k => /tier/i.test(k) && /entitl/i.test(k));
    expect(tierish).toEqual([]);
  });
});
