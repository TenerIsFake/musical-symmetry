/**
 * The iOS unlock card, and the three store rules it sits between.
 *
 *  - Apple 3.1.1: digital goods sell through IAP, and the app must not point at an
 *    external purchase location.
 *  - Apple 3.1.1 again: a non-consumable MUST offer Restore Purchases.
 *  - Apple 2.1: a purchase control that cannot complete is a rejection, so the card
 *    must render nothing at all while the platform has no SDK key.
 *
 * The price is never hardcoded: App Store prices are per-storefront, and $12.99 is
 * only the US tier. Whatever the store reports is what the user is shown.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

type Mock = {
  supported: boolean;
  unlocked?: boolean;
  priceString?: string | null;
  busy?: boolean;
  error?: string | null;
};

async function renderCard(state: Mock) {
  vi.resetModules();
  vi.doMock('../../hooks/useDeviceUnlock', () => ({
    useDeviceUnlock: () => ({
      supported: state.supported,
      unlocked: state.unlocked ?? false,
      priceString: state.priceString ?? null,
      busy: state.busy ?? false,
      error: state.error ?? null,
      purchase: vi.fn(),
      restore: vi.fn(),
    }),
  }));
  const { default: DeviceUnlockCard } = await import('../DeviceUnlockCard');
  return render(<DeviceUnlockCard />);
}

afterEach(() => { vi.resetModules(); vi.doUnmock('../../hooks/useDeviceUnlock'); });

describe('when the platform cannot sell (no SDK key yet)', () => {
  it('renders nothing at all — Apple 2.1, no dead purchase control', async () => {
    const { container } = await renderCard({ supported: false });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('when the unlock is for sale', () => {
  it('shows the price the store reported, not a hardcoded one', async () => {
    await renderCard({ supported: true, priceString: '£10.99' });
    await waitFor(() => expect(screen.getByRole('button', { name: /£10\.99/ })).toBeInTheDocument());
    expect(screen.queryByText(/\$12\.99/)).not.toBeInTheDocument();
  });

  it('offers Restore Purchases — required for a non-consumable', async () => {
    await renderCard({ supported: true, priceString: '$12.99' });
    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
  });

  it('points at no external purchase location — Apple 3.1.1', async () => {
    const { container } = await renderCard({ supported: true, priceString: '$12.99' });
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.textContent ?? '').not.toMatch(/symmetry\.tendrid\.us|\.com|website|browser|online/i);
  });

  it('promises only on-device capability, never server features', async () => {
    await renderCard({ supported: true, priceString: '$12.99' });
    const text = (screen.getByTestId('device-unlock').textContent ?? '').toLowerCase();
    expect(text).toMatch(/this device/);
    // The things the unlock must NOT be read as including. See §6.1.
    for (const server of ['api', 'classroom', 'corpus', 'bulk', 'unlimited']) {
      expect(text).not.toContain(server);
    }
  });

  it('surfaces an error when one is set', async () => {
    await renderCard({ supported: true, error: 'The purchase could not be completed.' });
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be completed/i);
  });
});

describe('once unlocked', () => {
  it('stops selling and says so', async () => {
    await renderCard({ supported: true, unlocked: true, priceString: '$12.99' });
    expect(screen.queryByRole('button', { name: /\$12\.99/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('device-unlock').textContent ?? '').toMatch(/unlocked/i);
  });

  it('still offers restore, for the same Apple ID on a new device', async () => {
    await renderCard({ supported: true, unlocked: true });
    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
  });
});
