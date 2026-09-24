import { Capacitor } from '@capacitor/core';

/**
 * True when running inside the Capacitor native shell (Android/iOS app),
 * false in any ordinary browser (including mobile browsers).
 *
 * Use this to gate native-only behavior and — importantly — to HIDE
 * web-only monetization surfaces (Stripe checkout, AdSense/analytics
 * scripts) inside the app, per Google Play policy.
 */
export const isNativePlatform: boolean = Capacitor.isNativePlatform();

/**
 * Which shell the app is running in: 'ios', 'android', or 'web'.
 *
 * `isNativePlatform` is not enough once iOS exists. The two native platforms
 * differ on the thing that matters most here: Android must show no purchase UI
 * at all (Play payments policy for digital goods sold elsewhere), while iOS must
 * sell through IAP and must not name an external purchase location.
 */
export const platform: 'ios' | 'android' | 'web' =
  Capacitor.getPlatform() as 'ios' | 'android' | 'web';
