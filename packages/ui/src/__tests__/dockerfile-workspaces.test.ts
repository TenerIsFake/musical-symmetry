/**
 * Every workspace package that packages/ui depends on must be copied into the
 * Docker build, or `npm install` falls through to the public registry and 404s.
 *
 * MIDI-01 added `@musical-symmetry/capacitor-coremidi` as a ui dependency. The
 * repo build and every test stayed green, but the web image could no longer be
 * built, and nobody found out until the next deploy, weeks later. Nothing runs
 * the Dockerfile on a push, so this compares the two files instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ui = join(__dirname, '..', '..');
const root = join(ui, '..', '..');
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

const workspaceDirs: string[] = readJson(join(root, 'package.json')).workspaces;
const nameToDir = new Map<string, string>(
  workspaceDirs.map((dir) => [readJson(join(root, dir, 'package.json')).name, dir]),
);

const uiPkg = readJson(join(ui, 'package.json'));
const uiWorkspaceDeps = Object.keys({ ...uiPkg.dependencies, ...uiPkg.devDependencies })
  .filter((name) => nameToDir.has(name));

const dockerfile = readFileSync(join(ui, 'Dockerfile'), 'utf8');

describe('packages/ui Dockerfile', () => {
  it('finds at least one workspace dependency (the check is not vacuous)', () => {
    expect(uiWorkspaceDeps.length).toBeGreaterThan(0);
  });

  it.each(uiWorkspaceDeps)('copies the package.json of %s', (name) => {
    const dir = nameToDir.get(name)!;
    expect(dockerfile).toContain(`COPY ${dir}/package.json ${dir}/`);
  });
});
