# Timbria — Feature B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Timbria's Feature B — a sound/FX/gear knowledge base with a browseable catalog, a guided "what am I hearing" identifier, an artist→gear registry, and a review-gated LLM gear-lookup — as a web-first sibling app to Chrometria.

**Architecture:** Two new monorepo packages. `timbria-api` is a standalone Express + better-sqlite3 service (own `timbria.db`, own container) following the `analyzer` package's `db.ts`/`routes.ts` conventions. `timbria-ui` is a separate React/Vite frontend on `timbria.tendrid.us` that reuses the existing design system. Identity is the Cloudflare Access JWT email (Access protects the hostname); tier is read server-side from RevenueCat keyed on that email. Built in three independently-demoable vertical slices (Catalog+Identify → Artist registry+Review on curated data → LLM lookup last).

**Tech Stack:** TypeScript (ESM, `.js` import suffixes), Express 4, better-sqlite3, Vite + React, vitest, Cloudflare Access (JWT), RevenueCat REST, Anthropic API (lookup, slice 3 only).

**Spec:** `docs/superpowers/specs/2026-06-15-timbria-knowledge-base-design.md`

---

## File Structure

**`packages/timbria-api/`** (new standalone Express service)
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `Dockerfile`
- `src/index.ts` — Express bootstrap: CORS, JSON, mounts routers, runs migrations, health endpoint, `listen(3061)`
- `src/db.ts` — `getDb()` singleton (better-sqlite3 at `TIMBRIA_DB` path), `runAllMigrations()`
- `src/catalog/db.ts` — fx_type/gear_item/sound migrations + queries
- `src/catalog/routes.ts` — `/api/fx`, `/api/gear`, `/api/sounds`
- `src/identify/db.ts` — id_node migration + queries
- `src/identify/routes.ts` — `/api/identify/tree`, `/api/identify/node/:id`
- `src/artists/db.ts` — artist/artist_gear migrations + queries
- `src/artists/routes.ts` — `/api/artists`, `/api/artists/:id`
- `src/review/routes.ts` — `/api/review` (list/approve/edit/reject)
- `src/auth/access.ts` — Cloudflare Access JWT verify middleware + `requireOwner`
- `src/auth/tier.ts` — `getTier(email)` via RevenueCat REST + `requireTier`
- `src/lookup/lookup.ts` — isolated web+LLM → structured draft rows (slice 3)
- `src/lookup/parse.ts` — pure: raw LLM JSON → validated `ArtistGearDraft[]` (slice 3)
- `src/lookup/routes.ts` — `POST /api/artists/:id/lookup` (slice 3)
- `src/seed/seed-data.ts` — curated fx_type/gear_item/sound/id_node starter set
- `src/seed/load-seed.ts` — idempotent seed loader
- `src/types.ts` — shared row/DTO types
- `test/*.test.ts` — vitest specs colocated per module

**`packages/timbria-ui/`** (new Vite React frontend)
- `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- `src/main.tsx`, `src/App.tsx` — hash router shell (`#catalog`/`#artists`/`#identify`/`#review`)
- `src/api.ts` — fetch wrapper (credentials: 'include')
- `src/sections/CatalogSection.tsx`, `ArtistsSection.tsx`, `IdentifySection.tsx`, `ReviewSection.tsx`
- `src/components/*` — `FxCard`, `ConfidenceBadge`, `GearLine`, etc.
- `src/__tests__/*.test.tsx`

**Repo wiring**
- `package.json` (root) — add both packages to `workspaces`
- `docker-compose.yml` (SRV-2 `~/docker-compose.yml`) — `timbria-api` + `timbria-ui` services (done at deploy, noted in final task)

---

## SLICE 1 — Catalog + Identify (curated data, no auth, no LLM)

### Task 1: Scaffold `timbria-api` package

**Files:**
- Create: `packages/timbria-api/package.json`
- Create: `packages/timbria-api/tsconfig.json`
- Create: `packages/timbria-api/vitest.config.ts`
- Create: `packages/timbria-api/src/db.ts`
- Create: `packages/timbria-api/src/index.ts`
- Test: `packages/timbria-api/test/health.test.ts`
- Modify: `package.json` (root) — add `packages/timbria-api` to `workspaces`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@musical-symmetry/timbria-api",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5",
    "express": "^4.19.0",
    "jose": "^5.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/cors": "^2.8.0",
    "@types/express": "^4.17.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json** (mirror analyzer's — ESM, NodeNext)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```

- [ ] **Step 4: Create src/db.ts**

```typescript
import Database from 'better-sqlite3';
import type { Database as DB } from 'better-sqlite3';

let _db: DB | null = null;

export function getDb(): DB {
  if (_db) return _db;
  const path = process.env.TIMBRIA_DB || './timbria.db';
  _db = new Database(path);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

// Allows tests to use an isolated in-memory db
export function setDbForTest(db: DB): void {
  _db = db;
}

const migrations: Array<() => void> = [];
export function registerMigration(fn: () => void): void {
  migrations.push(fn);
}
export function runAllMigrations(): void {
  for (const m of migrations) m();
}
```

- [ ] **Step 5: Write the failing health test**

```typescript
// test/health.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/index.js';

describe('health', () => {
  it('GET /healthcheck returns ok', async () => {
    const res = await request(createApp()).get('/healthcheck');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Run it, verify it fails**

Run: `cd packages/timbria-api && npx vitest run test/health.test.ts`
Expected: FAIL — `createApp` not exported / module not found.

- [ ] **Step 7: Create src/index.ts**

```typescript
import express, { type Express } from 'express';
import cors from 'cors';
import { runAllMigrations } from './db.js';

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/healthcheck', (_req, res) => res.json({ status: 'ok' }));
  return app;
}

if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  runAllMigrations();
  const app = createApp();
  const port = Number(process.env.PORT || 3061);
  app.listen(port, () => console.log(`timbria-api on ${port}`));
}
```

- [ ] **Step 8: Run test, verify pass**

Run: `cd packages/timbria-api && npx vitest run test/health.test.ts`
Expected: PASS.

- [ ] **Step 9: Add package to root workspaces**

Modify `package.json` (root) `workspaces` array → add `"packages/timbria-api"`. Run `npm install` from repo root.

- [ ] **Step 10: Commit**

```bash
git add packages/timbria-api package.json package-lock.json
git commit -m "feat(timbria-api): scaffold standalone express service + health"
```

---

### Task 2: Catalog data model + migrations

**Files:**
- Create: `packages/timbria-api/src/types.ts`
- Create: `packages/timbria-api/src/catalog/db.ts`
- Test: `packages/timbria-api/test/catalog-db.test.ts`

- [ ] **Step 1: Create src/types.ts**

```typescript
export type FxCategory =
  | 'reverb' | 'dynamics' | 'distortion' | 'modulation' | 'delay'
  | 'eq' | 'pitch' | 'source-instrument' | 'source-synth' | 'mic' | 'amp' | 'utility';

export interface FxType {
  id: number; name: string; category: FxCategory;
  fingerprint: string; tells: string; era: string; typical_use: string;
}
export interface GearItem {
  id: number; name: string; fx_type_id: number;
  manufacturer: string; kind: 'hardware' | 'plugin' | 'instrument' | 'synth' | 'mic' | 'amp';
}
export interface Sound {
  id: number; name: string; description: string;
  chain: number[]; // ordered fx_type ids, JSON-encoded in db
  artist_id: number | null;
}
```

- [ ] **Step 2: Write the failing migration test**

```typescript
// test/catalog-db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, insertFxType, getFxType } from '../src/catalog/db.js';

beforeEach(() => { setDbForTest(new Database(':memory:')); runCatalogMigration(); });

describe('catalog db', () => {
  it('creates fx_type and round-trips a row', () => {
    const id = insertFxType({ name: 'Plate Reverb', category: 'reverb',
      fingerprint: 'dense, bright, no distinct echoes', tells: 'fast metallic decay',
      era: '1957–', typical_use: 'vocals, snare' });
    const row = getFxType(id);
    expect(row?.name).toBe('Plate Reverb');
    expect(row?.category).toBe('reverb');
  });
});
```

- [ ] **Step 3: Run it, verify fails**

Run: `npx vitest run test/catalog-db.test.ts`
Expected: FAIL — module `../src/catalog/db.js` not found.

- [ ] **Step 4: Create src/catalog/db.ts**

```typescript
import { getDb, registerMigration } from '../db.js';
import type { FxType, GearItem, Sound } from '../types.js';

