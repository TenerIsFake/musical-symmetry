/**
 * What the purchase actually buys, end to end.
 *
 * Twenty-odd screens call `useOnDeviceGate()` and almost none of them have a test
 * that renders them. This exercises the one thing they all share: given a customer
 * who holds `ios_unlock`, does a free account get the pro-gated on-device feature —
 * and given no unlock, does nothing change from today's behaviour?
 *
 * The second half is the one that protects the web app. `unlocked` is false in every
 * browser, so if these assertions ever diverge from the pre-change behaviour, the
 * sweep broke something for paying subscribers and non-payers alike.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { User } from '../UserContext';

const withUnlock = (...names: string[]) => ({
  entitlements: { active: Object.fromEntries(names.map(n => [n, { isActive: true }])) },
});

async function renderGate(
  { tier, customer, supported = true }:
  { tier: User['tier'] | null; customer: unknown; supported?: boolean },
) {
  vi.resetModules();
  vi.doMock('../../utils/revenuecat', () => ({
    purchasesSupported: supported,
    unlockForSale: supported,
    initRevenueCat: vi.fn(async () => {}),
    getUnlockPackage: vi.fn(async () => ({ product: { priceString: '$12.99' } })),
    getCustomerInfo: vi.fn(async () => customer),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
  }));
  vi.doMock('../UserContext', async () => ({
    ...(await vi.importActual<typeof import('../UserContext')>('../UserContext')),
    useUser: () => ({
      user: tier ? ({ id: 'u1', email: 'a@b.c', tier, hasApiKey: false } as User) : null,
      loading: false,
      refresh: () => {},
    }),
  }));
  const { DeviceUnlockProvider, useOnDeviceGate } = await import('../DeviceUnlockContext');

  function Probe() {
    const allow = useOnDeviceGate();
    return (
      <ul>
        <li data-testid="student">{String(allow('student'))}</li>
        <li data-testid="pro">{String(allow('pro'))}</li>
        <li data-testid="research">{String(allow('research'))}</li>
      </ul>
    );
  }

  render(<DeviceUnlockProvider><Probe /></DeviceUnlockProvider>);
  return (level: 'student' | 'pro' | 'research') => screen.getByTestId(level).textContent;
}

afterEach(() => { window.localStorage.clear(); vi.resetModules(); vi.doUnmock('../../utils/revenuecat'); vi.doUnmock('../UserContext'); });

describe('a free account that bought the unlock', () => {
  it('gets every on-device level', async () => {
    const at = await renderGate({ tier: 'free', customer: withUnlock('ios_unlock') });
    await waitFor(() => expect(at('pro')).toBe('true'));
    expect(at('student')).toBe('true');
    expect(at('research')).toBe('true');
  });
});

describe('without the unlock, nothing changes — this is the web and Android case', () => {
  it('leaves a free account exactly where it was', async () => {
    const at = await renderGate({ tier: 'free', customer: withUnlock(), supported: false });
    await waitFor(() => expect(at('student')).toBe('false'));
    expect(at('pro')).toBe('false');
    expect(at('research')).toBe('false');
  });

  it('leaves a pro subscriber exactly where they were', async () => {
    const at = await renderGate({ tier: 'pro', customer: withUnlock(), supported: false });
    await waitFor(() => expect(at('pro')).toBe('true'));
    expect(at('student')).toBe('true');
    expect(at('research')).toBe('false');
  });

  it('leaves a signed-out visitor on the free ladder', async () => {
    const at = await renderGate({ tier: null, customer: null, supported: false });
    await waitFor(() => expect(at('student')).toBe('false'));
  });
});

describe('a tier entitlement is not the unlock', () => {
  it('does not open on-device gates for a stray pro_access', async () => {
    // If the App Store product is ever wired to the wrong entitlement, the unlock
    // must simply not work — rather than working by granting a server tier.
    const at = await renderGate({ tier: 'free', customer: withUnlock('pro_access') });
    await waitFor(() => expect(at('student')).toBe('false'));
    expect(at('pro')).toBe('false');
  });
});
