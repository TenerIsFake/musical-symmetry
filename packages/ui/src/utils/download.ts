import { isNativePlatform } from './platform';

/**
 * Save a file, on the web and inside the native app.
 *
 * ⚠️ THE REASON THIS EXISTS. Every export in this app used the same five lines:
 * make a Blob, `URL.createObjectURL`, click a synthetic `<a download>`, revoke.
 * That works in a browser and is **silently inert in WKWebView** — which is what
 * Capacitor runs on iOS, and what every iOS browser is forced to use. No file, no
 * error, no console warning. The button appears to work and nothing happens.
 *
 * That was not a cosmetic gap: the exports are features the US$12.99 unlock
 * advertises. A reviewer who buys it and finds them dead is a Guideline 2.1
 * rejection, and it is the same shape as "a key with no product behind it".
 *
 * On native the file is written to the cache directory and handed to the system
 * share sheet, which is the iOS idiom — the user picks Files, Mail, AirDrop,
 * whatever. The web path is byte-for-byte what it always was.
 *
 * `src/utils/__tests__/download-sites.test.ts` fails if any other file goes back
 * to rolling its own anchor click.
 */

async function toBase64(data: Blob): Promise<string> {
  const buf = new Uint8Array(await data.arrayBuffer());
  // Chunked so a large export cannot blow the argument limit of String.fromCharCode.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function saveInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param content the file body — a string, or a Blob for binary exports (MIDI, PDF, SVG).
 * @param filename what to call it, extension included.
 * @param mimeType only used when `content` is a string; a Blob carries its own type.
 * @returns true if the file was handed off, false if the user cancelled the share sheet
 *          or the native path was unavailable and nothing happened.
 */
export async function saveFile(
  content: string | Blob,
  filename: string,
  mimeType = 'text/plain',
): Promise<boolean> {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;

  if (!isNativePlatform) {
    saveInBrowser(blob, filename);
    return true;
  }

  try {
    // Imported lazily: these are native plugins with no web implementation worth
    // shipping, and the browser bundle should not carry them.
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    // Cache, not Documents: these are transient artifacts the user is about to
    // send somewhere. Documents would accumulate files nothing ever cleans up.
    await Filesystem.writeFile({
      path: filename,
      data: await toBase64(blob),
      directory: Directory.Cache,
    });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({ title: filename, url: uri });
    return true;
  } catch (e) {
    // A cancelled share sheet rejects. That is a user choice, not a failure, and
    // must not surface as an error — but a genuine failure should be visible.
    const msg = (e as { message?: string })?.message ?? '';
    if (/cancel/i.test(msg)) return false;
    console.error('saveFile failed on native:', e);
    return false;
  }
}
