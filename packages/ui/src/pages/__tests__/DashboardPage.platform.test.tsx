/**
 * Two invariants that pull in opposite directions on the same screen, and are
 * each a store rejection if broken:
 *
 *   - Account deletion MUST be reachable inside the native app
 *     (Apple Guideline 5.1.1(v)).
 *   - Purchase UI for digital goods MUST NOT be, and must not link out
 *     (Google Play's payments policy; Apple Guideline 3.1.1).
 *
 * `DashboardPage` gates the purchase controls behind `isNativePlatform`, and
 * the deletion block sits just outside that branch. Nothing about the source
 * makes that obvious — moving the block a few lines up, inside the ternary,
 * would silently remove deletion from Android and iOS while every other test
 * stayed green. This renders the page in native mode and asserts both.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// The shape /api/auth/me returns; the page reads all of it during render.
const USER = {
  email: 'someone@example.com',
  tier: 'free' as const,
  apiKey: 'test-key',
  usage: {
    classifications: { used: 1, limit: 100 },
    fileAnalyses: { used: 0, limit: 10 },
    shareCards: { used: 0, limit: 5 },
  },
};

type Platform = 'ios' | 'android' | 'web';

async function renderDashboard(
  { platform, sellable = false }: { platform: Platform; sellable?: boolean },
) {
  vi.resetModules();
  vi.doMock('../../utils/platform', () => ({
    isNativePlatform: platform !== 'web',
    platform,
  }));
  // The unlock card's own behaviour is covered by
  // components/__tests__/DeviceUnlockCard.test.tsx. Here we only care about
  // WHERE it appears, so the hook is stubbed to the two states that matter:
  // nothing to sell (the real state today, iOS key still empty) and sellable.
  vi.doMock('../../hooks/useDeviceUnlock', () => ({
    useDeviceUnlock: () => ({
      supported: sellable,
      unlocked: false,
      priceString: sellable ? '$12.99' : null,
      busy: false,
      error: null,
      purchase: vi.fn(),
      restore: vi.fn(),
    }),
  }));
  // The page and its hooks all read from the same API. Each endpoint must be
  // given its REAL response shape, not a bare {}.
  //
  // A previous version returned {} for everything but /api/auth/me and passed
  // locally three times, then failed in CI: useAchievements does
  // `setAchievements(data.achievements)` with no guard, so `{}` sets it to
  // undefined and the render throws on `.length`. Whether that happened at all
  // depended on which promise resolved before the assertion — a timing-
  // dependent test, which is worse than no test.
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const href = String(url);
    if (href.includes('/api/auth/me')) {
      return Promise.resolve({ ok: true, json: async () => USER });
    }
    if (href.includes('/api/achievements')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ achievements: [], earned: 0, total: 0 }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }));
  const { default: DashboardPage } = await import('../DashboardPage');
  render(<DashboardPage />);
  await waitFor(() => expect(screen.getByText(USER.email)).toBeInTheDocument());
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock('../../utils/platform');
  vi.doUnmock('../../hooks/useDeviceUnlock');
});

describe('DashboardPage platform gating', () => {
  it('offers account deletion in the NATIVE app — Apple 5.1.1(v)', async () => {
    await renderDashboard({ platform: 'android' });
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
  });

  it('offers account deletion on the web too', async () => {
    await renderDashboard({ platform: 'web' });
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
  });

  it('shows NO purchase control in the native app — Play payments policy', async () => {
    await renderDashboard({ platform: 'android' });
    expect(screen.queryByText(/upgrade to pro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/upgrade to research/i)).not.toBeInTheDocument();
    // and no link out to an external purchase flow
    for (const link of screen.queryAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/billing|checkout|portal/i);
    }
  });

  it('does show purchase controls on the web', async () => {
    await renderDashboard({ platform: 'web' });
    expect(screen.getByText(/upgrade to pro/i)).toBeInTheDocument();
  });
});

/**
 * iOS is the one platform that both MUST sell in-app (Apple 3.1.1, if it sells at
 * all) and MUST NOT point anywhere else. Android's neutral "manage it on the web"
 * note is correct for Play and wrong for Apple, so the two native platforms cannot
 * share a branch — which is exactly the kind of thing that looks fine in a diff.
 */
describe('DashboardPage on iOS', () => {
  it('never names an external purchase location — Apple 3.1.1', async () => {
    await renderDashboard({ platform: 'ios', sellable: true });
    expect(screen.queryByText(/symmetry\.tendrid\.us/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/on the web/i)).not.toBeInTheDocument();
  });

  it('offers no Stripe checkout — that is the external flow 3.1.1 forbids', async () => {
    await renderDashboard({ platform: 'ios', sellable: true });
    expect(screen.queryByText(/upgrade to pro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/upgrade to research/i)).not.toBeInTheDocument();
    for (const link of screen.queryAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/billing|checkout|portal/i);
    }
  });

  it('shows the in-app unlock when there is something to sell', async () => {
    await renderDashboard({ platform: 'ios', sellable: true });
    expect(screen.getByTestId('device-unlock')).toBeInTheDocument();
  });

  it('shows NO purchase surface while the iOS key is still empty — Apple 2.1', async () => {
    // Today's real state. A purchase control that cannot complete is a rejection.
    await renderDashboard({ platform: 'ios', sellable: false });
    expect(screen.queryByTestId('device-unlock')).not.toBeInTheDocument();
    expect(screen.queryByText(/unlock/i)).not.toBeInTheDocument();
  });

  it('still offers account deletion — Apple 5.1.1(v)', async () => {
    await renderDashboard({ platform: 'ios', sellable: false });
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
  });

  it('does not leak the unlock card onto Android, which has no product', async () => {
    await renderDashboard({ platform: 'android', sellable: false });
    expect(screen.queryByTestId('device-unlock')).not.toBeInTheDocument();
  });
});
