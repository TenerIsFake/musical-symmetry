import { useDeviceUnlock } from '../hooks/useDeviceUnlock';

/**
 * The one-time on-device unlock, sold through StoreKit via RevenueCat.
 *
 * Three store rules shape this component, and each of them is a rejection:
 *
 *  - **Apple 2.1** — a purchase control that cannot complete. So when the platform
 *    has no SDK key, or there is no offering behind it, this renders NOTHING. The
 *    `supported` flag comes from whether the key is filled in; see utils/revenuecat.ts.
 *  - **Apple 3.1.1** — a non-consumable must offer Restore Purchases, and the app
 *    must not point the user at an external place to buy. There are deliberately no
 *    links here and no mention of the website.
 *  - **The pricing rule of our own** (design record §6.1) — this unlock buys
 *    capability that runs on the device. It must never be described, or implemented,
 *    as granting server quota; that stays on the subscription, because it costs money
 *    to serve. The copy is written to not over-promise, and
 *    `__tests__/DeviceUnlockCard.test.tsx` asserts it.
 */
export default function DeviceUnlockCard() {
  const { supported, unlocked, priceString, busy, error, purchase, restore } = useDeviceUnlock();

  if (!supported) return null;

  return (
    <div data-testid="device-unlock" className="mt-4 rounded-lg border border-gray-700 bg-gray-900/40 p-4">
      {unlocked ? (
        <p className="text-sm text-green-400">
          Unlocked on this device. Thank you — everything below runs offline, with no subscription.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-300">
            Unlock everything on this device: classifier, atlas, progressions, ear training, quiz,
            rhythm, tuning, live pitch detection and every visualisation. One payment, not a
            subscription — it all runs on this device, offline.
          </p>
          <button
            type="button"
            onClick={purchase}
            disabled={busy || !priceString}
            className="mt-3 px-4 py-2 bg-indigo-600 rounded text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {priceString ? `Unlock — ${priceString}` : 'Loading…'}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={restore}
        disabled={busy}
        className="mt-3 ml-0 sm:ml-3 px-4 py-2 bg-gray-700 rounded text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50 transition-colors"
      >
        Restore Purchases
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
