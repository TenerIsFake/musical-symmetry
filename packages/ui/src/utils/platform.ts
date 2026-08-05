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
