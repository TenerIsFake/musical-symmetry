// Links from catalog/atlas entries into the owner's offline Wikipedia (Kiwix).
// Uses *search* (not a direct article path) because stylized fx names like
// "FET Compressor (1176-style)" have no exact Wikipedia title — search always lands.
// Base + book id are build-time configurable (Vite env), with sensible defaults.
// NOTE: Kiwix is LAN-only (SRV-1 10.0.0.195:8089, not tunneled) — links resolve on
// the home network; off-network they won't reach unless Kiwix is exposed.
const KIWIX_BASE: string =
  (import.meta as any).env?.VITE_KIWIX_BASE || 'http://10.0.0.195:8089';
const WIKI_BOOK_ID: string =
  (import.meta as any).env?.VITE_KIWIX_WIKI_ID || '53a8f711-f7f9-ec23-08fc-38fcf579ba32';

/** Book-scoped Kiwix Wikipedia search URL for a gear/fx/instrument name. */
export function kiwixWikiUrl(name: string): string {
  return `${KIWIX_BASE}/search?books.id=${encodeURIComponent(WIKI_BOOK_ID)}&pattern=${encodeURIComponent(name)}`;
}