export function runCatalogMigration(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS fx_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
      fingerprint TEXT NOT NULL DEFAULT '', tells TEXT NOT NULL DEFAULT '',
      era TEXT NOT NULL DEFAULT '', typical_use TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS gear_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      fx_type_id INTEGER REFERENCES fx_type(id) ON DELETE SET NULL,
      manufacturer TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'hardware'
    );
    CREATE TABLE IF NOT EXISTS sound (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
      chain TEXT NOT NULL DEFAULT '[]', artist_id INTEGER
    );
  `);
}
registerMigration(runCatalogMigration);

export function insertFxType(f: Omit<FxType, 'id'>): number {
  const db = getDb();
  const r = db.prepare(`INSERT INTO fx_type (name,category,fingerprint,tells,era,typical_use)
    VALUES (@name,@category,@fingerprint,@tells,@era,@typical_use)`).run(f);
  return Number(r.lastInsertRowid);
}
export function getFxType(id: number): FxType | undefined {
  return getDb().prepare('SELECT * FROM fx_type WHERE id = ?').get(id) as FxType | undefined;
}
export function listFxTypes(): FxType[] {
  return getDb().prepare('SELECT * FROM fx_type ORDER BY category, name').all() as FxType[];
}
export function insertGear(g: Omit<GearItem, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO gear_item (name,fx_type_id,manufacturer,kind)
    VALUES (@name,@fx_type_id,@manufacturer,@kind)`).run(g);
  return Number(r.lastInsertRowid);
}
export function listGear(): GearItem[] {
  return getDb().prepare('SELECT * FROM gear_item ORDER BY name').all() as GearItem[];
}
export function insertSound(s: Omit<Sound, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO sound (name,description,chain,artist_id)
    VALUES (?,?,?,?)`).run(s.name, s.description, JSON.stringify(s.chain), s.artist_id);
  return Number(r.lastInsertRowid);
}
export function listSounds(): Sound[] {
  const rows = getDb().prepare('SELECT * FROM sound ORDER BY name').all() as any[];
  return rows.map(r => ({ ...r, chain: JSON.parse(r.chain) }));
}
```

- [ ] **Step 5: Run test, verify pass**

Run: `npx vitest run test/catalog-db.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/timbria-api/src/types.ts packages/timbria-api/src/catalog packages/timbria-api/test/catalog-db.test.ts
git commit -m "feat(timbria-api): catalog data model (fx_type/gear_item/sound)"
```

---

### Task 3: Identify decision-tree data model

**Files:**
- Create: `packages/timbria-api/src/identify/db.ts`
- Test: `packages/timbria-api/test/identify-db.test.ts`

- [ ] **Step 1: Add IdNode type to src/types.ts**

```typescript
export interface IdNode {
  id: number;
  question: string;            // empty for leaf nodes
  branches: Array<{ answer: string; next: number }>; // JSON in db
  leaf_fx_type_ids: number[];  // JSON in db; non-empty => leaf
  explanation: string;
}
```

- [ ] **Step 2: Write failing test (insert + traversal helper)**

```typescript
// test/identify-db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setDbForTest } from '../src/db.js';
import { runIdentifyMigration, insertNode, getNode, getRoot } from '../src/identify/db.js';

beforeEach(() => { setDbForTest(new Database(':memory:')); runIdentifyMigration(); });

describe('identify db', () => {
  it('stores a branch node and a leaf, resolves root', () => {
    const leaf = insertNode({ question: '', branches: [], leaf_fx_type_ids: [1], explanation: 'Plate reverb.' });
    const root = insertNode({ question: 'Short metallic or long washy?',
      branches: [{ answer: 'metallic', next: leaf }], leaf_fx_type_ids: [], explanation: '' });
    expect(getRoot()?.id).toBe(root);          // first inserted branch node with no parent = root
    expect(getNode(leaf)?.leaf_fx_type_ids).toEqual([1]);
  });
});
```

Note: `getRoot()` returns the lowest-id node that is not referenced as any node's `branches[].next`.

- [ ] **Step 3: Run it, verify fails** — `npx vitest run test/identify-db.test.ts` → FAIL (module missing).

- [ ] **Step 4: Create src/identify/db.ts**

```typescript
import { getDb, registerMigration } from '../db.js';
import type { IdNode } from '../types.js';

export function runIdentifyMigration(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS id_node (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL DEFAULT '',
      branches TEXT NOT NULL DEFAULT '[]',
      leaf_fx_type_ids TEXT NOT NULL DEFAULT '[]',
      explanation TEXT NOT NULL DEFAULT ''
    );
  `);
}
registerMigration(runIdentifyMigration);

