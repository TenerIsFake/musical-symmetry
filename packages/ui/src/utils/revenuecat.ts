import type { User } from '../context/UserContext';

const isNative = typeof (window as any).Capacitor !== 'undefined';

const API_KEY = 'goog_cDCGonBjgmxucQTUcuXfaTKmHiz';

let initialized = false;

async function getPurchases() {
  if (!isNative) return null;
  try {
    const mod = await import('@revenuecat/purchases-capacitor');
    return mod.Purchases;
  } catch {
    return null;
  }
}

export async function initRevenueCat(userId?: string) {
  if (initialized || !isNative) return;
  const Purchases = await getPurchases();
  if (!Purchases) return;
  await Purchases.configure({ apiKey: API_KEY, appUserID: userId || undefined });
  initialized = true;
}

export async function getOfferings() {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  return await Purchases.getOfferings();
}

export async function purchasePackage(pkg: any) {
  const Purchases = await getPurchases();
  if (!Purchases) return null;
  const result = await Purchases.purchasePackage({ aPackage: pkg });
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

export function tierFromEntitlements(info: any): User['tier'] | null {
  if (!info?.entitlements?.active) return null;
  const active = info.entitlements.active;
  if (active['research_access']) return 'research';
  if (active['pro_access']) return 'pro';
  if (active['student_access']) return 'student';
  return null;
}
