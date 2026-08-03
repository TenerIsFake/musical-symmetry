import { isNativePlatform } from './platform';

/**
 * Single source of truth for the analyzer API origin.
 *
 * - Web (dev server proxy or production behind nginx): same-origin, so ''
 *   and all requests use relative `/api/...` URLs.
 * - Native (Capacitor WebView, origin `https://localhost`): requests must be
 *   absolute, so we default to the production API origin. The analyzer's CORS
 *   allowlist and session cookie settings permit the Capacitor origin.
 * - Overridable at build time via VITE_API_BASE (preferred) or the legacy
 *   VITE_API_URL.
 */
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (isNativePlatform ? 'https://symmetry.tendrid.us' : '');

/** Convenience helper: apiUrl('/api/foo') -> `${API_BASE}/api/foo`. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/**
 * WebSocket URL for the analyzer API. Uses API_BASE when set (native app /
 * explicit override), otherwise derives from the current page origin
 * (same-origin web deployment or dev proxy).
 */
export function wsUrl(path: string): string {
  if (API_BASE) {
    return API_BASE.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + path;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${path}`;
}
