import type { User } from '../context/UserContext';

export type Tier = User['tier'];

/**
 * The entitlement the one-time iOS purchase grants.
 *
 * Deliberately NOT one of `pro_access` / `research_access` / `student_access`.
 * Those name subscription tiers, and tier is what the server's `TIER_LIMITS`
 * (packages/analyzer/src/auth/middleware.ts) reads to set a per-day API quota.
 * Granting one of them for a US$12.99 one-time purchase would sell Pro's server
 * quota forever for less than two months of the subscription.
 *
 * See docs/specs/2026-09-21-ios-native-v1-design.md §6.1.
 */
export const DEVICE_UNLOCK_ENTITLEMENT = 'ios_unlock';

const RANK: Record<Tier, number> = { free: 0, student: 1, pro: 2, research: 3 };

/**
 * Whether this customer holds the device unlock.
 *
 * Takes `unknown` because the only caller passes RevenueCat's `CustomerInfo`,
 * whose type lives behind a dynamic import that does not resolve on the web.
 */
export function hasDeviceUnlock(customerInfo: unknown): boolean {
  const active = (customerInfo as { entitlements?: { active?: Record<string, unknown> } })
    ?.entitlements?.active;
  return !!active?.[DEVICE_UNLOCK_ENTITLEMENT];
}

/**
 * Gate for capability that runs entirely on the device — pure computation via
 * `@musical-symmetry/core`, Web Audio, Web MIDI, canvas/D3, localStorage.
 *
 * The device unlock opens these, because they cost nothing to serve. That is the
 * whole argument for charging once rather than monthly.
 */
export function canUseOnDevice(tier: Tier, required: Tier, deviceUnlocked: boolean): boolean {
  return deviceUnlocked || RANK[tier] >= RANK[required];
}

/**
 * Gate for capability that costs server time — anything that reaches the API.
 *
 * ⚠️ This takes no unlock parameter, and must never grow one. That absence is the
 * only thing standing between a one-time purchase and an unbounded server bill:
 * a call site cannot leak what it cannot pass. If you are here because you want
 * to open a server-backed feature for an iOS purchaser, the answer is no — read
 * §6.1 of the design record, then sell them a subscription.
 */
export function canUseServer(tier: Tier, required: Tier): boolean {
  return RANK[tier] >= RANK[required];
}
