/**
 * Back-compat entry point for the on-device unlock.
 *
 * The state itself lives in `context/DeviceUnlockContext` so the app makes one
 * StoreKit round trip rather than one per screen that consults it.
 */
export { useDeviceUnlockState as useDeviceUnlock } from '../context/DeviceUnlockContext';
export type { DeviceUnlockState } from '../context/DeviceUnlockContext';