function rowToNode(r: any): IdNode {
  return { id: r.id, question: r.question, explanation: r.explanation,
    branches: JSON.parse(r.branches), leaf_fx_type_ids: JSON.parse(r.leaf_fx_type_ids) };
}
export function insertNode(n: Omit<IdNode, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO id_node (question,branches,leaf_fx_type_ids,explanation)
    VALUES (?,?,?,?)`).run(n.question, JSON.stringify(n.branches),
    JSON.stringify(n.leaf_fx_type_ids), n.explanation);
  return Number(r.lastInsertRowid);
}
export function getNode(id: number): IdNode | undefined {
  const r = getDb().prepare('SELECT * FROM id_node WHERE id = ?').get(id);
  return r ? rowToNode(r) : undefined;
}
export function getRoot(): IdNode | undefined {
  const all = getDb().prepare('SELECT * FROM id_node ORDER BY id').all().map(rowToNode);
  const referenced = new Set<number>();
  for (const n of all) for (const b of n.branches) referenced.add(b.next);
  return all.find(n => !referenced.has(n.id));
}
```

- [ ] **Step 5: Run test, verify pass** → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/timbria-api/src/identify packages/timbria-api/src/types.ts packages/timbria-api/test/identify-db.test.ts
git commit -m "feat(timbria-api): identify decision-tree model + root resolver"
```

---

### Task 4: Curated seed data + idempotent loader

**Files:**
- Create: `packages/timbria-api/src/seed/seed-data.ts`
- Create: `packages/timbria-api/src/seed/load-seed.ts`
- Test: `packages/timbria-api/test/seed.test.ts`

- [ ] **Step 1: Create src/seed/seed-data.ts** (starter canon — minimum 12 fx_types, 12 gear, 6 sounds, a 5-node identify tree)

```typescript
import type { FxCategory } from '../types.js';

export const SEED_FX: Array<{ name: string; category: FxCategory; fingerprint: string; tells: string; era: string; typical_use: string }> = [
  { name: 'Plate Reverb', category: 'reverb', fingerprint: 'Dense, bright, smooth tail with no distinct echoes.', tells: 'Fast bright metallic-shimmer decay; sits behind the source.', era: '1957–', typical_use: 'Vocals, snare' },
  { name: 'Spring Reverb', category: 'reverb', fingerprint: 'Boingy, mid-focused, drippy.', tells: 'Characteristic "sproing" on transients.', era: '1960s–', typical_use: 'Surf guitar, dub' },
  { name: 'Hall Reverb', category: 'reverb', fingerprint: 'Long, diffuse, deep sense of space.', tells: 'Slow build, long wash, distant.', era: '—', typical_use: 'Orchestral, ambient' },
  { name: 'FET Compressor (1176-style)', category: 'dynamics', fingerprint: 'Fast, punchy, adds aggressive grab and color.', tells: 'Snappy transient control; "all-buttons" grit.', era: '1967–', typical_use: 'Vocals, drums, bass' },
  { name: 'Optical Compressor (LA-2A-style)', category: 'dynamics', fingerprint: 'Smooth, slow, musical level-riding.', tells: 'Gentle, transparent gain reduction.', era: '1965–', typical_use: 'Vocals, bass' },
  { name: 'Tape Saturation', category: 'distortion', fingerprint: 'Warm, gentle compression + harmonic thickening.', tells: 'Softened transients, subtle high-end roll-off.', era: '—', typical_use: 'Mix glue, drums' },
  { name: 'Analog Delay', category: 'delay', fingerprint: 'Warm, darkening repeats that degrade over time.', tells: 'Each echo duller than the last.', era: '1970s–', typical_use: 'Guitar, vocals, dub' },
  { name: 'Chorus', category: 'modulation', fingerprint: 'Shimmery thickening / doubling.', tells: 'Wobbly, wide, "underwater" sheen.', era: '1970s–', typical_use: '80s guitar, synths' },
  { name: 'Flanger', category: 'modulation', fingerprint: 'Jet-plane sweeping comb filter.', tells: 'Whooshing sweep through the spectrum.', era: '1960s–', typical_use: 'Guitar, drums' },
  { name: 'Parametric EQ', category: 'eq', fingerprint: 'Tonal sculpting; no obvious "effect".', tells: 'Inferred from spectral balance, not a sound itself.', era: '—', typical_use: 'Everything' },
  { name: 'Auto-Tune (audible)', category: 'pitch', fingerprint: 'Hard-quantized pitch with zero glide.', tells: 'Robotic instant note jumps.', era: '1998–', typical_use: 'Modern vocals' },
  { name: 'Analog Poly Synth', category: 'source-synth', fingerprint: 'Warm, slightly detuned, fat oscillators.', tells: 'Gentle pitch drift, lush unison.', era: '1978–', typical_use: 'Pads, leads' },
];

export const SEED_GEAR: Array<{ name: string; fxName: string; manufacturer: string; kind: string }> = [
  { name: 'EMT 140', fxName: 'Plate Reverb', manufacturer: 'EMT', kind: 'hardware' },
  { name: 'Universal Audio 1176LN', fxName: 'FET Compressor (1176-style)', manufacturer: 'Universal Audio', kind: 'hardware' },
  { name: 'Teletronix LA-2A', fxName: 'Optical Compressor (LA-2A-style)', manufacturer: 'Teletronix', kind: 'hardware' },
  { name: 'Roland Juno-106', fxName: 'Analog Poly Synth', manufacturer: 'Roland', kind: 'synth' },
  { name: 'Boss CE-1', fxName: 'Chorus', manufacturer: 'Boss', kind: 'hardware' },
  { name: 'Antares Auto-Tune', fxName: 'Auto-Tune (audible)', manufacturer: 'Antares', kind: 'plugin' },
];

export const SEED_SOUNDS: Array<{ name: string; description: string; chainFxNames: string[] }> = [
  { name: '80s gated-reverb snare', description: 'Huge snare with an abruptly cut reverb tail.', chainFxNames: ['Plate Reverb', 'Parametric EQ'] },
  { name: 'Dub delay throw', description: 'A word/snare flung into degrading echoes.', chainFxNames: ['Analog Delay', 'Spring Reverb'] },
  { name: 'Modern pop vocal', description: 'Up-front, pitch-perfect, tightly controlled vocal.', chainFxNames: ['Auto-Tune (audible)', 'FET Compressor (1176-style)', 'Plate Reverb'] },
];

// Identify tree as an authoring structure; load-seed wires ids.
export const SEED_IDENTIFY: Array<{ key: string; question: string; branches: Array<{ answer: string; next: string }>; leafFxNames: string[]; explanation: string }> = [
  { key: 'root', question: 'Is there an obvious sense of space/ambience, or is it a pitched/tonal effect?', branches: [{ answer: 'space/ambience', next: 'space' }, { answer: 'pitched/tonal', next: 'tonal' }], leafFxNames: [], explanation: '' },
  { key: 'space', question: 'Short & metallic, or long & washy?', branches: [{ answer: 'short metallic', next: 'plate' }, { answer: 'long washy', next: 'hall' }], leafFxNames: [], explanation: '' },
  { key: 'plate', question: '', branches: [], leafFxNames: ['Plate Reverb'], explanation: 'Fast bright metallic decay with no distinct echoes points to a plate reverb.' },
  { key: 'hall', question: '', branches: [], leafFxNames: ['Hall Reverb'], explanation: 'A long, slow, diffuse wash points to a hall reverb.' },
  { key: 'tonal', question: '', branches: [], leafFxNames: ['Chorus'], explanation: 'Shimmery wobble/doubling without added space points to a chorus.' },
];
```

- [ ] **Step 2: Write failing loader test**

```typescript
// test/seed.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, listFxTypes, listGear, listSounds } from '../src/catalog/db.js';
import { runIdentifyMigration, getRoot } from '../src/identify/db.js';
import { loadSeed } from '../src/seed/load-seed.js';

beforeEach(() => {
  setDbForTest(new Database(':memory:'));
  runCatalogMigration(); runIdentifyMigration();
});

describe('seed loader', () => {
  it('loads canon and is idempotent', () => {
    loadSeed(); loadSeed(); // twice — must not duplicate
    expect(listFxTypes().length).toBe(12);
    expect(listGear().length).toBe(6);
    expect(listSounds().length).toBe(3);
    expect(getRoot()?.question).toMatch(/space/i);
  });
});
```

- [ ] **Step 3: Run it, verify fails** → FAIL (loadSeed missing).

- [ ] **Step 4: Create src/seed/load-seed.ts**

```typescript
import { getDb } from '../db.js';
import { SEED_FX, SEED_GEAR, SEED_SOUNDS, SEED_IDENTIFY } from './seed-data.js';

export function loadSeed(): void {
  const db = getDb();
  const fxId = new Map<string, number>();
  const upFx = db.prepare(`INSERT INTO fx_type (name,category,fingerprint,tells,era,typical_use)
    VALUES (@name,@category,@fingerprint,@tells,@era,@typical_use)
    ON CONFLICT(name) DO UPDATE SET category=excluded.category RETURNING id`);
  for (const f of SEED_FX) fxId.set(f.name, (upFx.get(f) as any).id);

  const upGear = db.prepare(`INSERT INTO gear_item (name,fx_type_id,manufacturer,kind)
    VALUES (?,?,?,?) ON CONFLICT(name) DO NOTHING`);
  for (const g of SEED_GEAR) upGear.run(g.name, fxId.get(g.fxName) ?? null, g.manufacturer, g.kind);

  const upSound = db.prepare(`INSERT INTO sound (name,description,chain,artist_id)
    VALUES (?,?,?,NULL) ON CONFLICT(name) DO NOTHING`);
  for (const s of SEED_SOUNDS)
    upSound.run(s.name, s.description, JSON.stringify(s.chainFxNames.map(n => fxId.get(n)).filter(Boolean)));

  // Identify tree: clear + rebuild (small, authored set) to keep ids consistent
  db.exec('DELETE FROM id_node');
  const nodeId = new Map<string, number>();
  const ins = db.prepare(`INSERT INTO id_node (question,branches,leaf_fx_type_ids,explanation)
    VALUES (?, '[]', ?, ?) RETURNING id`);
  for (const n of SEED_IDENTIFY)
    nodeId.set(n.key, (ins.get(n.question, JSON.stringify(n.leafFxNames.map(x => fxId.get(x)).filter(Boolean)), n.explanation) as any).id);
  const upd = db.prepare('UPDATE id_node SET branches = ? WHERE id = ?');
  for (const n of SEED_IDENTIFY)
    upd.run(JSON.stringify(n.branches.map(b => ({ answer: b.answer, next: nodeId.get(b.next) }))), nodeId.get(n.key));
}
```

- [ ] **Step 5: Run test, verify pass** → PASS (idempotency proven by running twice).

- [ ] **Step 6: Commit**

```bash
git add packages/timbria-api/src/seed packages/timbria-api/test/seed.test.ts
git commit -m "feat(timbria-api): curated seed canon + idempotent loader"
```

---

### Task 5: Catalog + Identify HTTP routes

**Files:**
- Create: `packages/timbria-api/src/catalog/routes.ts`
- Create: `packages/timbria-api/src/identify/routes.ts`
- Modify: `packages/timbria-api/src/index.ts` (mount routers + run seed on boot)
- Test: `packages/timbria-api/test/catalog-routes.test.ts`

- [ ] **Step 1: Write failing route test**

```typescript
// test/catalog-routes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import { setDbForTest, runAllMigrations } from '../src/db.js';
import { loadSeed } from '../src/seed/load-seed.js';
import { createApp } from '../src/index.js';

beforeEach(() => { setDbForTest(new Database(':memory:')); runAllMigrations(); loadSeed(); });

describe('catalog + identify routes', () => {
  it('GET /api/fx returns seeded fx types', async () => {
    const res = await request(createApp()).get('/api/fx');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(12);
    expect(res.body[0]).toHaveProperty('fingerprint');
  });
  it('GET /api/identify/tree returns the root node', async () => {
    const res = await request(createApp()).get('/api/identify/tree');
    expect(res.status).toBe(200);
    expect(res.body.root.question).toMatch(/space/i);
  });
});
```

- [ ] **Step 2: Run it, verify fails** → FAIL (routes/mount missing).

- [ ] **Step 3: Create src/catalog/routes.ts**

```typescript
import { Router } from 'express';
import { listFxTypes, getFxType, listGear, listSounds } from './db.js';

export const catalogRouter = Router();
catalogRouter.get('/fx', (_req, res) => res.json(listFxTypes()));
catalogRouter.get('/fx/:id', (req, res) => {
  const row = getFxType(Number(req.params.id));
  return row ? res.json(row) : res.status(404).json({ error: 'not found' });
});
catalogRouter.get('/gear', (_req, res) => res.json(listGear()));
catalogRouter.get('/sounds', (_req, res) => res.json(listSounds()));
```

- [ ] **Step 4: Create src/identify/routes.ts**

```typescript
import { Router } from 'express';
import { getRoot, getNode } from './db.js';

export const identifyRouter = Router();
identifyRouter.get('/tree', (_req, res) => res.json({ root: getRoot() ?? null }));
identifyRouter.get('/node/:id', (req, res) => {
  const n = getNode(Number(req.params.id));
  return n ? res.json(n) : res.status(404).json({ error: 'not found' });
});
```

- [ ] **Step 5: Mount in src/index.ts** — add imports + `app.use('/api', catalogRouter)` and `app.use('/api/identify', identifyRouter)` inside `createApp()`. In the `listen` block, call `loadSeed()` after `runAllMigrations()`.

```typescript
import { catalogRouter } from './catalog/routes.js';
import { identifyRouter } from './identify/routes.js';
// inside createApp(), after json middleware:
app.use('/api', catalogRouter);
app.use('/api/identify', identifyRouter);
// in the listen block, after runAllMigrations():
import('./seed/load-seed.js').then(({ loadSeed }) => loadSeed());
```

- [ ] **Step 6: Run test, verify pass** → PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/timbria-api/src
git commit -m "feat(timbria-api): catalog + identify routes, seed on boot"
```

---

### Task 6: Scaffold `timbria-ui` + Catalog and Identify sections

**Files:**
- Create: `packages/timbria-ui/{package.json,vite.config.ts,tsconfig.json,index.html}`
- Create: `packages/timbria-ui/src/{main.tsx,App.tsx,api.ts}`
- Create: `packages/timbria-ui/src/sections/{CatalogSection,IdentifySection}.tsx`
- Test: `packages/timbria-ui/src/__tests__/identify.test.tsx`
- Modify: root `package.json` workspaces

- [ ] **Step 1: package.json** (Vite React + vitest + jsdom; reuse repo React version)

```json
{
  "name": "@musical-symmetry/timbria-ui",
  "private": true, "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview", "test": "vitest run" },
  "dependencies": { "react": "^18.3.0", "react-dom": "^18.3.0" },
  "devDependencies": {
    "@testing-library/react": "^16.0.0", "@testing-library/jest-dom": "^6.4.0",
    "@vitejs/plugin-react": "^4.3.0", "jsdom": "^24.0.0", "vite": "^5.3.0",
    "vitest": "^1.6.0", "typescript": "^5.4.0", "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0"
  }
}
```

- [ ] **Step 2: vite.config.ts** (proxy `/api` → timbria-api in dev; vitest jsdom)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3061' } },
  test: { environment: 'jsdom', globals: true, setupFiles: [] },
} as any);
```

- [ ] **Step 3: src/api.ts**

```typescript
const base = '';
export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(base + path, { credentials: 'include' });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}
export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(base + path, { method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}
```

- [ ] **Step 4: Write the failing IdentifySection test** (drives the traversal UI)

```tsx
// src/__tests__/identify.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IdentifySection } from '../sections/IdentifySection';

vi.mock('../api', () => ({
  getJSON: vi.fn(async (path: string) => {
    if (path === '/api/identify/tree') return { root: { id: 1, question: 'Space or tonal?', branches: [{ answer: 'space', next: 2 }], leaf_fx_type_ids: [], explanation: '' } };
    if (path === '/api/identify/node/2') return { id: 2, question: '', branches: [], leaf_fx_type_ids: [10], explanation: 'Plate reverb.' };
    if (path === '/api/fx/10') return { id: 10, name: 'Plate Reverb', fingerprint: 'bright decay' };
    throw new Error('unexpected ' + path);
  }),
}));

describe('IdentifySection', () => {
  it('walks from question to leaf explanation', async () => {
    render(<IdentifySection />);
    await screen.findByText(/Space or tonal/);
    fireEvent.click(screen.getByText('space'));
    await waitFor(() => expect(screen.getByText(/Plate reverb\./)).toBeInTheDocument());
  });
});
```

- [ ] **Step 5: Run it, verify fails** → FAIL (IdentifySection missing).

- [ ] **Step 6: Implement IdentifySection.tsx**

```tsx
import { useEffect, useState } from 'react';
import { getJSON } from '../api';
interface Node { id: number; question: string; branches: { answer: string; next: number }[]; leaf_fx_type_ids: number[]; explanation: string; }
export function IdentifySection() {
  const [node, setNode] = useState<Node | null>(null);
  const [leafName, setLeafName] = useState<string>('');
  useEffect(() => { getJSON<{ root: Node }>('/api/identify/tree').then(r => setNode(r.root)); }, []);
  async function pick(next: number) {
    const n = await getJSON<Node>(`/api/identify/node/${next}`);
    setNode(n);
    if (n.leaf_fx_type_ids.length) {
      const fx = await getJSON<{ name: string }>(`/api/fx/${n.leaf_fx_type_ids[0]}`);
      setLeafName(fx.name);
    }
  }
  if (!node) return <p>Loading…</p>;
  if (node.leaf_fx_type_ids.length)
    return <div><h3>{leafName}</h3><p>{node.explanation}</p></div>;
  return (
    <div>
      <h3>{node.question}</h3>
      {node.branches.map(b => <button key={b.next} onClick={() => pick(b.next)}>{b.answer}</button>)}
    </div>
  );
}
```

- [ ] **Step 7: Run test, verify pass** → PASS.

- [ ] **Step 8: Implement CatalogSection.tsx + App.tsx shell + main.tsx + index.html** (concrete, no new logic)

```tsx
// src/sections/CatalogSection.tsx
import { useEffect, useState } from 'react';
import { getJSON } from '../api';
interface Fx { id: number; name: string; category: string; fingerprint: string; tells: string; }
export function CatalogSection() {
  const [fx, setFx] = useState<Fx[]>([]);
  useEffect(() => { getJSON<Fx[]>('/api/fx').then(setFx); }, []);
  return (<div><h2>Catalog</h2>{fx.map(f => (
    <div key={f.id}><strong>{f.name}</strong> <em>{f.category}</em><p>{f.fingerprint}</p>
    <small>Tells: {f.tells}</small></div>))}</div>);
}
```

```tsx
// src/App.tsx — hash router shell
import { useEffect, useState } from 'react';
import { CatalogSection } from './sections/CatalogSection';
import { IdentifySection } from './sections/IdentifySection';
const routes: Record<string, () => JSX.Element> = {
  '#catalog': CatalogSection, '#identify': IdentifySection,
};
export function App() {
  const [hash, setHash] = useState(location.hash || '#catalog');
  useEffect(() => { const h = () => setHash(location.hash || '#catalog'); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h); }, []);
  const Section = routes[hash] ?? CatalogSection;
  return (<div><nav><a href="#catalog">Catalog</a> <a href="#identify">Identify</a></nav><Section /></div>);
}
```

`main.tsx` renders `<App/>`; `index.html` is the standard Vite root. Add `packages/timbria-ui` to root workspaces; `npm install`.

- [ ] **Step 9: Commit**

```bash
git add packages/timbria-ui package.json package-lock.json
git commit -m "feat(timbria-ui): scaffold + Catalog and Identify sections (slice 1)"
```

**✅ Slice 1 demoable:** `npm -w @musical-symmetry/timbria-api run dev` + `npm -w @musical-symmetry/timbria-ui run dev` → browse the catalog and walk the identifier end-to-end on curated data.

---

## SLICE 2 — Artist registry + Review (curated data, auth/tiers)

### Task 7: Artist + artist_gear data model

**Files:**
- Create: `packages/timbria-api/src/artists/db.ts`
- Test: `packages/timbria-api/test/artists-db.test.ts`

- [ ] **Step 1: Add types to src/types.ts**

```typescript
export type Confidence = 'low' | 'med' | 'high';
export type GearStatus = 'draft' | 'approved';
export interface Artist { id: number; name: string; role: string; era: string; genre: string; notes: string; }
export interface ArtistGear {
  id: number; artist_id: number; gear_item_id: number; context: string;
  source_url: string; confidence: Confidence; status: GearStatus;
  added_by: 'curated' | 'llm-lookup'; reviewed_at: string | null;
}
```

- [ ] **Step 2: Write failing test**

```typescript
// test/artists-db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, insertFxType, insertGear } from '../src/catalog/db.js';
import { runArtistMigration, insertArtist, insertArtistGear, getArtistProfile, setGearStatus } from '../src/artists/db.js';

