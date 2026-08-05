import { isNativePlatform } from './platform';

const ADSENSE_CLIENT = 'ca-pub-9760203099492988';
const PLAUSIBLE_DOMAIN = 'symmetry.tendrid.us';

let injected = false;

/**
 * Injects web-only third-party scripts (Google AdSense, Plausible analytics)
 * into <head> at runtime.
 *
 * These tags used to live statically in index.html, but that HTML is bundled
 * into the Capacitor Android app, where:
 * - AdSense must not load (AdSense is a web-only product; loading it inside
 *   an Android app violates AdSense program policy and risks Play rejection),
 * - analytics should not run (the Android app ships without analytics).
 *
 * Web behavior is unchanged: the same scripts load with the same attributes,
 * just appended from JS instead of parsed from static HTML.
 */
export function injectWebOnlyScripts(): void {
  if (injected || isNativePlatform || typeof document === 'undefined') return;
  injected = true;

  // AdSense account meta tag (site verification for AdSense).
  const adsenseMeta = document.createElement('meta');
  adsenseMeta.name = 'google-adsense-account';
  adsenseMeta.content = ADSENSE_CLIENT;
  document.head.appendChild(adsenseMeta);

  // Plausible analytics.
  const plausible = document.createElement('script');
  plausible.defer = true;
  plausible.dataset.domain = PLAUSIBLE_DOMAIN;
  plausible.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(plausible);

  // Google AdSense.
  const adsense = document.createElement('script');
  adsense.async = true;
  adsense.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  adsense.crossOrigin = 'anonymous';
  document.head.appendChild(adsense);
}
