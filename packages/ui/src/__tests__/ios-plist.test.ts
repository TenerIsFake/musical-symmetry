/**
 * The four Info.plist facts that decide whether a build is worth uploading.
 *
 * The one that matters most is the microphone. iOS does not warn, degrade, or
 * prompt when an app touches a protected resource with no purpose string — the
 * OS kills the process. The app calls getUserMedia from four screens, one of
 * which (live pitch detection) is named in the $12.99 unlock's own sales copy.
 * Nothing in the web build, the TypeScript, or an unsigned xcodebuild would
 * have told us; it fails first on a device, for a customer.
 *
 * So the first test below ties the plist to the CODE rather than asserting a
 * key in isolation: if the source reaches for the microphone, the purpose
 * string must exist. Delete the mic feature and the requirement lapses on its
 * own; add it back and the requirement returns.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const UI = resolve(__dirname, '../..');
const IOS = join(UI, 'ios/App');
const plistPath = join(IOS, 'App/Info.plist');

/** Minimal plist reader: <key>K</key> followed by its value node. jsdom gives us DOMParser. */
function plist(path: string): Document {
  return new DOMParser().parseFromString(readFileSync(path, 'utf8'), 'application/xml');
}

function valueAfterKey(doc: Document, key: string): Element | null {
  const keys = Array.from(doc.getElementsByTagName('key'));
  const k = keys.find(n => n.textContent === key);
  if (!k) return null;
  let sib = k.nextElementSibling;
  while (sib && sib.tagName === 'key') sib = sib.nextElementSibling;
  return sib;
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules') sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

const allSource = sourceFiles(join(UI, 'src')).map(f => readFileSync(f, 'utf8')).join('\n');

describe('Info.plist purpose strings', () => {
  it('declares NSMicrophoneUsageDescription, because the app asks for the microphone', () => {
    const asksForMic = /getUserMedia\s*\(\s*\{[^}]*audio\s*:\s*true/.test(allSource);
    expect(asksForMic).toBe(true); // if this ever goes false, drop the requirement below too

    const v = valueAfterKey(plist(plistPath), 'NSMicrophoneUsageDescription');
    expect(v, 'iOS terminates the app on first mic access without this key').not.toBeNull();
    // A non-empty, human sentence — App Review rejects placeholder purpose strings.
    expect((v!.textContent ?? '').trim().length).toBeGreaterThan(30);
  });

  it('does NOT claim camera use, since nothing asks for video', () => {
    // Guards the opposite error: over-declaring invites "why do you need this?"
    expect(/getUserMedia\s*\(\s*\{[^}]*video\s*:\s*true/.test(allSource)).toBe(false);
    expect(valueAfterKey(plist(plistPath), 'NSCameraUsageDescription')).toBeNull();
  });
});

describe('Info.plist upload hygiene', () => {
  it('answers the export-compliance question up front', () => {
    // Absent, every upload parks behind a manual question in App Store Connect
    // before it can go to TestFlight. Yissian sets this false in app.json.
    const v = valueAfterKey(plist(plistPath), 'ITSAppUsesNonExemptEncryption');
    expect(v).not.toBeNull();
    expect(v!.tagName).toBe('false');
  });

  it('does not require armv7 — the project builds arm64 only', () => {
    const arr = valueAfterKey(plist(plistPath), 'UIRequiredDeviceCapabilities');
    const caps = Array.from(arr?.getElementsByTagName('string') ?? []).map(n => n.textContent);
    expect(caps).not.toContain('armv7');
    expect(caps).toContain('arm64');
  });
});

describe('the privacy manifest', () => {
  const manifest = join(IOS, 'App/PrivacyInfo.xcprivacy');

  it('exists and declares no tracking', () => {
    const doc = plist(manifest);
    expect(valueAfterKey(doc, 'NSPrivacyTracking')!.tagName).toBe('false');
    expect(valueAfterKey(doc, 'NSPrivacyTrackingDomains')!.children).toHaveLength(0);
  });

  it('declares File Timestamp while @capacitor/filesystem is a dependency', () => {
    // Tied to the dependency, not asserted in isolation: the plugin reads
    // creationDate/modificationDate and ships NO manifest of its own, so the app
    // target has to declare C617.1 on its behalf or the upload draws ITMS-91053.
    // Remove the plugin and this requirement lapses with it.
    const pkg = JSON.parse(readFileSync(join(UI, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (!deps['@capacitor/filesystem']) return;

    const doc = plist(manifest);
    const types = Array.from(doc.getElementsByTagName('string')).map(n => n.textContent);
    expect(types).toContain('NSPrivacyAccessedAPICategoryFileTimestamp');
    expect(types).toContain('C617.1');
  });

  it('is in the Resources build phase, not merely on disk', () => {
    // The step that is easy to skip and impossible to notice: a manifest that is
    // not copied into the bundle is not a manifest. Apple sees the bundle.
    const pbx = readFileSync(join(IOS, 'App.xcodeproj/project.pbxproj'), 'utf8');
    expect(pbx).toMatch(/PrivacyInfo\.xcprivacy in Resources \*\/ = \{isa = PBXBuildFile/);
    // The section is delimited by Begin/End comment markers; splitting on the
    // bare isa name lands between them and silently matches nothing.
    const section = pbx.match(
      /\/\* Begin PBXResourcesBuildPhase section \*\/([\s\S]*?)\/\* End PBXResourcesBuildPhase section \*\//,
    );
    expect(section, 'no PBXResourcesBuildPhase section found').not.toBeNull();
    expect(section![1]).toContain('PrivacyInfo.xcprivacy in Resources');
  });
});