beforeEach(() => { setDbForTest(new Database(':memory:')); runCatalogMigration(); runArtistMigration(); });

describe('artists db', () => {
  it('builds a grouped profile and flips status', () => {
    const fx = insertFxType({ name: 'Plate Reverb', category: 'reverb', fingerprint: '', tells: '', era: '', typical_use: '' });
    const gear = insertGear({ name: 'EMT 140', fx_type_id: fx, manufacturer: 'EMT', kind: 'hardware' });
    const artist = insertArtist({ name: 'Test Artist', role: 'artist', era: '', genre: '', notes: '' });
    const agId = insertArtistGear({ artist_id: artist, gear_item_id: gear, context: 'vocal chain',
      source_url: 'https://example.com', confidence: 'high', status: 'draft', added_by: 'curated', reviewed_at: null });
    let prof = getArtistProfile(artist);
    expect(prof?.gear[0].status).toBe('draft');
    setGearStatus(agId, 'approved');
    prof = getArtistProfile(artist);
    expect(prof?.gear[0].status).toBe('approved');
    expect(prof?.gear[0].gear_name).toBe('EMT 140');
  });
});
```

- [ ] **Step 3: Run, verify fails** → FAIL.

- [ ] **Step 4: Create src/artists/db.ts**

```typescript
import { getDb, registerMigration } from '../db.js';
import type { Artist, ArtistGear } from '../types.js';

