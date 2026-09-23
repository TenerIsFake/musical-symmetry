import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  initRevenueCat,
  unlockForSale,
  getCustomerInfo,
  getUnlockPackage,
  purchasePackage,
  restorePurchases,
} from '../utils/revenuecat';
import { hasDeviceUnlock, canUseOnDevice, type Tier } from '../utils/entitlements';
import { useUser } from './UserContext';

export interface DeviceUnlockState {
  /** Whether this build can sell the unlock at all. False on web, and on any native platform whose SDK key is still empty. */
  supported: boolean;
  /** Whether this device holds the unlock. */
  unlocked: boolean;
  /**
   * The store's own localized price, e.g. "$12.99" or "£10.99". Null until the
   * offering loads, or when there is nothing to sell.
   *
   * Never hardcode this: App Store prices are per-storefront, and US$12.99 is one
   * tier of many. Showing a price the store will not charge is its own rejection.
   */
  priceString: string | null;
  /** True while the initial entitlement check, a purchase, or a restore is in flight. */
  busy: boolean;
  /** Set when a purchase or restore failed for a reason worth showing. Cancellation is not an error. */
  error: string | null;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
}

/**
 * The inert default, which is also exactly right for the web: nothing to sell,
 * nothing unlocked. A component rendered outside the provider therefore behaves
 * like the web rather than throwing, and every gate falls back to the account tier.
 */
const INERT: DeviceUnlockState = {
  supported: false,
  unlocked: false,
  priceString: null,
  busy: false,
  error: null,
  purchase: async () => {},
  restore: async () => {},
};

const Ctx = createContext<DeviceUnlockState>(INERT);

/**
 * Last known unlock state, so a returning purchaser is not briefly treated as a
 * non-purchaser on every cold start while StoreKit answers.
 *
 * Without this the gates render the free-tier answer first and flip a moment later,
 * which is merely ugly on a button but destructive where a screen acts on the gate:
 * `EuclideanPage` clamps the step count to the free maximum in an effect, and that
 * clamp is not undone when the unlock lands.
 *
 * Yes, a determined user can write `true` here. That is acceptable and deliberate:
 * this flag opens only capability that runs on the device at zero marginal cost. It
 * can never widen server quota — see `canUseServer` in utils/entitlements.ts — so the
 * worst case is one person getting local features free, not a bill. Anything that
 * costs money to serve is verified server-side against the account tier.
 */
const CACHE_KEY = 'chrometria.deviceUnlock.v1';

function cachedUnlock(): boolean {
  try {
    return window.localStorage.getItem(CACHE_KEY) === 'true';
  } catch {
    return false; // private mode, blocked storage — treat as not unlocked
  }
}

function cacheUnlock(value: boolean): void {
  try {
    window.localStorage.setItem(CACHE_KEY, String(value));
  } catch {
    /* storage unavailable; the entitlement is re-read next launch anyway */
  }
}

function message(e: unknown, fallback: string): string {
  const m = (e as { message?: unknown })?.message;
  return typeof m === 'string' && m ? m : fallback;
}

/** RevenueCat reports a user-cancelled purchase as an error; it is not one. */
function wasCancelled(e: unknown): boolean {
  const err = e as { userCancelled?: unknown; message?: unknown };
  if (err?.userCancelled === true) return true;
  return typeof err?.message === 'string' && /cancel/i.test(err.message);
}

/**
 * Holds the one-time on-device unlock for the whole app
 * (docs/specs/2026-09-21-ios-native-v1-design.md §6.1).
 *
 * This is a provider rather than a plain hook because roughly forty screens consult
 * the unlock, and each mount of the hook body would be its own StoreKit round trip.
 *
 * It deliberately exposes a capability flag and nothing tier-shaped. The unlock
 * opens features that run on the device; it must never widen the account's server
 * quota, so nothing here touches `User['tier']` or the API.
 */
export function DeviceUnlockProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlockedState] = useState(unlockForSale && cachedUnlock());
  const setUnlocked = useCallback((value: boolean) => {
    setUnlockedState(value);
    cacheUnlock(value);
  }, []);
  const [priceString, setPriceString] = useState<string | null>(null);
  const [busy, setBusy] = useState(unlockForSale);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unlockForSale) return;
    let live = true;
    // Configured anonymously, on purpose. The unlock is a property of the Apple ID
    // that paid for it, not of a Chrometria account: anonymous use must keep working
    // (Apple 5.1.1(v)), and a second device recovers it through Restore Purchases,
    // which is the model Apple expects for a non-consumable.
    const ready = initRevenueCat();
    ready
      .then(getUnlockPackage)
      .then(pkg => {
        const price = (pkg as { product?: { priceString?: unknown } } | null)?.product?.priceString;
        if (live && typeof price === 'string') setPriceString(price);
      })
      .catch(() => { /* no offering means nothing to price */ });
    ready
      .then(getCustomerInfo)
      .then(info => { if (live) setUnlocked(hasDeviceUnlock(info)); })
      .catch(() => { /* no entitlement info is the same as no entitlement */ })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, []);

  const purchase = useCallback(async () => {
    if (!unlockForSale) return;
    setBusy(true);
    setError(null);
    try {
      const pkg = await getUnlockPackage();
      if (!pkg) {
        // The product exists in App Store Connect but is not in the offering's
        // first package — indistinguishable, from here, from no product at all.
        setError('This purchase is not available right now. Please try again later.');
        return;
      }
      setUnlocked(hasDeviceUnlock(await purchasePackage(pkg)));
    } catch (e) {
      if (!wasCancelled(e)) setError(message(e, 'The purchase could not be completed.'));
    } finally {
      setBusy(false);
    }
  }, []);

  const restore = useCallback(async () => {
    if (!unlockForSale) return;
    setBusy(true);
    setError(null);
    try {
      const info = await restorePurchases();
      const ok = hasDeviceUnlock(info);
      setUnlocked(ok);
      if (!ok) setError('No previous purchase was found for this Apple ID.');
    } catch (e) {
      setError(message(e, 'Could not restore purchases.'));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <Ctx.Provider
      value={{ supported: unlockForSale, unlocked, priceString, busy, error, purchase, restore }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDeviceUnlockState(): DeviceUnlockState {
  return useContext(Ctx);
}

/**
 * The gate for capability that runs on the device.
 *
 * ```ts
 * const allow = useOnDeviceGate();
 * if (allow('pro')) { /* the Neo-Riemannian transforms *\/ }
 * ```
 *
 * ⚠️ Use this ONLY where opening the gate costs nothing to serve — pure computation
 * via `@musical-symmetry/core`, Web Audio, Web MIDI, canvas/D3, Blob downloads,
 * localStorage. Anything that reaches the API stays on `canUseServer(tier, required)`,
 * which takes no unlock and must never grow one: that absence is what keeps a
 * US$12.99 one-time purchase from buying an unbounded server bill.
 */
export function useOnDeviceGate(): (required: Tier) => boolean {
  const { user } = useUser();
  const { unlocked } = useDeviceUnlockState();
  const tier: Tier = user?.tier ?? 'free';
  return useCallback((required: Tier) => canUseOnDevice(tier, required, unlocked), [tier, unlocked]);
}
