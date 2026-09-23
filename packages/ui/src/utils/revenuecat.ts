import { isNativePlatform, platform } from './platform';
import { DEVICE_UNLOCK_ENTITLEMENT, hasDeviceUnlock } from './entitlements';

export { DEVICE_UNLOCK_ENTITLEMENT, hasDeviceUnlock };

/**
 * RevenueCat SDK keys, one per native platform.
 *
 * ⚠️ An EMPTY key is a deliberate off switch, not an oversight. `purchasesSupported`
 * is derived from it, and every purchase surface is gated on that, so a platform
 * with no key shows no upsell at all.
 *
 * That matters because of a sequencing trap Yissian walked into: every intermediate
 * state between "key set" and "store product live" is a contradiction. A key with no
 * product behind it is a Guideline 2.1 non-functional purchase; a product with no key
 * is an invisible upsell. So: create the App Store Connect product FIRST, wire it into
 * the offering's first package, and set `ios` here LAST, in the change that ships it.
 *
 * `src/utils/__tests__/revenuecat.test.ts` pins `ios` as empty and will fail when you
 * fill it in. That failure is the checklist, not an obstacle.
 */
const API_KEYS: Record<'ios' | 'android', string> = {
  android: 'goog_cDCGonBjgmxucQTUcuXfaTKmHiz',
  ios: '',
};

/** RevenueCat namespaces its public SDK keys by store. */
const KEY_PREFIX: Record<'ios' | 'android', string> = { ios: 'appl_', android: 'goog_' };

/** An empty key is valid — it means "this platform sells nothing yet". */
export function isValidKeyForPlatform(p: 'ios' | 'android', key: string): boolean {
  return key === '' || key.startsWith(KEY_PREFIX[p]);
}

export const purchaseApiKey: string =
  platform === 'ios' || platform === 'android' ? API_KEYS[platform] : '';

/**
 * Whether this build can sell anything through the store. False on the web (Stripe
 * sells there) and false on any native platform whose key is still empty.
 */
export const purchasesSupported: boolean = isNativePlatform && purchaseApiKey !== '';

/**
 * Whether THIS platform sells the one-time on-device unlock.
 *
 * Narrower than `purchasesSupported` on purpose. Android has a live `goog_` key for a
 * product of its own, so `purchasesSupported` is true there — but the unlock is an iOS
 * non-consumable and there is no Play product behind it. Without this, the safety of
 * the whole gating sweep would rest on a RevenueCat dashboard never mapping
 * `ios_unlock` to a Play product, rather than on anything in the code.
 *
 * It also keeps a shipped Android app from newly configuring the SDK at startup.
 */
export const unlockForSale: boolean = purchasesSupported && platform === 'ios';

let initialized = false;

async function getPurchases() {
  if (!unlockForSale) return null;
  try {
    const mod = await import('@revenuecat/purchases-capacitor');
    return mod.Purchases;
  } catch {
    return null;
  }
}

export async function initRevenueCat(userId?: string) {
  if (initialized || !unlockForSale) return;
  const Purchases = await getPurchases();
  if (!Purchases) return;
  await Purchases.configure({ apiKey: purchaseApiKey, appUserID: userId || undefined });
  initialized = true;
}

export async function getOfferings() {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  return await Purchases.getOfferings();
}

export async function purchasePackage(pkg: unknown) {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  const result = await Purchases.purchasePackage({ aPackage: pkg as never });
  return result.customerInfo;
}

export async function restorePurchases() {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
}

export async function getCustomerInfo() {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo;
}

/**
 * The first package of the current offering — what the purchase button buys.
 *
 * There is no hardcoded product id on purpose, which means a store product that
 * exists but is missing from the offering's FIRST package fails exactly like a
 * missing product. Yissian has the same shape; it is the single most common way
 * for a correctly-created product to be unsellable.
 */
export async function getUnlockPackage(): Promise<unknown | null> {
  const offerings = await getOfferings();
  return offerings?.current?.availablePackages?.[0] ?? null;
}