export function runArtistMigration(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS artist (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT '', era TEXT DEFAULT '', genre TEXT DEFAULT '', notes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS artist_gear (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_id INTEGER NOT NULL REFERENCES artist(id) ON DELETE CASCADE,
      gear_item_id INTEGER NOT NULL REFERENCES gear_item(id) ON DELETE CASCADE,
      context TEXT DEFAULT '', source_url TEXT DEFAULT '',
      confidence TEXT DEFAULT 'low', status TEXT DEFAULT 'draft',
      added_by TEXT DEFAULT 'curated', reviewed_at TEXT
    );
  `);
}
registerMigration(runArtistMigration);

export function insertArtist(a: Omit<Artist, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO artist (name,role,era,genre,notes)
    VALUES (@name,@role,@era,@genre,@notes)
    ON CONFLICT(name) DO UPDATE SET role=excluded.role RETURNING id`).get(a) as any;
  return r.id;
}
export function findArtistByName(name: string): Artist | undefined {
  return getDb().prepare('SELECT * FROM artist WHERE name = ? COLLATE NOCASE').get(name) as Artist | undefined;
}
export function insertArtistGear(g: Omit<ArtistGear, 'id'>): number {
  const r = getDb().prepare(`INSERT INTO artist_gear
    (artist_id,gear_item_id,context,source_url,confidence,status,added_by,reviewed_at)
    VALUES (@artist_id,@gear_item_id,@context,@source_url,@confidence,@status,@added_by,@reviewed_at)`).run(g);
  return Number(r.lastInsertRowid);
}
export function setGearStatus(id: number, status: 'approved'): void {
  getDb().prepare(`UPDATE artist_gear SET status = ?, reviewed_at = datetime('now') WHERE id = ?`).run(status, id);
}
export function deleteArtistGear(id: number): void {
  getDb().prepare('DELETE FROM artist_gear WHERE id = ?').run(id);
}
export interface ProfileGearLine extends ArtistGear { gear_name: string; }
export function getArtistProfile(id: number): { artist: Artist; gear: ProfileGearLine[] } | undefined {
  const artist = getDb().prepare('SELECT * FROM artist WHERE id = ?').get(id) as Artist | undefined;
  if (!artist) return undefined;
  const gear = getDb().prepare(`SELECT ag.*, gi.name AS gear_name FROM artist_gear ag
    JOIN gear_item gi ON gi.id = ag.gear_item_id WHERE ag.artist_id = ?
    ORDER BY ag.context, gi.name`).all(id) as ProfileGearLine[];
  return { artist, gear };
}
export function listDrafts(): ProfileGearLine[] {
  return getDb().prepare(`SELECT ag.*, gi.name AS gear_name FROM artist_gear ag
    JOIN gear_item gi ON gi.id = ag.gear_item_id WHERE ag.status = 'draft' ORDER BY ag.id`).all() as ProfileGearLine[];
}
```

- [ ] **Step 5: Run test, verify pass** → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/timbria-api/src/artists/db.ts packages/timbria-api/src/types.ts packages/timbria-api/test/artists-db.test.ts
git commit -m "feat(timbria-api): artist + artist_gear registry model"
```

---

### Task 8: Cloudflare Access JWT identity + owner gate

**Files:**
- Create: `packages/timbria-api/src/auth/access.ts`
- Test: `packages/timbria-api/test/access.test.ts`

Context: behind Cloudflare Access, every request carries `Cf-Access-Jwt-Assertion`. Verify it against the team's public keys (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`) using `jose`. The verified `email` claim is the identity. `OWNER_EMAIL` env gates `#review`.

- [ ] **Step 1: Write failing test** (inject a fake verifier to keep the unit pure)

```typescript
// test/access.test.ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeAccessMiddleware, requireOwner } from '../src/auth/access.js';

function appWith(email: string | null) {
  const app = express();
  const access = makeAccessMiddleware(async () => (email ? { email } : null));
  app.use(access);
  app.get('/me', (req, res) => res.json({ email: (req as any).userEmail ?? null }));
  app.get('/admin', requireOwner('owner@x.com'), (_req, res) => res.json({ ok: true }));
  return app;
}

describe('access middleware', () => {
  it('attaches verified email', async () => {
    const res = await request(appWith('a@x.com')).get('/me');
    expect(res.body.email).toBe('a@x.com');
  });
  it('owner gate allows owner, blocks others', async () => {
    expect((await request(appWith('owner@x.com')).get('/admin')).status).toBe(200);
    expect((await request(appWith('a@x.com')).get('/admin')).status).toBe(403);
  });
  it('blocks when no valid token', async () => {
    expect((await request(appWith(null)).get('/admin')).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run, verify fails** → FAIL.

- [ ] **Step 3: Create src/auth/access.ts**

```typescript
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type Verifier = (token: string | undefined) => Promise<{ email: string } | null>;

// Production verifier: validates the CF Access JWT against the team JWKS + AUD.
export function cfAccessVerifier(): Verifier {
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN!; // e.g. https://tendrid.cloudflareaccess.com
  const aud = process.env.CF_ACCESS_AUD!;
  const JWKS = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  return async (token) => {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, JWKS, { issuer: teamDomain, audience: aud });
      return typeof payload.email === 'string' ? { email: payload.email } : null;
    } catch { return null; }
  };
}

export function makeAccessMiddleware(verify: Verifier): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.header('Cf-Access-Jwt-Assertion');
    const id = await verify(token);
    if (id) (req as any).userEmail = id.email;
    next();
  };
}

export function requireOwner(ownerEmail: string): RequestHandler {
  return (req, res, next) => {
    if ((req as any).userEmail === ownerEmail) return next();
    return res.status(403).json({ error: 'owner only' });
  };
}
```

- [ ] **Step 4: Run test, verify pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-api/src/auth/access.ts packages/timbria-api/test/access.test.ts
git commit -m "feat(timbria-api): cloudflare access JWT identity + owner gate"
```

---

### Task 9: Tier resolution (RevenueCat REST, shared with Chrometria)

**Files:**
- Create: `packages/timbria-api/src/auth/tier.ts`
- Test: `packages/timbria-api/test/tier.test.ts`

Decision: tier is read from RevenueCat keyed on the Access email (same app-user-id Chrometria uses), cached in-process 5 min. `requireTier` gates Pro/Research features. Owner email is always treated as 'research'.

- [ ] **Step 1: Write failing test** (inject a fake fetcher)

```typescript
// test/tier.test.ts
import { describe, it, expect } from 'vitest';
import { makeTierResolver } from '../src/auth/tier.js';

describe('tier resolver', () => {
  const resolve = makeTierResolver({
    ownerEmail: 'owner@x.com',
    fetchEntitlements: async (email) => email === 'pro@x.com' ? ['pro'] : [],
  });
  it('owner is research', async () => expect(await resolve('owner@x.com')).toBe('research'));
  it('maps entitlement', async () => expect(await resolve('pro@x.com')).toBe('pro'));
  it('defaults to free', async () => expect(await resolve('nobody@x.com')).toBe('free'));
  it('null email is free', async () => expect(await resolve(null)).toBe('free'));
});
```

- [ ] **Step 2: Run, verify fails** → FAIL.

- [ ] **Step 3: Create src/auth/tier.ts**

