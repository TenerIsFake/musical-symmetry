/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSENSE_CLIENT?: string;
  /** Preferred override for the analyzer API origin (see src/utils/apiBase.ts). */
  readonly VITE_API_BASE?: string;
  /** Legacy override for the analyzer API origin; VITE_API_BASE wins. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
