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

async function renderDashboard({ native }: { native: boolean }) {
  vi.resetModules();
  vi.doMock('../../utils/platform', () => ({
    isNativePlatform: native,
    platform: native ? 'android' : 'web',
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
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('DashboardPage platform gating', () => {
  it('offers account deletion in the NATIVE app — Apple 5.1.1(v)', async () => {
    await renderDashboard({ native: true });
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
  });

  it('offers account deletion on the web too', async () => {
    await renderDashboard({ native: false });
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
  });

  it('shows NO purchase control in the native app — Play payments policy', async () => {
    await renderDashboard({ native: true });
    expect(screen.queryByText(/upgrade to pro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/upgrade to research/i)).not.toBeInTheDocument();
    // and no link out to an external purchase flow
    for (const link of screen.queryAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/billing|checkout|portal/i);
    }
  });

  it('does show purchase controls on the web', async () => {
    await renderDashboard({ native: false });
    expect(screen.getByText(/upgrade to pro/i)).toBeInTheDocument();
  });
});