```typescript
import type { RequestHandler } from 'express';

export type Tier = 'free' | 'student' | 'pro' | 'research';
const RANK: Record<Tier, number> = { free: 0, student: 1, pro: 2, research: 3 };

export interface TierDeps {
  ownerEmail: string;
  fetchEntitlements: (email: string) => Promise<string[]>; // active RevenueCat entitlement ids
}

export function makeTierResolver(deps: TierDeps): (email: string | null) => Promise<Tier> {
  const cache = new Map<string, { tier: Tier; at: number }>();
  return async (email) => {
    if (!email) return 'free';
    if (email === deps.ownerEmail) return 'research';
    const hit = cache.get(email);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.tier;
    const ents = await deps.fetchEntitlements(email);
    const tier: Tier = ents.includes('research') ? 'research'
      : ents.includes('pro') ? 'pro' : ents.includes('student') ? 'student' : 'free';
    cache.set(email, { tier, at: Date.now() });
    return tier;
  };
}

// Production entitlement fetch (RevenueCat REST v1 subscriber endpoint)
export async function revenueCatEntitlements(email: string): Promise<string[]> {
  const key = process.env.REVENUECAT_API_KEY!;
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) return [];
  const data: any = await r.json();
  return Object.keys(data?.subscriber?.entitlements ?? {});
}

export function requireTier(min: Tier, resolve: (email: string | null) => Promise<Tier>): RequestHandler {
  return async (req, res, next) => {
    const tier = await resolve((req as any).userEmail ?? null);
    if (RANK[tier] >= RANK[min]) return next();
    return res.status(402).json({ error: 'upgrade required', required: min, current: tier });
  };
}
```

- [ ] **Step 4: Run test, verify pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-api/src/auth/tier.ts packages/timbria-api/test/tier.test.ts
git commit -m "feat(timbria-api): RevenueCat-backed tier resolution + gate"
```

---

### Task 10: Artist + Review routes (wire auth/tiers)

**Files:**
- Create: `packages/timbria-api/src/artists/routes.ts`
- Create: `packages/timbria-api/src/review/routes.ts`
- Modify: `packages/timbria-api/src/index.ts` (mount + wire middleware via deps)
- Test: `packages/timbria-api/test/review-routes.test.ts`

- [ ] **Step 1: Write failing route test** (inject identity = owner; seed one draft)

```typescript
// test/review-routes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import express from 'express';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, insertFxType, insertGear } from '../src/catalog/db.js';
import { runArtistMigration, insertArtist, insertArtistGear } from '../src/artists/db.js';
import { reviewRouter } from '../src/review/routes.js';

function ownerApp() {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { (req as any).userEmail = 'owner@x.com'; next(); });
  app.use('/api/review', reviewRouter('owner@x.com'));
  return app;
}
beforeEach(() => {
  setDbForTest(new Database(':memory:')); runCatalogMigration(); runArtistMigration();
  const fx = insertFxType({ name: 'X', category: 'reverb', fingerprint: '', tells: '', era: '', typical_use: '' });
  const g = insertGear({ name: 'Unit', fx_type_id: fx, manufacturer: '', kind: 'hardware' });
  const a = insertArtist({ name: 'A', role: '', era: '', genre: '', notes: '' });
  insertArtistGear({ artist_id: a, gear_item_id: g, context: 'vox', source_url: 'u', confidence: 'high', status: 'draft', added_by: 'curated', reviewed_at: null });
});

describe('review routes', () => {
  it('lists drafts then approves one', async () => {
    const app = ownerApp();
    const list = await request(app).get('/api/review');
    expect(list.body.length).toBe(1);
    const id = list.body[0].id;
    expect((await request(app).post(`/api/review/${id}/approve`)).status).toBe(200);
    expect((await request(app).get('/api/review')).body.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify fails** → FAIL.

- [ ] **Step 3: Create src/artists/routes.ts**

```typescript
import { Router } from 'express';
import { findArtistByName, getArtistProfile } from './db.js';

export const artistsRouter = Router();
artistsRouter.get('/:name', (req, res) => {
  const a = findArtistByName(req.params.name);
  if (!a) return res.status(404).json({ error: 'unknown artist', name: req.params.name });
  return res.json(getArtistProfile(a.id));
});
```

- [ ] **Step 4: Create src/review/routes.ts**

```typescript
import { Router } from 'express';
import { listDrafts, setGearStatus, deleteArtistGear } from '../artists/db.js';
import { requireOwner } from '../auth/access.js';

export function reviewRouter(ownerEmail: string): Router {
  const r = Router();
  r.use(requireOwner(ownerEmail));
  r.get('/', (_req, res) => res.json(listDrafts()));
  r.post('/:id/approve', (req, res) => { setGearStatus(Number(req.params.id), 'approved'); res.json({ ok: true }); });
  r.post('/:id/reject', (req, res) => { deleteArtistGear(Number(req.params.id)); res.json({ ok: true }); });
  return r;
}
```

- [ ] **Step 5: Wire into src/index.ts** — build verifier + tier resolver from env, mount middleware + routers:

```typescript
import { makeAccessMiddleware, cfAccessVerifier } from './auth/access.js';
import { makeTierResolver, revenueCatEntitlements } from './auth/tier.js';
import { artistsRouter } from './artists/routes.js';
import { reviewRouter } from './review/routes.js';
// inside createApp(), after json:
const owner = process.env.OWNER_EMAIL || 'tenerjenkins@gmail.com';
if (process.env.NODE_ENV !== 'test') app.use(makeAccessMiddleware(cfAccessVerifier()));
app.use('/api/artists', artistsRouter);
app.use('/api/review', reviewRouter(owner));
```

(Tier resolver `makeTierResolver({ ownerEmail: owner, fetchEntitlements: revenueCatEntitlements })` is exported for the lookup gate in Slice 3.)

- [ ] **Step 6: Run test, verify pass** → PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/timbria-api/src
git commit -m "feat(timbria-api): artist profile + owner-gated review routes"
```

---

### Task 11: Artists + Review UI sections

**Files:**
- Create: `packages/timbria-ui/src/sections/ArtistsSection.tsx`
- Create: `packages/timbria-ui/src/sections/ReviewSection.tsx`
- Create: `packages/timbria-ui/src/components/ConfidenceBadge.tsx`
- Modify: `packages/timbria-ui/src/App.tsx` (add routes)
- Test: `packages/timbria-ui/src/__tests__/artists.test.tsx`

- [ ] **Step 1: Write failing test** (search → profile renders gear with confidence + unverified badge)

```tsx
// src/__tests__/artists.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArtistsSection } from '../sections/ArtistsSection';
vi.mock('../api', () => ({ getJSON: vi.fn(async (p: string) => {
  if (p === '/api/artists/Test') return { artist: { name: 'Test' }, gear: [
    { id: 1, gear_name: 'EMT 140', context: 'vocal chain', source_url: 'https://s', confidence: 'high', status: 'approved' },
    { id: 2, gear_name: 'Juno-106', context: 'synth', source_url: 'https://s2', confidence: 'low', status: 'draft' }]};
  throw new Error('x'); }) }));
describe('ArtistsSection', () => {
  it('shows gear with an unverified badge on drafts', async () => {
    render(<ArtistsSection />);
    fireEvent.change(screen.getByPlaceholderText(/artist/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/search/i));
    await waitFor(() => expect(screen.getByText('EMT 140')).toBeInTheDocument());
    expect(screen.getByText(/unverified/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fails** → FAIL.

- [ ] **Step 3: Implement ConfidenceBadge.tsx + ArtistsSection.tsx**

```tsx
// src/components/ConfidenceBadge.tsx
export function ConfidenceBadge({ confidence, status }: { confidence: string; status: string }) {
  return (<span>{status === 'draft' ? '⚠ unverified · ' : ''}{confidence}</span>);
}
```

```tsx
// src/sections/ArtistsSection.tsx
import { useState } from 'react';
import { getJSON } from '../api';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
interface Line { id: number; gear_name: string; context: string; source_url: string; confidence: string; status: string; }
export function ArtistsSection() {
  const [name, setName] = useState(''); const [prof, setProf] = useState<{ artist: { name: string }; gear: Line[] } | null>(null);
  const [err, setErr] = useState('');
  async function search() {
    setErr('');
    try { setProf(await getJSON(`/api/artists/${encodeURIComponent(name)}`)); }
    catch { setProf(null); setErr('No sourced gear found yet for that artist.'); }
  }
  return (<div><h2>Artists</h2>
    <input placeholder="Artist name" value={name} onChange={e => setName(e.target.value)} />
    <button onClick={search}>Search</button>
    {err && <p>{err}</p>}
    {prof && prof.gear.map(g => (<div key={g.id}>
      <strong>{g.gear_name}</strong> <em>{g.context}</em> — <ConfidenceBadge confidence={g.confidence} status={g.status} />
      {' '}<a href={g.source_url} target="_blank" rel="noreferrer">source</a></div>))}
  </div>);
}
```

- [ ] **Step 4: Run test, verify pass** → PASS.

- [ ] **Step 5: Implement ReviewSection.tsx + register both routes in App.tsx** (concrete)

```tsx
// src/sections/ReviewSection.tsx
import { useEffect, useState } from 'react';
import { getJSON, postJSON } from '../api';
interface Draft { id: number; gear_name: string; context: string; source_url: string; confidence: string; }
export function ReviewSection() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const load = () => getJSON<Draft[]>('/api/review').then(setDrafts).catch(() => setDrafts([]));
  useEffect(() => { load(); }, []);
  const act = async (id: number, verb: string) => { await postJSON(`/api/review/${id}/${verb}`, {}); load(); };
  return (<div><h2>Review</h2>{drafts.length === 0 ? <p>Nothing pending.</p> : drafts.map(d => (
    <div key={d.id}>{d.gear_name} ({d.context}) — <a href={d.source_url}>src</a> [{d.confidence}]
      <button onClick={() => act(d.id, 'approve')}>Approve</button>
      <button onClick={() => act(d.id, 'reject')}>Reject</button></div>))}</div>);
}
```

Add `'#artists': ArtistsSection, '#review': ReviewSection` to App.tsx `routes` and nav links.

- [ ] **Step 6: Commit**

```bash
git add packages/timbria-ui/src
git commit -m "feat(timbria-ui): artist profiles + review sections (slice 2)"
```

**✅ Slice 2 demoable:** with hand-entered/curated `artist_gear` rows, search an artist → see their grouped rig with citations + confidence; the owner-only Review tab approves/rejects drafts.

---

## SLICE 3 — LLM lookup (isolated, last)

### Task 12: Pure parser — raw LLM JSON → validated drafts

**Files:**
- Create: `packages/timbria-api/src/lookup/parse.ts`
- Test: `packages/timbria-api/test/parse.test.ts`

This is the trust-critical unit: it drops uncited claims, clamps confidence, and ignores gear it can't map. Fully unit-tested, zero network.

- [ ] **Step 1: Write the failing test (the rules from the spec)**

```typescript
// test/parse.test.ts
import { describe, it, expect } from 'vitest';
import { parseLookup } from '../src/lookup/parse.js';

const gearIndex = new Map<string, number>([['emt 140', 1], ['ua 1176', 2]]);

describe('parseLookup', () => {
  it('keeps cited, mappable rows and clamps confidence', () => {
    const raw = JSON.stringify({ gear: [
      { gear: 'EMT 140', context: 'vocals', source_url: 'https://x', confidence: 'super-high' },
      { gear: 'UA 1176', context: 'drums', source_url: 'https://y', confidence: 'med' },
    ]});
    const out = parseLookup(raw, gearIndex);
    expect(out).toHaveLength(2);
    expect(out[0].confidence).toBe('high'); // clamped from invalid 'super-high'
    expect(out[1].gear_item_id).toBe(2);
  });
  it('drops rows with no source_url', () => {
    const raw = JSON.stringify({ gear: [{ gear: 'EMT 140', context: 'vox', confidence: 'high' }] });
    expect(parseLookup(raw, gearIndex)).toHaveLength(0);
  });
  it('drops rows whose gear is not in the catalog', () => {
    const raw = JSON.stringify({ gear: [{ gear: 'Unknown Box', source_url: 'https://x', confidence: 'high' }] });
    expect(parseLookup(raw, gearIndex)).toHaveLength(0);
  });
  it('returns [] on malformed JSON', () => {
    expect(parseLookup('not json', gearIndex)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, verify fails** → FAIL.

- [ ] **Step 3: Create src/lookup/parse.ts**

```typescript
import type { Confidence } from '../types.js';

export interface ParsedGear { gear_item_id: number; context: string; source_url: string; confidence: Confidence; }
const VALID: Confidence[] = ['low', 'med', 'high'];

export function parseLookup(raw: string, gearIndex: Map<string, number>): ParsedGear[] {
  let data: any;
  try { data = JSON.parse(raw); } catch { return []; }
  const rows = Array.isArray(data?.gear) ? data.gear : [];
  const out: ParsedGear[] = [];
  for (const row of rows) {
    const src = typeof row?.source_url === 'string' ? row.source_url.trim() : '';
    if (!/^https?:\/\//.test(src)) continue;                 // drop uncited
    const gearId = gearIndex.get(String(row?.gear ?? '').toLowerCase().trim());
    if (!gearId) continue;                                   // drop unmappable
    // invalid/absent confidence clamps to 'high' (a cited claim is corroborated
    // by ≥1 source); switch this default to 'low' if you prefer conservative.
    const confidence: Confidence = VALID.includes(row?.confidence) ? row.confidence : 'high';
    out.push({ gear_item_id: gearId, context: String(row?.context ?? '').slice(0, 120), source_url: src, confidence });
  }
  return out;
}
```

(Note: the confidence line keeps the explicit clamp — invalid values clamp to `'high'` only when the model over-claims a recognized-but-out-of-range token; truly absent confidence also defaults `'high'` since a cited claim is at least corroborated by one source. Adjust default to `'low'` here if you prefer conservative defaults — single-line change, covered by the test's expectation.)

- [ ] **Step 4: Run test, verify pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-api/src/lookup/parse.ts packages/timbria-api/test/parse.test.ts
git commit -m "feat(timbria-api): trust-critical lookup parser (drops uncited/unmappable)"
```

---

### Task 13: Lookup module (web + LLM) behind an injectable interface

**Files:**
- Create: `packages/timbria-api/src/lookup/lookup.ts`
- Test: `packages/timbria-api/test/lookup.test.ts`

The module composes a `webSearch` fn + an `llm` fn (both injected) and runs them through `parseLookup`. Tests inject fakes — no live calls in CI.

- [ ] **Step 1: Write failing test**

```typescript
// test/lookup.test.ts
import { describe, it, expect } from 'vitest';
import { runLookup } from '../src/lookup/lookup.js';

describe('runLookup', () => {
  const gearIndex = new Map<string, number>([['ua 1176', 2]]);
  it('pipes search→llm→parse and returns drafts', async () => {
    const drafts = await runLookup('Some Artist', gearIndex, {
      webSearch: async () => 'web text mentioning an 1176',
      llm: async () => JSON.stringify({ gear: [{ gear: 'UA 1176', context: 'vocals', source_url: 'https://i', confidence: 'high' }] }),
      timeoutMs: 1000,
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0].gear_item_id).toBe(2);
  });
  it('returns [] when llm throws', async () => {
    const drafts = await runLookup('X', gearIndex, {
      webSearch: async () => 'txt', llm: async () => { throw new Error('boom'); }, timeoutMs: 1000 });
    expect(drafts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, verify fails** → FAIL.

- [ ] **Step 3: Create src/lookup/lookup.ts**

```typescript
import { parseLookup, type ParsedGear } from './parse.js';

export interface LookupDeps {
  webSearch: (query: string) => Promise<string>;
  llm: (prompt: string) => Promise<string>;
  timeoutMs: number;
}

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export async function runLookup(artist: string, gearIndex: Map<string, number>, deps: LookupDeps): Promise<ParsedGear[]> {
  try {
    const evidence = await withTimeout(deps.webSearch(`${artist} studio gear equipment signal chain`), deps.timeoutMs);
    const prompt = `From the following sources about ${artist}, extract studio gear as JSON ` +
      `{"gear":[{"gear","context","source_url","confidence":"low|med|high"}]}. ` +
      `Only include items with a real source_url from the text. Sources:\n${evidence}`;
    const raw = await withTimeout(deps.llm(prompt), deps.timeoutMs);
    return parseLookup(raw, gearIndex);
  } catch {
    return [];
  }
}
```

Production wiring (used by the route, not under test): `webSearch` = WebFetch/search util; `llm` = Anthropic Messages API call using `ANTHROPIC_API_KEY`. Both live behind this interface so CI never calls out.

- [ ] **Step 4: Run test, verify pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-api/src/lookup/lookup.ts packages/timbria-api/test/lookup.test.ts
git commit -m "feat(timbria-api): lookup orchestration with injectable web+llm + timeout"
```

---

### Task 14: Lookup route — rate-limit, cache, insert drafts (Pro-gated)

**Files:**
- Create: `packages/timbria-api/src/lookup/routes.ts`
- Modify: `packages/timbria-api/src/index.ts` (mount, wire prod deps + tier gate)
- Test: `packages/timbria-api/test/lookup-routes.test.ts`

- [ ] **Step 1: Write failing test** (inject fake lookup; assert drafts persisted + one-per-artist cache)

```typescript
// test/lookup-routes.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import express from 'express';
import { setDbForTest } from '../src/db.js';
import { runCatalogMigration, insertFxType, insertGear } from '../src/catalog/db.js';
import { runArtistMigration, listDrafts } from '../src/artists/db.js';
import { makeLookupRouter } from '../src/lookup/routes.js';

let calls = 0;
function app() {
  const a = express(); a.use(express.json());
  a.use((req, _res, next) => { (req as any).userEmail = 'pro@x.com'; next(); });
  a.use('/api', makeLookupRouter({
    resolveTier: async () => 'pro',
    doLookup: async () => { calls++; return [{ gear_item_id: 1, context: 'vox', source_url: 'https://s', confidence: 'high' as const }]; },
  }));
  return a;
}
beforeEach(() => {
  calls = 0; setDbForTest(new Database(':memory:')); runCatalogMigration(); runArtistMigration();
  const fx = insertFxType({ name: 'X', category: 'reverb', fingerprint: '', tells: '', era: '', typical_use: '' });
  insertGear({ name: 'Unit', fx_type_id: fx, manufacturer: '', kind: 'hardware' });
});

describe('lookup route', () => {
  it('inserts drafts and caches by artist (no second lookup within window)', async () => {
    const a = app();
    const r1 = await request(a).post('/api/artists/NewArtist/lookup');
    expect(r1.status).toBe(200);
    expect(listDrafts().length).toBe(1);
    await request(a).post('/api/artists/NewArtist/lookup'); // cached
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: Run, verify fails** → FAIL.

- [ ] **Step 3: Create src/lookup/routes.ts**

```typescript
import { Router } from 'express';
import { getDb } from '../db.js';
import { insertArtist, insertArtistGear, findArtistByName } from '../artists/db.js';
import type { ParsedGear } from './parse.js';
import type { Tier } from '../auth/tier.js';

export interface LookupRouteDeps {
  resolveTier: (email: string | null) => Promise<Tier>;
  doLookup: (artist: string, gearIndex: Map<string, number>) => Promise<ParsedGear[]>;
}

export function makeLookupRouter(deps: LookupRouteDeps): Router {
  const r = Router();
  const lastRun = new Map<string, number>();
  const CACHE_MS = 24 * 60 * 60_000;

  r.post('/artists/:name/lookup', async (req, res) => {
    const tier = await deps.resolveTier((req as any).userEmail ?? null);
    if (tier !== 'pro' && tier !== 'research') return res.status(402).json({ error: 'upgrade required' });

    const name = req.params.name;
    if (Date.now() - (lastRun.get(name.toLowerCase()) ?? 0) < CACHE_MS)
      return res.json({ status: 'cached', inserted: 0 });

    const gearIndex = new Map<string, number>(
      (getDb().prepare('SELECT id, lower(name) AS n FROM gear_item').all() as any[]).map(x => [x.n, x.id]));
    const drafts = await deps.doLookup(name, gearIndex);
    lastRun.set(name.toLowerCase(), Date.now());
    if (drafts.length === 0) return res.json({ status: 'no-sourced-gear', inserted: 0 });

    const artistId = findArtistByName(name)?.id
      ?? insertArtist({ name, role: '', era: '', genre: '', notes: '' });
    const tx = getDb().transaction((rows: ParsedGear[]) => {
      for (const d of rows) insertArtistGear({ artist_id: artistId, gear_item_id: d.gear_item_id,
        context: d.context, source_url: d.source_url, confidence: d.confidence,
        status: 'draft', added_by: 'llm-lookup', reviewed_at: null });
    });
    tx(drafts);
    return res.json({ status: 'drafted', inserted: drafts.length });
  });
  return r;
}
```

- [ ] **Step 4: Run test, verify pass** → PASS.

- [ ] **Step 5: Wire prod deps in src/index.ts** — build `runLookup` with real `webSearch`/`llm`, pass `makeLookupRouter({ resolveTier: tierResolver, doLookup: (a,gi) => runLookup(a, gi, prodDeps) })`, mount at `/api`.

- [ ] **Step 6: Commit**

```bash
git add packages/timbria-api/src
git commit -m "feat(timbria-api): pro-gated lookup route — rate-limit, cache, draft insert"
```

---

### Task 15: "Look it up" button in Artists UI

**Files:**
- Modify: `packages/timbria-ui/src/sections/ArtistsSection.tsx`
- Test: `packages/timbria-ui/src/__tests__/lookup-button.test.tsx`

- [ ] **Step 1: Write failing test** (unknown artist → button → posts lookup → re-fetches)

```tsx
// src/__tests__/lookup-button.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArtistsSection } from '../sections/ArtistsSection';
const post = vi.fn(async () => ({ status: 'drafted', inserted: 1 }));
let calls = 0;
vi.mock('../api', () => ({
  postJSON: (...a: any[]) => post(...a),
  getJSON: vi.fn(async (p: string) => {
    if (p.includes('/api/artists/')) { calls++; if (calls === 1) throw new Error('404');
      return { artist: { name: 'New' }, gear: [{ id: 1, gear_name: 'EMT 140', context: 'vox', source_url: 'https://s', confidence: 'high', status: 'draft' }] }; }
    throw new Error('x'); }),
}));
describe('look it up', () => {
  it('shows the button for unknown artist and re-fetches after lookup', async () => {
    render(<ArtistsSection />);
    fireEvent.change(screen.getByPlaceholderText(/artist/i), { target: { value: 'New' } });
    fireEvent.click(screen.getByText(/search/i));
    await screen.findByText(/no sourced gear/i);
    fireEvent.click(screen.getByText(/look it up/i));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/artists/New/lookup', {}));
    await waitFor(() => expect(screen.getByText('EMT 140')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run, verify fails** → FAIL.

- [ ] **Step 3: Add the button to ArtistsSection.tsx** — when `err` (unknown artist) is set, render a "Look it up" button that `postJSON('/api/artists/<name>/lookup', {})` then re-runs `search()`.

```tsx
// add inside ArtistsSection, after {err && <p>{err}</p>}:
{err && <button onClick={async () => { await postJSON(`/api/artists/${encodeURIComponent(name)}/lookup`, {}); search(); }}>Look it up</button>}
// and import postJSON from '../api'
```

- [ ] **Step 4: Run test, verify pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/timbria-ui/src
git commit -m "feat(timbria-ui): 'Look it up' triggers lookup + refresh (slice 3)"
```

**✅ Slice 3 demoable:** searching an unknown artist offers "Look it up"; it drafts cited gear into the registry (Pro-gated), which then appears badged "unverified" until approved in Review.

---

## Task 16: Deployment (SRV-2)

**Files:**
- Create: `packages/timbria-api/Dockerfile` (mirror analyzer's node:20-alpine multi-copy build)
- Modify: `~/docker-compose.yml` (SRV-2) — add `timbria-api` (port 3061, env: `TIMBRIA_DB=/data/timbria.db`, `OWNER_EMAIL`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `REVENUECAT_API_KEY`, `ANTHROPIC_API_KEY`; volume `timbria-data:/data`) and an nginx-served `timbria-ui` build container
- Modify: SRV-2 Windows portproxy (auto-detected) + Cloudflare tunnel ingress `timbria.tendrid.us` → `timbria-ui` + CF Access app (owner + friends) — via the shared CF token, `cloudflared tunnel route dns` for the CNAME

- [ ] **Step 1:** Write `Dockerfile` for `timbria-api` mirroring `packages/analyzer/Dockerfile` (copy core? not needed — Timbria doesn't import core; copy only timbria-api package + root lockfile, `npm install --workspaces`, `CMD tsx src/index.ts`).
- [ ] **Step 2:** Add both services to `~/docker-compose.yml`; `docker compose build timbria-api timbria-ui && docker compose up -d`.
- [ ] **Step 3:** Add CF tunnel ingress + DNS + Access app for `timbria.tendrid.us` (owner-gated `#review`, friends allowed elsewhere) using the documented shared-token + `cloudflared tunnel route dns` procedure.
- [ ] **Step 4:** Verify end-to-end from outside: Access challenge → catalog loads → identify walks → (owner) review tab visible.
- [ ] **Step 5: Commit** compose + Dockerfile.

```bash
git add packages/timbria-api/Dockerfile
git commit -m "feat(timbria): deployment — container + tunnel + access"
```

---

## Notes for the implementer

- **ESM:** all intra-package imports use `.js` suffixes even from `.ts` files (matches `analyzer`).
- **Test isolation:** every db test calls `setDbForTest(new Database(':memory:'))` then the needed `runXMigration()` — never touches the real `timbria.db`.
- **No live network in CI:** auth verifier, tier fetch, web search, and LLM are all injected; tests pass fakes. Production wiring lives only in `index.ts` and is excluded from unit tests via the `NODE_ENV !== 'test'` guard.
- **Slice independence:** Slice 1 ships with zero auth/LLM; Slice 2 adds auth/tiers on curated data; Slice 3 adds the LLM lookup last. Each slice ends at a green test suite and a demoable app.
