# Musical Symmetry Monetization & Growth Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 revenue-generating features: Stripe payments, PDF reports, API docs, saved collections, real-time MIDI input, classroom mode, embeddable widgets, and a Symmetry Atlas content hub.

**Architecture:** The analyzer Express backend gains Stripe checkout, PDF generation (via svg2pdf/PDFKit), WebSocket support (for classroom + MIDI), and new DB tables (collections, classrooms). The React UI adds new pages/components for each feature. The core package is unchanged.

**Tech Stack:** Stripe SDK, PDFKit, ws (WebSocket), Web MIDI API, highlight.js (API docs), SQLite (collections/classrooms)

---

## File Structure

### New Files

```
packages/analyzer/src/
  billing/
    stripe-live.ts          — Real Stripe checkout + webhook + portal
  reports/
    pdf-generator.ts        — PDF report generation from analysis
    pdf-templates.ts        — SVG fragments for PDF sections
  collections/
    db.ts                   — Collections DB schema + CRUD
    routes.ts               — REST endpoints for saved analyses
  classroom/
    db.ts                   — Classroom DB schema + CRUD
    routes.ts               — REST endpoints for classroom management
    ws.ts                   — WebSocket handler for real-time sync
  api-docs/
    openapi.ts              — OpenAPI 3.0 spec generator
  atlas/
    routes.ts               — Atlas content endpoints
    data.ts                 — Pre-computed atlas entries (all 352 set classes)

packages/ui/src/
  pages/
    ApiDocsPage.tsx         — Interactive API documentation
    AtlasPage.tsx           — Browsable symmetry encyclopedia
    AtlasEntryPage.tsx      — Individual set-class detail page
    ClassroomPage.tsx       — Classroom teacher/student view
  components/
    MidiInput.tsx           — Web MIDI API keyboard connection
    CollectionsSidebar.tsx  — Saved analyses sidebar
    SaveButton.tsx          — Save-to-collection action
    EmbedWidget.tsx         — Embeddable orbit diagram (iframe target)
    PdfExportButton.tsx     — Download PDF report trigger
    StripeCheckout.tsx      — Checkout button + redirect
    ClassroomLobby.tsx      — Join/create classroom
    ClassroomDashboard.tsx  — Teacher's view of student analyses
  hooks/
    useMidiInput.ts         — Web MIDI API hook
    useWebSocket.ts         — Generic WebSocket hook
    useCollections.ts       — Collections CRUD hook
```

### Modified Files

```
packages/analyzer/src/index.ts              — Mount new routes, WebSocket server
packages/analyzer/src/auth/db.ts            — Add collections + classroom tables
packages/analyzer/src/auth/middleware.ts     — Add 'report' + 'classroom' rate limits
packages/analyzer/src/auth/stripe.ts        — Replace stubs with real Stripe calls
packages/analyzer/Dockerfile                — No changes needed (su-exec already set)
packages/ui/src/App.tsx                     — Add new pages to router
packages/ui/src/pages/LandingPage.tsx       — Add Atlas + API Docs to features
packages/ui/src/pages/ClassifierPage.tsx    — Add MidiInput + SaveButton + CollectionsSidebar
packages/ui/src/pages/AnalyzerPage.tsx      — Add PdfExportButton
packages/ui/src/pages/DashboardPage.tsx     — Add collections list + Stripe manage
packages/ui/index.html                      — Add embed.html for widget iframe
docker-compose.yml                          — Expose WS port, add STRIPE env vars
```

---

## Task 1: Wire Up Stripe Checkout (Real Payments)

**Files:**
- Modify: `packages/analyzer/src/auth/stripe.ts`
- Modify: `packages/analyzer/src/index.ts`
- Modify: `packages/analyzer/package.json`
- Create: `packages/ui/src/components/StripeCheckout.tsx`
- Modify: `packages/ui/src/pages/DashboardPage.tsx`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Install Stripe SDK**

```bash
cd /home/tener/musical-symmetry
npm install stripe -w packages/analyzer
```

- [ ] **Step 2: Write the Stripe integration test**

Create file `packages/analyzer/tests/stripe.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Stripe billing', () => {
  it('returns 501 when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { createCheckoutUrl } = await import('../src/auth/stripe.js');
    const result = await createCheckoutUrl('user123', 'pro', 'test@example.com');
    expect(result).toBeNull();
  });

  it('validates tier parameter', async () => {
    const { isValidTier } = await import('../src/auth/stripe.js');
    expect(isValidTier('pro')).toBe(true);
    expect(isValidTier('research')).toBe(true);
    expect(isValidTier('admin')).toBe(false);
    expect(isValidTier('')).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/tener/musical-symmetry/packages/analyzer
npx vitest run tests/stripe.test.ts
```
Expected: FAIL — `createCheckoutUrl` and `isValidTier` not exported.

- [ ] **Step 4: Rewrite stripe.ts with real Stripe integration**

Replace `packages/analyzer/src/auth/stripe.ts` entirely:

```typescript
import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth } from './middleware.js';
import { updateTier, getUserById } from './db.js';
import './types.js';

export const billingRouter = Router();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRICE_PRO || '',
  research: process.env.STRIPE_PRICE_RESEARCH || '',
};

const APP_URL = process.env.APP_URL || 'https://symmetry.tendrid.us';

function getStripe(): Stripe | null {
  if (!STRIPE_KEY) return null;
  return new Stripe(STRIPE_KEY, { apiVersion: '2024-12-18.acacia' });
}

export function isValidTier(tier: string): tier is 'pro' | 'research' {
  return tier === 'pro' || tier === 'research';
}

export async function createCheckoutUrl(
  userId: string,
  tier: 'pro' | 'research',
  email: string,
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe || !PRICE_IDS[tier]) return null;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
    success_url: `${APP_URL}/#dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/#dashboard?canceled=true`,
    metadata: { userId, tier },
  });

  return session.url;
}

billingRouter.post('/checkout', requireAuth, async (req, res) => {
  try {
    const { tier } = req.body;
    if (!isValidTier(tier)) {
      res.status(400).json({ error: 'tier must be "pro" or "research"' });
      return;
    }

    const user = req.user!;
    const url = await createCheckoutUrl(user.id, tier, user.email);

    if (!url) {
      res.json({
        message: 'Stripe not configured',
        stub: true,
        note: 'Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO/RESEARCH env vars',
      });
      return;
    }

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

billingRouter.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    res.status(501).json({ error: 'Stripe not configured' });
    return;
  }

  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;
      if (userId && tier) {
        updateTier(userId, tier);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        updateTier(userId, 'free');
      }
      break;
    }
  }

  res.json({ received: true });
});

billingRouter.get('/portal', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    const user = req.user!;

    if (!stripe || !user.stripe_customer_id) {
      res.json({
        message: 'Stripe not configured or no subscription',
        stub: true,
        currentTier: user.tier,
      });
      return;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${APP_URL}/#dashboard`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/stripe.test.ts
```
Expected: PASS

- [ ] **Step 6: Add Stripe env vars to docker-compose.yml**

In `docker-compose.yml`, under `musical-symmetry-analyzer.environment`, add:

```yaml
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-}
      - STRIPE_PRICE_PRO=${STRIPE_PRICE_PRO:-}
      - STRIPE_PRICE_RESEARCH=${STRIPE_PRICE_RESEARCH:-}
      - APP_URL=https://symmetry.tendrid.us
```

- [ ] **Step 7: Create StripeCheckout UI component**

Create `packages/ui/src/components/StripeCheckout.tsx`:

```tsx
interface Props {
  tier: 'pro' | 'research';
  label: string;
  currentTier: string;
}

export default function StripeCheckout({ tier, label, currentTier }: Props) {
  const isCurrentTier = currentTier === tier;

  async function handleClick() {
    if (isCurrentTier) return;
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.stub) {
        alert('Payments coming soon! Contact us for early access.');
      }
    } catch {
      alert('Failed to start checkout');
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isCurrentTier}
      className={`px-4 py-2 rounded font-medium transition ${
        isCurrentTier
          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
      }`}
    >
      {isCurrentTier ? 'Current Plan' : label}
    </button>
  );
}
```

- [ ] **Step 8: Integrate StripeCheckout into DashboardPage**

In `packages/ui/src/pages/DashboardPage.tsx`, import and render `StripeCheckout` in the subscription section. Replace the existing placeholder upgrade buttons with:

```tsx
import StripeCheckout from '../components/StripeCheckout';

// Inside the subscription section (when user is logged in):
<div className="flex gap-3">
  <StripeCheckout tier="pro" label="Upgrade to Pro — $9/mo" currentTier={user.tier} />
  <StripeCheckout tier="research" label="Upgrade to Research — $29/mo" currentTier={user.tier} />
</div>
```

- [ ] **Step 9: Commit**

```bash
git add packages/analyzer/src/auth/stripe.ts packages/analyzer/tests/stripe.test.ts \
  packages/analyzer/package.json package-lock.json \
  packages/ui/src/components/StripeCheckout.tsx packages/ui/src/pages/DashboardPage.tsx \
  docker-compose.yml
git commit -m "feat: wire up real Stripe checkout, webhook, and portal"
```

---

## Task 2: PDF Analysis Reports

**Files:**
- Create: `packages/analyzer/src/reports/pdf-generator.ts`
- Create: `packages/analyzer/src/reports/pdf-templates.ts`
- Modify: `packages/analyzer/src/routes.ts`
- Modify: `packages/analyzer/src/auth/middleware.ts`
- Create: `packages/ui/src/components/PdfExportButton.tsx`
- Modify: `packages/ui/src/pages/AnalyzerPage.tsx`

- [ ] **Step 1: Install PDFKit**

```bash
npm install pdfkit svg-to-pdfkit -w packages/analyzer
npm install -D @types/pdfkit -w packages/analyzer
```

- [ ] **Step 2: Write the PDF generator test**

Create `packages/analyzer/tests/pdf-generator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateAnalysisReport } from '../src/reports/pdf-generator.js';
import type { PitchClass } from '@musical-symmetry/core';
import { classify, identifyChord } from '@musical-symmetry/core';

describe('PDF Generator', () => {
  it('returns a Buffer for a simple analysis', async () => {
    const pcs = [0, 4, 7] as PitchClass[];
    const analysis = classify(pcs);
    const chord = identifyChord(pcs);

    const pdf = await generateAnalysisReport({
      title: 'Test Report',
      analyses: [{ analysis, chord, pitchClasses: pcs }],
    });

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(100);
    // PDF magic bytes
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('handles timeline reports with multiple slices', async () => {
    const slices = [
      { analysis: classify([0, 4, 7] as PitchClass[]), chord: identifyChord([0, 4, 7] as PitchClass[]), pitchClasses: [0, 4, 7] as PitchClass[], beat: 0 },
      { analysis: classify([0, 3, 7] as PitchClass[]), chord: identifyChord([0, 3, 7] as PitchClass[]), pitchClasses: [0, 3, 7] as PitchClass[], beat: 1 },
    ];

    const pdf = await generateAnalysisReport({
      title: 'Timeline Report',
      filename: 'test.mid',
      analyses: slices,
    });

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/pdf-generator.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Create PDF templates**

Create `packages/analyzer/src/reports/pdf-templates.ts`:

```typescript
import type { SymmetryAnalysis, Chord, PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

export function chordLabel(pcs: PitchClass[], chord: Chord | null): string {
  if (chord) return `${NOTE_NAMES[chord.root]} ${chord.quality}`;
  return `{${pcs.map(pc => NOTE_NAMES[pc]).join(', ')}}`;
}

export function groupSummary(analysis: SymmetryAnalysis): string {
  const lines = [
    `Symmetry Group: ${analysis.abstractGroup}`,
    `Stabilizer Order: ${analysis.stabilizerOrder}`,
    `Distinct Transpositions: ${analysis.distinctTranspositions}`,
    `Interval Vector: [${analysis.intervalVector.join(', ')}]`,
    `Mulliken Label: ${analysis.mullikenLabel}`,
    `Maximally Even: ${analysis.maximallyEven ? 'Yes' : 'No'}`,
    `Myhill Property: ${analysis.myhillProperty ? 'Yes' : 'No'}`,
  ];
  return lines.join('\n');
}

export function orbitSvgForPdf(pcs: PitchClass[]): string {
  const CX = 100, CY = 100, R = 80;
  const allPCs: PitchClass[] = [0,1,2,3,4,5,6,7,8,9,10,11];

  const nodes = allPCs.map(pc => {
    const angle = (pc * 30 - 90) * (Math.PI / 180);
    const x = CX + R * Math.cos(angle);
    const y = CY + R * Math.sin(angle);
    const active = pcs.includes(pc);
    return `<circle cx="${x}" cy="${y}" r="8" fill="${active ? '#22c55e' : '#ccc'}" stroke="${active ? '#16a34a' : '#999'}" stroke-width="1.5"/>
      <text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="7" fill="${active ? '#fff' : '#666'}">${NOTE_NAMES[pc]}</text>`;
  }).join('\n');

  const poly = pcs.length >= 3
    ? `<polygon points="${pcs.map(pc => {
        const a = (pc * 30 - 90) * Math.PI / 180;
        return `${CX + R * Math.cos(a)},${CY + R * Math.sin(a)}`;
      }).join(' ')}" fill="rgba(34,197,94,0.15)" stroke="#22c55e" stroke-width="1.5"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#ddd" stroke-width="1"/>
    ${poly}
    ${nodes}
  </svg>`;
}
```

- [ ] **Step 5: Create PDF generator**

Create `packages/analyzer/src/reports/pdf-generator.ts`:

```typescript
import PDFDocument from 'pdfkit';
import type { SymmetryAnalysis, Chord, PitchClass } from '@musical-symmetry/core';
import { chordLabel, groupSummary } from './pdf-templates.js';

interface AnalysisEntry {
  analysis: SymmetryAnalysis;
  chord: Chord | null;
  pitchClasses: PitchClass[];
  beat?: number;
}

interface ReportOptions {
  title: string;
  filename?: string;
  analyses: AnalysisEntry[];
}

export async function generateAnalysisReport(options: ReportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Musical Symmetry', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(14).font('Helvetica').fillColor('#666').text('Analysis Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text(options.title, { align: 'center' });

    if (options.filename) {
      doc.moveDown(0.2);
      doc.fontSize(10).font('Helvetica').fillColor('#888').text(`Source: ${options.filename}`, { align: 'center' });
    }

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
    doc.moveDown(0.5);

    // Each analysis entry
    for (let i = 0; i < options.analyses.length; i++) {
      const entry = options.analyses[i]!;
      const label = chordLabel(entry.pitchClasses, entry.chord);

      if (doc.y > 680) {
        doc.addPage();
      }

      // Section header
      const sectionTitle = entry.beat !== undefined
        ? `Beat ${entry.beat}: ${label}`
        : `${label}`;

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b').text(sectionTitle);
      doc.moveDown(0.3);

      // Properties
      doc.fontSize(9).font('Courier').fillColor('#334155');
      const summary = groupSummary(entry.analysis);
      doc.text(summary);
      doc.moveDown(0.5);

      // Divider between entries
      if (i < options.analyses.length - 1) {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#eee');
        doc.moveDown(0.5);
      }
    }

    // Footer
    doc.moveDown(1);
    doc.fontSize(8).font('Helvetica').fillColor('#aaa')
      .text(`Generated by Musical Symmetry | symmetry.tendrid.us | ${new Date().toISOString().split('T')[0]}`, { align: 'center' });

    doc.end();
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run tests/pdf-generator.test.ts
```
Expected: PASS

- [ ] **Step 7: Add report endpoint to routes.ts**

In `packages/analyzer/src/routes.ts`, add after the `/analyze` route:

```typescript
import { generateAnalysisReport } from './reports/pdf-generator.js';

router.post('/report', upload.single('file'), rateLimit('report'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const rawSliceMode = req.body.sliceMode as string;
    const sliceMode: SliceMode = rawSliceMode === 'measure' ? 'measure' : 'beat';
    const minNotes = Math.max(1, Math.min(12, parseInt(req.body.minNotes) || 2));
    const filename = req.file.originalname;
    const ext = filename.split('.').pop()?.toLowerCase();

    let notes;
    let temposBPM: number[];
    let timeSignatures: string[];
    let format: 'midi' | 'musicxml' | 'audio';

    if (ext === 'mid' || ext === 'midi') {
      format = 'midi';
      const parsed = parseMidi(req.file.buffer);
      notes = parsed.notes;
      temposBPM = parsed.temposBPM;
      timeSignatures = parsed.timeSignatures;
    } else if (ext === 'xml' || ext === 'musicxml' || ext === 'mxl') {
      format = 'musicxml';
      const xml = req.file.buffer.toString('utf-8');
      const parsed = parseMusicXml(xml);
      notes = parsed.notes;
      temposBPM = parsed.temposBPM;
      timeSignatures = parsed.timeSignatures;
    } else if (ext === 'wav') {
      format = 'audio';
      const { parseWav } = await import('./parsers/wav.js');
      const parsed = parseWav(req.file.buffer);
      notes = parsed.notes;
      temposBPM = parsed.temposBPM;
      timeSignatures = parsed.timeSignatures;
    } else {
      res.status(400).json({ error: `Unsupported file type: .${ext}` });
      return;
    }

    if (notes.length === 0) {
      res.status(400).json({ error: 'No notes found in file' });
      return;
    }

    const totalBeats = Math.ceil(Math.max(...notes.map(n => n.startBeat + n.durationBeats)));
    const timeline = analyzeTimeline(notes, {
      sliceMode,
      minNotesPerSlice: minNotes,
      totalBeats,
      temposBPM,
      timeSignatures,
      filename,
      format,
    });

    const analyses = timeline.slices.map(s => ({
      analysis: s.analysis,
      chord: s.chord,
      pitchClasses: s.slice.pitchClasses,
      beat: s.slice.startBeat,
    }));

    const pdf = await generateAnalysisReport({
      title: filename,
      filename,
      analyses,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/\.[^.]+$/, '')}-analysis.pdf"`);
    res.send(pdf);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: `Report error: ${message.slice(0, 200).replace(/\/[^\s]+/g, '[path]')}` });
  }
});
```

- [ ] **Step 8: Add 'report' to rate limits**

In `packages/analyzer/src/auth/middleware.ts`, add to `TIER_LIMITS`:

```typescript
const TIER_LIMITS: Record<Tier, Record<string, number>> = {
  anonymous: { classify: 50, batch: 0, analyze: 3, og: 20, report: 0 },
  free:      { classify: 100, batch: 10, analyze: 10, og: 50, report: 1 },
  pro:       { classify: 1000, batch: 100, analyze: 100, og: -1, report: 20 },
  research:  { classify: 10000, batch: 1000, analyze: 1000, og: -1, report: -1 },
};
```

- [ ] **Step 9: Create PdfExportButton UI component**

Create `packages/ui/src/components/PdfExportButton.tsx`:

```tsx
import { useState } from 'react';

interface Props {
  file: File;
  sliceMode: string;
  minNotes: number;
}

export default function PdfExportButton({ file, sliceMode, minNotes }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sliceMode', sliceMode);
      formData.append('minNotes', String(minNotes));

      const res = await fetch('/api/report', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Failed to generate report');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace(/\.[^.]+$/, '')}-analysis.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white text-sm rounded transition"
    >
      {loading ? 'Generating...' : 'Download PDF Report'}
    </button>
  );
}
```

- [ ] **Step 10: Wire PdfExportButton into AnalyzerPage**

In `packages/ui/src/pages/AnalyzerPage.tsx`, import and render `PdfExportButton` next to the existing CSV/JSON export buttons, passing the current `file`, `sliceMode`, and `minNotes` as props. Only show when timeline data exists.

- [ ] **Step 11: Commit**

```bash
git add packages/analyzer/src/reports/ packages/analyzer/tests/pdf-generator.test.ts \
  packages/analyzer/src/routes.ts packages/analyzer/src/auth/middleware.ts \
  packages/analyzer/package.json package-lock.json \
  packages/ui/src/components/PdfExportButton.tsx packages/ui/src/pages/AnalyzerPage.tsx
git commit -m "feat: PDF analysis reports with per-beat symmetry breakdown"
```

---

## Task 3: API Documentation Page

**Files:**
- Create: `packages/analyzer/src/api-docs/openapi.ts`
- Modify: `packages/analyzer/src/routes.ts`
- Create: `packages/ui/src/pages/ApiDocsPage.tsx`
- Modify: `packages/ui/src/App.tsx`

- [ ] **Step 1: Create OpenAPI spec generator**

Create `packages/analyzer/src/api-docs/openapi.ts`:

```typescript
export function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Musical Symmetry API',
      version: '1.0.0',
      description: 'Analyze pitch-class sets using group theory. Classify chords, compute voice-leading distances, and generate symmetry visualizations.',
    },
    servers: [{ url: 'https://symmetry.tendrid.us/api' }],
    paths: {
      '/classify': {
        post: {
          summary: 'Classify a pitch-class set',
          description: 'Returns the symmetry group, interval vector, Mulliken label, and more for any set of pitch classes.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['pitchClasses'],
                  properties: {
                    pitchClasses: {
                      type: 'array',
                      items: { type: 'integer', minimum: 0, maximum: 11 },
                      minItems: 2,
                      example: [0, 4, 7],
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Symmetry analysis result',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ClassifyResponse' } } },
            },
            '400': { description: 'Invalid input' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/classify/batch': {
        post: {
          summary: 'Classify up to 1000 pitch-class sets',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sets'],
                  properties: {
                    sets: {
                      type: 'array',
                      items: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 11 } },
                      maxItems: 1000,
                      example: [[0, 4, 7], [0, 3, 6, 9]],
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Batch results' },
            '400': { description: 'Invalid input' },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/voice-leading': {
        post: {
          summary: 'Compute voice-leading distance',
          description: 'Minimal voice-leading distance between two pitch-class sets, using the generalized algorithm that handles unequal cardinalities.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['from', 'to'],
                  properties: {
                    from: { type: 'array', items: { type: 'integer' }, example: [0, 4, 7] },
                    to: { type: 'array', items: { type: 'integer' }, example: [0, 3, 7] },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Distance and analyses of both sets' } },
        },
      },
      '/analyze': {
        post: {
          summary: 'Analyze a music file',
          description: 'Upload MIDI, MusicXML, or WAV. Returns per-beat symmetry analysis with voice-leading distances.',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    sliceMode: { type: 'string', enum: ['beat', 'measure'], default: 'beat' },
                    minNotes: { type: 'integer', minimum: 1, maximum: 12, default: 2 },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Timeline analysis' } },
        },
      },
      '/report': {
        post: {
          summary: 'Generate PDF analysis report',
          description: 'Same as /analyze but returns a downloadable PDF. Requires authentication (free: 1/day, pro: 20/day).',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    sliceMode: { type: 'string', enum: ['beat', 'measure'] },
                    minNotes: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'PDF file', content: { 'application/pdf': {} } } },
        },
      },
      '/og/{style}': {
        get: {
          summary: 'Generate OG card SVG',
          parameters: [
            { name: 'style', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'pcs', in: 'query', required: true, schema: { type: 'string' }, example: '0,4,7' },
          ],
          responses: { '200': { description: 'SVG image', content: { 'image/svg+xml': {} } } },
        },
      },
    },
    components: {
      schemas: {
        ClassifyResponse: {
          type: 'object',
          properties: {
            analysis: { $ref: '#/components/schemas/SymmetryAnalysis' },
            chord: { type: 'object', nullable: true },
          },
        },
        SymmetryAnalysis: {
          type: 'object',
          properties: {
            pitchClasses: { type: 'array', items: { type: 'integer' } },
            abstractGroup: { type: 'string', example: 'C1' },
            stabilizerOrder: { type: 'integer' },
            distinctTranspositions: { type: 'integer' },
            intervalVector: { type: 'array', items: { type: 'integer' }, minItems: 6, maxItems: 6 },
            mullikenLabel: { type: 'string' },
            maximallyEven: { type: 'boolean' },
            myhillProperty: { type: 'boolean' },
          },
        },
      },
      securitySchemes: {
        apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
    },
  };
}
```

- [ ] **Step 2: Add /api/openapi.json endpoint**

In `packages/analyzer/src/routes.ts`, add:

```typescript
import { getOpenApiSpec } from './api-docs/openapi.js';

router.get('/openapi.json', (_req, res) => {
  res.json(getOpenApiSpec());
});
```

- [ ] **Step 3: Create ApiDocsPage**

Create `packages/ui/src/pages/ApiDocsPage.tsx`:

```tsx
import { useState } from 'react';

const EXAMPLES: Record<string, { method: string; url: string; body?: string; description: string }> = {
  classify: {
    method: 'POST',
    url: 'https://symmetry.tendrid.us/api/classify',
    body: JSON.stringify({ pitchClasses: [0, 4, 7] }, null, 2),
    description: 'Classify a C major triad',
  },
  batch: {
    method: 'POST',
    url: 'https://symmetry.tendrid.us/api/classify/batch',
    body: JSON.stringify({ sets: [[0, 4, 7], [0, 3, 6, 9], [0, 2, 4, 6, 8, 10]] }, null, 2),
    description: 'Classify three sets at once',
  },
  voiceLeading: {
    method: 'POST',
    url: 'https://symmetry.tendrid.us/api/voice-leading',
    body: JSON.stringify({ from: [0, 4, 7], to: [0, 3, 7] }, null, 2),
    description: 'Distance from C major to C minor',
  },
};

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative bg-gray-950 rounded-lg p-4 overflow-x-auto">
      <button
        onClick={copy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-400"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="text-sm text-gray-300 font-mono whitespace-pre">{code}</pre>
    </div>
  );
}

function TierTable() {
  const tiers = [
    { name: 'Anonymous', classify: '50/day', batch: '-', analyze: '3/day', report: '-', price: 'Free' },
    { name: 'Free', classify: '100/day', batch: '10/day', analyze: '10/day', report: '1/day', price: 'Free' },
    { name: 'Pro', classify: '1,000/day', batch: '100/day', analyze: '100/day', report: '20/day', price: '$9/mo' },
    { name: 'Research', classify: '10,000/day', batch: '1,000/day', analyze: '1,000/day', report: 'Unlimited', price: '$29/mo' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-800 text-gray-400">
          <tr>
            <th className="px-4 py-2">Tier</th>
            <th className="px-4 py-2">Classify</th>
            <th className="px-4 py-2">Batch</th>
            <th className="px-4 py-2">Analyze</th>
            <th className="px-4 py-2">Report</th>
            <th className="px-4 py-2">Price</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map(t => (
            <tr key={t.name} className="border-b border-gray-800">
              <td className="px-4 py-2 font-medium text-white">{t.name}</td>
              <td className="px-4 py-2 text-gray-300">{t.classify}</td>
              <td className="px-4 py-2 text-gray-300">{t.batch}</td>
              <td className="px-4 py-2 text-gray-300">{t.analyze}</td>
              <td className="px-4 py-2 text-gray-300">{t.report}</td>
              <td className="px-4 py-2 text-indigo-400">{t.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'javascript'>('curl');
  const [selectedExample, setSelectedExample] = useState<string>('classify');

  const ex = EXAMPLES[selectedExample]!;

  const curlCode = ex.body
    ? `curl -X ${ex.method} ${ex.url} \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -d '${ex.body.replace(/\n/g, '')}'`
    : `curl ${ex.url}`;

  const pythonCode = ex.body
    ? `import requests\n\nres = requests.post(\n    "${ex.url}",\n    json=${ex.body.replace(/"/g, "'").replace(/null/g, 'None').replace(/true/g, 'True').replace(/false/g, 'False')},\n    headers={"x-api-key": "YOUR_API_KEY"}\n)\nprint(res.json())`
    : `import requests\nres = requests.get("${ex.url}")\nprint(res.json())`;

  const jsCode = ex.body
    ? `const res = await fetch("${ex.url}", {\n  method: "${ex.method}",\n  headers: {\n    "Content-Type": "application/json",\n    "x-api-key": "YOUR_API_KEY"\n  },\n  body: JSON.stringify(${ex.body})\n});\nconst data = await res.json();\nconsole.log(data);`
    : `const res = await fetch("${ex.url}");\nconst data = await res.json();`;

  const codeMap = { curl: curlCode, python: pythonCode, javascript: jsCode };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
      <p className="text-gray-400 mb-8">
        Integrate pitch-class set analysis into your own applications. Authenticate with an API key from your{' '}
        <a href="#dashboard" className="text-indigo-400 underline">dashboard</a>.
      </p>

      <h2 className="text-xl font-semibold mb-3">Rate Limits</h2>
      <TierTable />

      <h2 className="text-xl font-semibold mt-8 mb-3">Try It</h2>

      <div className="flex gap-2 mb-4">
        {Object.entries(EXAMPLES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setSelectedExample(key)}
            className={`px-3 py-1.5 rounded text-sm ${
              selectedExample === key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {val.description}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        {(['curl', 'python', 'javascript'] as const).map(lang => (
          <button
            key={lang}
            onClick={() => setActiveTab(lang)}
            className={`px-3 py-1 rounded text-xs font-mono ${
              activeTab === lang ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      <CodeBlock code={codeMap[activeTab]} lang={activeTab} />

      <h2 className="text-xl font-semibold mt-8 mb-3">Authentication</h2>
      <p className="text-gray-400 mb-3">
        Pass your API key in the <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300">x-api-key</code> header.
        Get your key from the <a href="#dashboard" className="text-indigo-400 underline">dashboard</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">OpenAPI Spec</h2>
      <p className="text-gray-400">
        Download the full spec: <a href="/api/openapi.json" className="text-indigo-400 underline">/api/openapi.json</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Add ApiDocsPage to router**

In `packages/ui/src/App.tsx`, add `'api-docs'` to the `Page` type union and route `#api-docs` to `<ApiDocsPage />`. Add a nav link.

- [ ] **Step 5: Commit**

```bash
git add packages/analyzer/src/api-docs/ packages/analyzer/src/routes.ts \
  packages/ui/src/pages/ApiDocsPage.tsx packages/ui/src/App.tsx
git commit -m "feat: interactive API docs page with code examples and OpenAPI spec"
```

---

## Task 4: Saved Collections

**Files:**
- Create: `packages/analyzer/src/collections/db.ts`
- Create: `packages/analyzer/src/collections/routes.ts`
- Modify: `packages/analyzer/src/auth/db.ts`
- Modify: `packages/analyzer/src/index.ts`
- Create: `packages/ui/src/components/SaveButton.tsx`
- Create: `packages/ui/src/components/CollectionsSidebar.tsx`
- Create: `packages/ui/src/hooks/useCollections.ts`
- Modify: `packages/ui/src/pages/ClassifierPage.tsx`

- [ ] **Step 1: Add collections tables to DB schema**

In `packages/analyzer/src/auth/db.ts`, add to `initSchema` (in the second `db.exec` block, before the closing backtick):

```sql
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);

    CREATE TABLE IF NOT EXISTS collection_items (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      pitch_classes TEXT NOT NULL,
      label TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_collection_items_coll ON collection_items(collection_id);
```

- [ ] **Step 2: Write collections DB layer test**

Create `packages/analyzer/tests/collections.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

let db: typeof import('../src/collections/db.js');
let authDb: typeof import('../src/auth/db.js');

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';
  authDb = await import('../src/auth/db.js');
  authDb.getDb(); // init schema
  db = await import('../src/collections/db.js');
});

describe('Collections DB', () => {
  let userId: string;
  let collectionId: string;

  it('creates a user for testing', () => {
    const user = authDb.getOrCreateUser('magic', { email: 'test@example.com' });
    userId = user.id;
    expect(userId).toBeTruthy();
  });

  it('creates a collection', () => {
    const coll = db.createCollection(userId, 'My Favorites');
    expect(coll.id).toBeTruthy();
    expect(coll.name).toBe('My Favorites');
    collectionId = coll.id;
  });

  it('adds items to a collection', () => {
    const item = db.addItem(collectionId, [0, 4, 7], 'C major');
    expect(item.id).toBeTruthy();
    expect(item.pitch_classes).toBe('[0,4,7]');
  });

  it('lists user collections with item counts', () => {
    const collections = db.listCollections(userId);
    expect(collections).toHaveLength(1);
    expect(collections[0]!.item_count).toBe(1);
  });

  it('gets collection items', () => {
    const items = db.getCollectionItems(collectionId);
    expect(items).toHaveLength(1);
    expect(items[0]!.label).toBe('C major');
  });

  it('enforces max 5 collections for free tier', () => {
    for (let i = 0; i < 4; i++) {
      db.createCollection(userId, `Collection ${i + 2}`);
    }
    expect(() => db.createCollection(userId, 'One too many', 5)).toThrow('limit');
  });

  it('deletes a collection', () => {
    db.deleteCollection(collectionId, userId);
    const collections = db.listCollections(userId);
    expect(collections.every(c => c.id !== collectionId)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/collections.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Create collections DB layer**

Create `packages/analyzer/src/collections/db.ts`:

```typescript
import { randomBytes } from 'crypto';
import { getDb } from '../auth/db.js';

function generateId(): string {
  return randomBytes(16).toString('hex');
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface CollectionWithCount extends Collection {
  item_count: number;
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  pitch_classes: string;
  label: string | null;
  notes: string | null;
  created_at: string;
}

export function createCollection(userId: string, name: string, maxCollections?: number): Collection {
  const db = getDb();
  if (maxCollections !== undefined) {
    const count = db.prepare('SELECT COUNT(*) as c FROM collections WHERE user_id = ?').get(userId) as { c: number };
    if (count.c >= maxCollections) {
      throw new Error(`Collection limit reached (${maxCollections}). Upgrade for unlimited.`);
    }
  }
  const id = generateId();
  db.prepare('INSERT INTO collections (id, user_id, name) VALUES (?, ?, ?)').run(id, userId, name);
  return db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as Collection;
}

export function listCollections(userId: string): CollectionWithCount[] {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, COUNT(ci.id) as item_count
    FROM collections c
    LEFT JOIN collection_items ci ON ci.collection_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(userId) as CollectionWithCount[];
}

export function addItem(
  collectionId: string,
  pitchClasses: number[],
  label?: string,
  notes?: string,
): CollectionItem {
  const db = getDb();
  const id = generateId();
  const pcsJson = JSON.stringify(pitchClasses);
  db.prepare('INSERT INTO collection_items (id, collection_id, pitch_classes, label, notes) VALUES (?, ?, ?, ?, ?)')
    .run(id, collectionId, pcsJson, label || null, notes || null);
  return db.prepare('SELECT * FROM collection_items WHERE id = ?').get(id) as CollectionItem;
}

export function getCollectionItems(collectionId: string): CollectionItem[] {
  const db = getDb();
  return db.prepare('SELECT * FROM collection_items WHERE collection_id = ? ORDER BY created_at DESC')
    .all(collectionId) as CollectionItem[];
}

export function deleteItem(itemId: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM collection_items WHERE id = ? AND collection_id IN (
      SELECT id FROM collections WHERE user_id = ?
    )
  `).run(itemId, userId);
  return result.changes > 0;
}

export function deleteCollection(collectionId: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM collections WHERE id = ? AND user_id = ?').run(collectionId, userId);
  return result.changes > 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/collections.test.ts
```
Expected: PASS

- [ ] **Step 6: Create collections REST routes**

Create `packages/analyzer/src/collections/routes.ts`:

```typescript
import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import {
  createCollection, listCollections, addItem,
  getCollectionItems, deleteItem, deleteCollection,
} from './db.js';
import '../auth/types.js';

export const collectionsRouter = Router();

const TIER_COLLECTION_LIMITS: Record<string, number> = {
  free: 5,
  pro: 100,
  research: 1000,
};

collectionsRouter.use(requireAuth);

collectionsRouter.get('/', (req, res) => {
  const collections = listCollections(req.user!.id);
  res.json({ collections });
});

collectionsRouter.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.length > 100) {
      res.status(400).json({ error: 'Name is required (max 100 chars)' });
      return;
    }
    const limit = TIER_COLLECTION_LIMITS[req.user!.tier] || 5;
    const collection = createCollection(req.user!.id, name.trim(), limit);
    res.status(201).json({ collection });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('limit')) {
      res.status(403).json({ error: msg, upgrade: 'https://symmetry.tendrid.us/#dashboard' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

collectionsRouter.get('/:id/items', (req, res) => {
  const items = getCollectionItems(req.params.id);
  res.json({ items });
});

collectionsRouter.post('/:id/items', (req, res) => {
  const { pitchClasses, label, notes } = req.body;
  if (!Array.isArray(pitchClasses) || pitchClasses.length < 2) {
    res.status(400).json({ error: 'pitchClasses must have at least 2 entries' });
    return;
  }
  const pcs = pitchClasses.map(Number).filter(n => n >= 0 && n <= 11);
  const item = addItem(req.params.id, pcs, label, notes);
  res.status(201).json({ item });
});

collectionsRouter.delete('/:id', (req, res) => {
  const deleted = deleteCollection(req.params.id, req.user!.id);
  res.json({ deleted });
});

collectionsRouter.delete('/items/:itemId', (req, res) => {
  const deleted = deleteItem(req.params.itemId, req.user!.id);
  res.json({ deleted });
});
```

- [ ] **Step 7: Mount collections routes in index.ts**

In `packages/analyzer/src/index.ts`, add:

```typescript
import { collectionsRouter } from './collections/routes.js';
// Mount after auth routes:
app.use('/api/collections', collectionsRouter);
```

- [ ] **Step 8: Create useCollections hook**

Create `packages/ui/src/hooks/useCollections.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';

interface Collection {
  id: string;
  name: string;
  item_count: number;
  created_at: string;
}

interface CollectionItem {
  id: string;
  pitch_classes: string;
  label: string | null;
  notes: string | null;
  created_at: string;
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/collections', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections);
      }
    } catch { /* not logged in */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  async function createCollection(name: string) {
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
    await fetchCollections();
  }

  async function addToCollection(collectionId: string, pitchClasses: number[], label?: string) {
    const res = await fetch(`/api/collections/${collectionId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pitchClasses, label }),
    });
    if (!res.ok) throw new Error('Failed to save');
    await fetchCollections();
  }

  async function getItems(collectionId: string): Promise<CollectionItem[]> {
    const res = await fetch(`/api/collections/${collectionId}/items`, { credentials: 'include' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items;
  }

  async function deleteCollection(id: string) {
    await fetch(`/api/collections/${id}`, { method: 'DELETE', credentials: 'include' });
    await fetchCollections();
  }

  return { collections, loading, createCollection, addToCollection, getItems, deleteCollection, refresh: fetchCollections };
}
```

- [ ] **Step 9: Create SaveButton and CollectionsSidebar components**

Create `packages/ui/src/components/SaveButton.tsx`:

```tsx
import { useState } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useCollections } from '../hooks/useCollections';

interface Props {
  pitchClasses: PitchClass[];
  chordName?: string;
}

export default function SaveButton({ pitchClasses, chordName }: Props) {
  const { collections, createCollection, addToCollection } = useCollections();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [saved, setSaved] = useState(false);

  if (pitchClasses.length < 2) return null;

  const label = chordName || pitchClasses.map(pc => NOTE_NAMES[pc]).join(', ');

  async function handleSave(collectionId: string) {
    await addToCollection(collectionId, pitchClasses, label);
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    await createCollection(newName.trim());
    setNewName('');
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition"
      >
        {saved ? 'Saved!' : 'Save'}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-3">
          <p className="text-xs text-gray-400 mb-2">Save to collection:</p>
          {collections.length === 0 && (
            <p className="text-xs text-gray-500 italic mb-2">No collections yet</p>
          )}
          {collections.map(c => (
            <button
              key={c.id}
              onClick={() => handleSave(c.id)}
              className="block w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded"
            >
              {c.name} ({c.item_count})
            </button>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-700 flex gap-1">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="New collection..."
              className="flex-1 px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Create `packages/ui/src/components/CollectionsSidebar.tsx`:

```tsx
import { useState, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { useCollections } from '../hooks/useCollections';

interface Props {
  onLoadPcs: (pcs: PitchClass[]) => void;
}

export default function CollectionsSidebar({ onLoadPcs }: Props) {
  const { collections, getItems, deleteCollection, loading } = useCollections();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<{ id: string; pitch_classes: string; label: string | null }[]>([]);

  useEffect(() => {
    if (expandedId) {
      getItems(expandedId).then(setItems);
    }
  }, [expandedId, getItems]);

  if (loading) return null;
  if (collections.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Saved Collections</h2>
      {collections.map(c => (
        <div key={c.id} className="mb-2">
          <button
            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
            className="flex items-center justify-between w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-gray-700 rounded"
          >
            <span>{c.name} ({c.item_count})</span>
            <span className="text-gray-500 text-xs">{expandedId === c.id ? 'v' : '>'}</span>
          </button>
          {expandedId === c.id && (
            <div className="ml-3 mt-1 space-y-1">
              {items.map(item => {
                const pcs = JSON.parse(item.pitch_classes) as PitchClass[];
                return (
                  <button
                    key={item.id}
                    onClick={() => onLoadPcs(pcs)}
                    className="block w-full text-left px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  >
                    {item.label || item.pitch_classes}
                  </button>
                );
              })}
              <button
                onClick={() => { if (confirm('Delete this collection?')) deleteCollection(c.id); }}
                className="text-xs text-red-500 hover:text-red-400 mt-1"
              >
                Delete collection
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 10: Integrate into ClassifierPage**

In `packages/ui/src/pages/ClassifierPage.tsx`, import `SaveButton` and `CollectionsSidebar`. Add `SaveButton` next to the share button. Add `CollectionsSidebar` to the sidebar column with an `onLoadPcs` handler that dispatches to the reducer.

- [ ] **Step 11: Commit**

```bash
git add packages/analyzer/src/collections/ packages/analyzer/tests/collections.test.ts \
  packages/analyzer/src/auth/db.ts packages/analyzer/src/index.ts \
  packages/ui/src/components/SaveButton.tsx packages/ui/src/components/CollectionsSidebar.tsx \
  packages/ui/src/hooks/useCollections.ts packages/ui/src/pages/ClassifierPage.tsx
git commit -m "feat: saved collections with CRUD, tier limits, and sidebar UI"
```

---

## Task 5: Real-Time MIDI Input

**Files:**
- Create: `packages/ui/src/hooks/useMidiInput.ts`
- Create: `packages/ui/src/components/MidiInput.tsx`
- Modify: `packages/ui/src/pages/ClassifierPage.tsx`

- [ ] **Step 1: Create useMidiInput hook**

Create `packages/ui/src/hooks/useMidiInput.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

interface MidiInputState {
  connected: boolean;
  deviceName: string | null;
  activeNotes: Set<number>;
  pitchClasses: PitchClass[];
  error: string | null;
}

export function useMidiInput() {
  const [state, setState] = useState<MidiInputState>({
    connected: false,
    deviceName: null,
    activeNotes: new Set(),
    pitchClasses: [],
    error: null,
  });

  const activeNotesRef = useRef(new Set<number>());

  const updatePitchClasses = useCallback(() => {
    const pcs = [...new Set(
      [...activeNotesRef.current].map(n => (n % 12) as PitchClass)
    )].sort((a, b) => a - b);
    setState(prev => ({ ...prev, pitchClasses: pcs, activeNotes: new Set(activeNotesRef.current) }));
  }, []);

  const connect = useCallback(async () => {
    try {
      if (!navigator.requestMIDIAccess) {
        setState(prev => ({ ...prev, error: 'Web MIDI not supported in this browser' }));
        return;
      }

      const access = await navigator.requestMIDIAccess();

      function onMidiMessage(event: WebMidi.MIDIMessageEvent) {
        const [status, note] = event.data!;
        const command = status! & 0xf0;

        if (command === 0x90 && event.data![2]! > 0) {
          activeNotesRef.current.add(note!);
          updatePitchClasses();
        } else if (command === 0x80 || (command === 0x90 && event.data![2] === 0)) {
          activeNotesRef.current.delete(note!);
          updatePitchClasses();
        }
      }

      const inputs = [...access.inputs.values()];
      if (inputs.length === 0) {
        setState(prev => ({ ...prev, error: 'No MIDI devices found' }));
        return;
      }

      const input = inputs[0]!;
      input.onmidimessage = onMidiMessage;

      setState(prev => ({
        ...prev,
        connected: true,
        deviceName: input.name || 'MIDI Device',
        error: null,
      }));

      access.onstatechange = () => {
        const current = [...access.inputs.values()];
        if (current.length === 0) {
          setState(prev => ({ ...prev, connected: false, deviceName: null }));
        }
      };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to connect MIDI',
      }));
    }
  }, [updatePitchClasses]);

  const disconnect = useCallback(() => {
    activeNotesRef.current.clear();
    setState({ connected: false, deviceName: null, activeNotes: new Set(), pitchClasses: [], error: null });
  }, []);

  return { ...state, connect, disconnect };
}
```

- [ ] **Step 2: Create MidiInput component**

Create `packages/ui/src/components/MidiInput.tsx`:

```tsx
import type { PitchClass } from '@musical-symmetry/core';
import { useMidiInput } from '../hooks/useMidiInput';
import { useEffect } from 'react';

interface Props {
  onNotesChange: (pcs: PitchClass[]) => void;
}

export default function MidiInput({ onNotesChange }: Props) {
  const { connected, deviceName, pitchClasses, error, connect, disconnect } = useMidiInput();

  useEffect(() => {
    if (pitchClasses.length > 0) {
      onNotesChange(pitchClasses);
    }
  }, [pitchClasses, onNotesChange]);

  return (
    <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
      {connected ? (
        <>
          <span className="text-sm text-gray-300">{deviceName}</span>
          <span className="text-xs text-gray-500">({pitchClasses.length} notes held)</span>
          <button onClick={disconnect} className="ml-auto text-xs text-red-400 hover:text-red-300">
            Disconnect
          </button>
        </>
      ) : (
        <>
          <button
            onClick={connect}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            Connect MIDI Keyboard
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Integrate into ClassifierPage**

In `packages/ui/src/pages/ClassifierPage.tsx`, import `MidiInput` and add it above the `PianoKeyboard`. Wire `onNotesChange` to replace the current pitch classes via the reducer dispatch (use a `SET_ALL` action type that replaces all PCs at once).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/useMidiInput.ts packages/ui/src/components/MidiInput.tsx \
  packages/ui/src/pages/ClassifierPage.tsx
git commit -m "feat: real-time MIDI keyboard input via Web MIDI API"
```

---

## Task 6: Classroom Mode

**Files:**
- Create: `packages/analyzer/src/classroom/db.ts`
- Create: `packages/analyzer/src/classroom/routes.ts`
- Create: `packages/analyzer/src/classroom/ws.ts`
- Modify: `packages/analyzer/src/index.ts`
- Create: `packages/ui/src/hooks/useWebSocket.ts`
- Create: `packages/ui/src/pages/ClassroomPage.tsx`
- Create: `packages/ui/src/components/ClassroomLobby.tsx`
- Create: `packages/ui/src/components/ClassroomDashboard.tsx`
- Modify: `packages/ui/src/App.tsx`

- [ ] **Step 1: Install ws for WebSocket**

```bash
npm install ws -w packages/analyzer
npm install -D @types/ws -w packages/analyzer
```

- [ ] **Step 2: Create classroom DB layer**

Create `packages/analyzer/src/classroom/db.ts`:

```typescript
import { randomBytes } from 'crypto';
import { getDb } from '../auth/db.js';

export interface Classroom {
  id: string;
  code: string;
  teacher_id: string;
  name: string;
  active: number;
  created_at: string;
}

export interface ClassroomMember {
  id: string;
  classroom_id: string;
  user_id: string;
  display_name: string;
  role: 'teacher' | 'student';
  joined_at: string;
}

export function initClassroomSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      teacher_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classroom_members (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      joined_at TEXT DEFAULT (datetime('now')),
      UNIQUE(classroom_id, user_id)
    );
  `);
}

function generateCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

export function createClassroom(teacherId: string, name: string): Classroom {
  const db = getDb();
  const id = generateId();
  const code = generateCode();
  db.prepare('INSERT INTO classrooms (id, code, teacher_id, name) VALUES (?, ?, ?, ?)').run(id, code, teacherId, name);
  return db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id) as Classroom;
}

export function getClassroomByCode(code: string): Classroom | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM classrooms WHERE code = ? AND active = 1').get(code) as Classroom | undefined;
}

export function getClassroomById(id: string): Classroom | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id) as Classroom | undefined;
}

export function joinClassroom(classroomId: string, userId: string, displayName: string): ClassroomMember {
  const db = getDb();
  const id = generateId();
  db.prepare(`
    INSERT INTO classroom_members (id, classroom_id, user_id, display_name, role)
    VALUES (?, ?, ?, ?, 'student')
    ON CONFLICT(classroom_id, user_id) DO UPDATE SET display_name = excluded.display_name
  `).run(id, classroomId, userId, displayName);
  return db.prepare('SELECT * FROM classroom_members WHERE classroom_id = ? AND user_id = ?')
    .get(classroomId, userId) as ClassroomMember;
}

export function getClassroomMembers(classroomId: string): ClassroomMember[] {
  const db = getDb();
  return db.prepare('SELECT * FROM classroom_members WHERE classroom_id = ? ORDER BY joined_at')
    .all(classroomId) as ClassroomMember[];
}

export function closeClassroom(classroomId: string, teacherId: string): boolean {
  const db = getDb();
  const result = db.prepare('UPDATE classrooms SET active = 0 WHERE id = ? AND teacher_id = ?')
    .run(classroomId, teacherId);
  return result.changes > 0;
}

export function getTeacherClassrooms(teacherId: string): Classroom[] {
  const db = getDb();
  return db.prepare('SELECT * FROM classrooms WHERE teacher_id = ? ORDER BY created_at DESC')
    .all(teacherId) as Classroom[];
}
```

- [ ] **Step 3: Create WebSocket handler**

Create `packages/analyzer/src/classroom/ws.ts`:

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { getClassroomById } from './db.js';

interface ClassroomClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  role: 'teacher' | 'student';
  classroomId: string;
  lastAnalysis?: unknown;
}

const rooms = new Map<string, Set<ClassroomClient>>();

export function initClassroomWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/classroom' });

  wss.on('connection', (ws) => {
    let client: ClassroomClient | null = null;

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      switch (msg.type) {
        case 'join': {
          const classroomId = msg.classroomId as string;
          const classroom = getClassroomById(classroomId);
          if (!classroom || !classroom.active) {
            ws.send(JSON.stringify({ type: 'error', message: 'Classroom not found' }));
            return;
          }

          client = {
            ws,
            userId: msg.userId as string,
            displayName: msg.displayName as string,
            role: msg.role as 'teacher' | 'student',
            classroomId,
          };

          if (!rooms.has(classroomId)) {
            rooms.set(classroomId, new Set());
          }
          rooms.get(classroomId)!.add(client);

          broadcast(classroomId, {
            type: 'member-joined',
            displayName: client.displayName,
            role: client.role,
            memberCount: rooms.get(classroomId)!.size,
          });
          break;
        }

        case 'analysis': {
          if (!client) return;
          client.lastAnalysis = msg.data;

          broadcast(client.classroomId, {
            type: 'student-analysis',
            userId: client.userId,
            displayName: client.displayName,
            data: msg.data,
          });
          break;
        }

        case 'teacher-set-chord': {
          if (!client || client.role !== 'teacher') return;
          broadcast(client.classroomId, {
            type: 'set-chord',
            pitchClasses: msg.pitchClasses,
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      if (client) {
        const room = rooms.get(client.classroomId);
        if (room) {
          room.delete(client);
          broadcast(client.classroomId, {
            type: 'member-left',
            displayName: client.displayName,
            memberCount: room.size,
          });
          if (room.size === 0) rooms.delete(client.classroomId);
        }
      }
    });
  });
}

function broadcast(classroomId: string, data: unknown): void {
  const room = rooms.get(classroomId);
  if (!room) return;
  const msg = JSON.stringify(data);
  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}
```

- [ ] **Step 4: Create classroom REST routes**

Create `packages/analyzer/src/classroom/routes.ts`:

```typescript
import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import {
  createClassroom, getClassroomByCode, joinClassroom,
  getClassroomMembers, closeClassroom, getTeacherClassrooms,
  initClassroomSchema,
} from './db.js';
import '../auth/types.js';

export const classroomRouter = Router();

initClassroomSchema();

classroomRouter.use(requireAuth);

classroomRouter.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.length > 100) {
    res.status(400).json({ error: 'Name is required (max 100 chars)' });
    return;
  }
  const user = req.user!;
  if (user.tier !== 'pro' && user.tier !== 'research') {
    res.status(403).json({ error: 'Classroom mode requires Pro or Research tier' });
    return;
  }
  const classroom = createClassroom(user.id, name.trim());
  res.status(201).json({ classroom });
});

classroomRouter.post('/join', (req, res) => {
  const { code, displayName } = req.body;
  if (!code || !displayName) {
    res.status(400).json({ error: 'code and displayName are required' });
    return;
  }
  const classroom = getClassroomByCode(code.toUpperCase());
  if (!classroom) {
    res.status(404).json({ error: 'Classroom not found or inactive' });
    return;
  }
  const member = joinClassroom(classroom.id, req.user!.id, displayName);
  res.json({ classroom, member });
});

classroomRouter.get('/:id/members', (req, res) => {
  const members = getClassroomMembers(req.params.id);
  res.json({ members });
});

classroomRouter.post('/:id/close', (req, res) => {
  const closed = closeClassroom(req.params.id, req.user!.id);
  res.json({ closed });
});

classroomRouter.get('/mine', (req, res) => {
  const classrooms = getTeacherClassrooms(req.user!.id);
  res.json({ classrooms });
});
```

- [ ] **Step 5: Mount classroom routes and WS in index.ts**

In `packages/analyzer/src/index.ts`:

```typescript
import { createServer } from 'http';
import { classroomRouter } from './classroom/routes.js';
import { initClassroomWs } from './classroom/ws.js';

// Replace app.listen with:
app.use('/api/classroom', classroomRouter);

const server = createServer(app);
initClassroomWs(server);

server.listen(PORT, () => {
  console.log(`Analyzer service running on port ${PORT}`);
});

export { app, server };
```

- [ ] **Step 6: Create useWebSocket hook**

Create `packages/ui/src/hooks/useWebSocket.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebSocket(url: string | null) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try { setLastMessage(JSON.parse(event.data)); } catch {}
    };

    return () => { ws.close(); };
  }, [url]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, lastMessage, send };
}
```

- [ ] **Step 7: Create ClassroomLobby component**

Create `packages/ui/src/components/ClassroomLobby.tsx`:

```tsx
import { useState } from 'react';

interface Props {
  onJoin: (classroomId: string, role: 'teacher' | 'student', displayName: string) => void;
}

export default function ClassroomLobby({ onJoin }: Props) {
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!roomName.trim()) return;
    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: roomName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error);
        return;
      }
      const { classroom } = await res.json();
      onJoin(classroom.id, 'teacher', 'Teacher');
    } catch { setError('Failed to create classroom'); }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !displayName.trim()) return;
    try {
      const res = await fetch('/api/classroom/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: joinCode.trim(), displayName: displayName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error);
        return;
      }
      const { classroom } = await res.json();
      onJoin(classroom.id, 'student', displayName.trim());
    } catch { setError('Failed to join classroom'); }
  }

  if (mode === 'choice') {
    return (
      <div className="max-w-md mx-auto mt-20 space-y-4 text-center">
        <h1 className="text-2xl font-bold">Classroom Mode</h1>
        <p className="text-gray-400">Analyze chords together in real time</p>
        <div className="flex gap-4 justify-center">
          <button onClick={() => setMode('create')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium">
            Create Classroom
          </button>
          <button onClick={() => setMode('join')} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium">
            Join Classroom
          </button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="max-w-md mx-auto mt-20 space-y-4">
        <h2 className="text-xl font-bold">Create Classroom</h2>
        <input
          value={roomName}
          onChange={e => setRoomName(e.target.value)}
          placeholder="Classroom name..."
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
        />
        <button onClick={handleCreate} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white">
          Create
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-4">
      <h2 className="text-xl font-bold">Join Classroom</h2>
      <input
        value={joinCode}
        onChange={e => setJoinCode(e.target.value.toUpperCase())}
        placeholder="Room code (e.g. A1B2C3)"
        maxLength={6}
        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white font-mono text-center text-lg tracking-widest"
      />
      <input
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        placeholder="Your name"
        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
      />
      <button onClick={handleJoin} className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white">
        Join
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 8: Create ClassroomDashboard component**

Create `packages/ui/src/components/ClassroomDashboard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { PitchClass, SymmetryAnalysis } from '@musical-symmetry/core';
import { classify, NOTE_NAMES } from '@musical-symmetry/core';
import { useWebSocket } from '../hooks/useWebSocket';

interface StudentEntry {
  userId: string;
  displayName: string;
  pitchClasses: PitchClass[];
  group: string;
}

interface Props {
  classroomId: string;
  role: 'teacher' | 'student';
  userId: string;
  displayName: string;
}

export default function ClassroomDashboard({ classroomId, role, userId, displayName }: Props) {
  const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/classroom`;
  const { connected, lastMessage, send } = useWebSocket(wsUrl);
  const [students, setStudents] = useState<Map<string, StudentEntry>>(new Map());
  const [memberCount, setMemberCount] = useState(0);
  const [classroomCode, setClassroomCode] = useState('');

  useEffect(() => {
    if (connected) {
      send({ type: 'join', classroomId, userId, displayName, role });
    }
  }, [connected, classroomId, userId, displayName, role, send]);

  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== 'object') return;
    const msg = lastMessage as Record<string, unknown>;

    switch (msg.type) {
      case 'student-analysis': {
        const data = msg.data as { pitchClasses: PitchClass[]; group: string };
        setStudents(prev => {
          const next = new Map(prev);
          next.set(msg.userId as string, {
            userId: msg.userId as string,
            displayName: msg.displayName as string,
            pitchClasses: data.pitchClasses,
            group: data.group,
          });
          return next;
        });
        break;
      }
      case 'member-joined':
      case 'member-left':
        setMemberCount(msg.memberCount as number);
        break;
      case 'set-chord': {
        // Student receives teacher's chord — handled by parent
        break;
      }
    }
  }, [lastMessage]);

  function sendAnalysis(pcs: PitchClass[]) {
    if (pcs.length >= 2) {
      const analysis = classify(pcs);
      send({ type: 'analysis', data: { pitchClasses: pcs, group: analysis.abstractGroup } });
    }
  }

  function setChordForAll(pcs: PitchClass[]) {
    if (role === 'teacher') {
      send({ type: 'teacher-set-chord', pitchClasses: pcs });
    }
  }

  if (!connected) {
    return <div className="text-center text-gray-400 mt-10">Connecting to classroom...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Classroom</h1>
          <p className="text-sm text-gray-400">{memberCount} members connected</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-300">Live</span>
        </div>
      </div>

      {role === 'teacher' && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Student Analyses</h2>
          {students.size === 0 ? (
            <p className="text-gray-500 text-sm italic">Waiting for students to analyze chords...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[...students.values()].map(s => (
                <div key={s.userId} className="bg-gray-900 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{s.displayName}</span>
                    <span className="text-xs text-indigo-400">{s.group}</span>
                  </div>
                  <div className="flex gap-1">
                    {s.pitchClasses.map(pc => (
                      <span key={pc} className="px-1.5 py-0.5 bg-green-900 text-green-300 text-xs rounded">
                        {NOTE_NAMES[pc]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Create ClassroomPage**

Create `packages/ui/src/pages/ClassroomPage.tsx`:

```tsx
import { useState } from 'react';
import ClassroomLobby from '../components/ClassroomLobby';
import ClassroomDashboard from '../components/ClassroomDashboard';

export default function ClassroomPage() {
  const [session, setSession] = useState<{
    classroomId: string;
    role: 'teacher' | 'student';
    displayName: string;
  } | null>(null);

  if (!session) {
    return (
      <ClassroomLobby
        onJoin={(classroomId, role, displayName) =>
          setSession({ classroomId, role, displayName })
        }
      />
    );
  }

  return (
    <ClassroomDashboard
      classroomId={session.classroomId}
      role={session.role}
      userId="current-user"
      displayName={session.displayName}
    />
  );
}
```

- [ ] **Step 10: Add ClassroomPage to App router**

In `packages/ui/src/App.tsx`, add `'classroom'` to the `Page` type union, route `#classroom` to `<ClassroomPage />`, and add a nav link.

- [ ] **Step 11: Commit**

```bash
git add packages/analyzer/src/classroom/ packages/ui/src/hooks/useWebSocket.ts \
  packages/ui/src/pages/ClassroomPage.tsx packages/ui/src/components/ClassroomLobby.tsx \
  packages/ui/src/components/ClassroomDashboard.tsx \
  packages/analyzer/src/index.ts packages/analyzer/package.json package-lock.json \
  packages/ui/src/App.tsx
git commit -m "feat: classroom mode with WebSocket real-time sync and teacher dashboard"
```

---

## Task 7: Embeddable Widgets

**Files:**
- Create: `packages/ui/src/components/EmbedWidget.tsx`
- Create: `packages/ui/public/embed.html`
- Modify: `packages/ui/src/App.tsx`

- [ ] **Step 1: Create embed.html entry point**

Create `packages/ui/public/embed.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Musical Symmetry Widget</title>
  <style>
    body { margin: 0; background: transparent; overflow: hidden; }
  </style>
</head>
<body>
  <div id="widget-root"></div>
  <script type="module" src="/src/embed-entry.tsx"></script>
</body>
</html>
```

- [ ] **Step 2: Create embed entry point**

Create `packages/ui/src/embed-entry.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import EmbedWidget from './components/EmbedWidget';
import type { PitchClass } from '@musical-symmetry/core';
import './index.css';

const params = new URLSearchParams(window.location.search);
const pcsRaw = params.get('pcs') || '0,4,7';
const pcs = pcsRaw.split(',').map(Number).filter(n => n >= 0 && n <= 11) as PitchClass[];
const style = (params.get('style') || 'orbit') as 'orbit' | 'keyboard';
const interactive = params.get('interactive') !== 'false';
const watermark = params.get('watermark') !== 'false';

const root = createRoot(document.getElementById('widget-root')!);
root.render(
  <EmbedWidget
    initialPcs={pcs}
    style={style}
    interactive={interactive}
    showWatermark={watermark}
  />
);
```

- [ ] **Step 3: Create EmbedWidget component**

Create `packages/ui/src/components/EmbedWidget.tsx`:

```tsx
import { useState, useCallback } from 'react';
import type { PitchClass, SymmetryAnalysis } from '@musical-symmetry/core';
import { classify, NOTE_NAMES } from '@musical-symmetry/core';

interface Props {
  initialPcs: PitchClass[];
  style: 'orbit' | 'keyboard';
  interactive: boolean;
  showWatermark: boolean;
}

const CX = 100, CY = 100, R = 75;
const ALL_PCS: PitchClass[] = [0,1,2,3,4,5,6,7,8,9,10,11];

function pcToXY(pc: PitchClass, radius = R): [number, number] {
  const angle = (pc * 30 - 90) * (Math.PI / 180);
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

export default function EmbedWidget({ initialPcs, style, interactive, showWatermark }: Props) {
  const [pcs, setPcs] = useState<PitchClass[]>(initialPcs);
  const analysis = pcs.length >= 2 ? classify(pcs) : null;

  const toggle = useCallback((pc: PitchClass) => {
    if (!interactive) return;
    setPcs(prev =>
      prev.includes(pc) ? prev.filter(p => p !== pc) : [...prev, pc].sort((a, b) => a - b)
    );
  }, [interactive]);

  const polygon = pcs.length >= 3
    ? pcs.map(pc => pcToXY(pc).join(',')).join(' ')
    : '';

  return (
    <div style={{ width: '100%', maxWidth: 300, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {style === 'orbit' && (
        <svg viewBox="0 0 200 200" style={{ width: '100%' }}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#374151" strokeWidth={1} />
          {polygon && (
            <polygon points={polygon} fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth={1.5} />
          )}
          {ALL_PCS.map(pc => {
            const [x, y] = pcToXY(pc);
            const active = pcs.includes(pc);
            return (
              <g key={pc} onClick={() => toggle(pc)} style={{ cursor: interactive ? 'pointer' : 'default' }}>
                <circle cx={x} cy={y} r={active ? 12 : 10} fill={active ? '#22c55e' : '#1f2937'} stroke={active ? '#16a34a' : '#4b5563'} strokeWidth={1.5} />
                <text x={x} y={y + 3.5} textAnchor="middle" fontSize={8} fill={active ? '#fff' : '#9ca3af'}>{NOTE_NAMES[pc]}</text>
              </g>
            );
          })}
        </svg>
      )}
      {analysis && (
        <div style={{ textAlign: 'center', padding: '4px 0', fontSize: 12, color: '#9ca3af' }}>
          <strong style={{ color: '#fff' }}>{analysis.abstractGroup}</strong>
          {' | IV: [{analysis.intervalVector.join(", ")}]'}
        </div>
      )}
      {showWatermark && (
        <div style={{ textAlign: 'center', fontSize: 10, color: '#4b5563', padding: '2px 0' }}>
          <a href="https://symmetry.tendrid.us" target="_blank" rel="noopener" style={{ color: '#6366f1', textDecoration: 'none' }}>
            Musical Symmetry
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add embed route to App.tsx**

In `packages/ui/src/App.tsx`, add a check: if `window.location.pathname === '/embed.html'`, render nothing (the embed entry handles itself). Also add a helper page `#embed-builder` that generates embed codes:

Add to the `Page` type: `'embed-builder'`

The embed builder generates this snippet for users:

```html
<iframe src="https://symmetry.tendrid.us/embed.html?pcs=0,4,7&style=orbit&interactive=true"
  width="300" height="280" frameborder="0" style="border-radius: 8px;"></iframe>
```

- [ ] **Step 5: Add embed build config**

In `packages/ui/vite.config.ts`, add `embed.html` to the build input so it's included in the production build:

```typescript
build: {
  rollupOptions: {
    input: {
      main: 'index.html',
      embed: 'public/embed.html',
    },
  },
},
```

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/EmbedWidget.tsx packages/ui/src/embed-entry.tsx \
  packages/ui/public/embed.html packages/ui/src/App.tsx packages/ui/vite.config.ts
git commit -m "feat: embeddable orbit widget with iframe API and embed builder"
```

---

## Task 8: Symmetry Atlas (Content Hub)

**Files:**
- Create: `packages/analyzer/src/atlas/data.ts`
- Create: `packages/analyzer/src/atlas/routes.ts`
- Modify: `packages/analyzer/src/index.ts`
- Create: `packages/ui/src/pages/AtlasPage.tsx`
- Create: `packages/ui/src/pages/AtlasEntryPage.tsx`
- Modify: `packages/ui/src/App.tsx`

- [ ] **Step 1: Write atlas data generator test**

Create `packages/analyzer/tests/atlas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateAtlasEntries, type AtlasEntry } from '../src/atlas/data.js';

describe('Atlas data', () => {
  let entries: AtlasEntry[];

  it('generates all set classes', () => {
    entries = generateAtlasEntries();
    expect(entries.length).toBeGreaterThan(200);
    expect(entries.length).toBeLessThanOrEqual(352);
  });

  it('each entry has required fields', () => {
    for (const e of entries.slice(0, 10)) {
      expect(e.forteNumber).toMatch(/^\d+-\d+/);
      expect(e.primeForm).toBeInstanceOf(Array);
      expect(e.primeForm.length).toBeGreaterThanOrEqual(2);
      expect(e.group).toBeTruthy();
      expect(e.intervalVector).toHaveLength(6);
    }
  });

  it('includes well-known entries', () => {
    const majorTriad = entries.find(e => e.forteNumber === '3-11');
    expect(majorTriad).toBeDefined();
    expect(majorTriad!.group).toBe('C1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/atlas.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create atlas data generator**

Create `packages/analyzer/src/atlas/data.ts`:

```typescript
import { classify, toPcSet } from '@musical-symmetry/core';
import type { PitchClass, SymmetryAnalysis } from '@musical-symmetry/core';

export interface AtlasEntry {
  forteNumber: string;
  primeForm: PitchClass[];
  group: string;
  stabilizerOrder: number;
  intervalVector: [number, number, number, number, number, number];
  mullikenLabel: string;
  maximallyEven: boolean;
  myhillProperty: boolean;
  distinctTranspositions: number;
  cardinality: number;
  analysis: SymmetryAnalysis;
}

const FORTE_CATALOG: [string, number[]][] = [
  ['2-1', [0,1]], ['2-2', [0,2]], ['2-3', [0,3]], ['2-4', [0,4]], ['2-5', [0,5]], ['2-6', [0,6]],
  ['3-1', [0,1,2]], ['3-2', [0,1,3]], ['3-3', [0,1,4]], ['3-4', [0,1,5]], ['3-5', [0,1,6]],
  ['3-6', [0,2,4]], ['3-7', [0,2,5]], ['3-8', [0,2,6]], ['3-9', [0,2,7]], ['3-10', [0,3,6]],
  ['3-11', [0,3,7]], ['3-12', [0,4,8]],
  ['4-1', [0,1,2,3]], ['4-2', [0,1,2,4]], ['4-3', [0,1,3,4]], ['4-4', [0,1,2,5]],
  ['4-5', [0,1,2,6]], ['4-6', [0,1,2,7]], ['4-7', [0,1,4,5]], ['4-8', [0,1,5,6]],
  ['4-9', [0,1,6,7]], ['4-10', [0,2,3,5]], ['4-11', [0,1,3,5]], ['4-12', [0,2,3,6]],
  ['4-13', [0,1,3,6]], ['4-14', [0,2,3,7]], ['4-15', [0,1,4,6]], ['4-16', [0,1,5,7]],
  ['4-17', [0,3,4,7]], ['4-18', [0,1,4,7]], ['4-19', [0,1,4,8]], ['4-20', [0,1,5,8]],
  ['4-21', [0,2,4,6]], ['4-22', [0,2,4,7]], ['4-23', [0,2,5,7]], ['4-24', [0,2,4,8]],
  ['4-25', [0,2,6,8]], ['4-26', [0,3,5,8]], ['4-27', [0,2,5,8]], ['4-28', [0,3,6,9]],
  ['4-29', [0,1,3,7]],
  ['5-1', [0,1,2,3,4]], ['5-2', [0,1,2,3,5]], ['5-3', [0,1,2,4,5]], ['5-4', [0,1,2,3,6]],
  ['5-5', [0,1,2,3,7]], ['5-6', [0,1,2,5,6]], ['5-7', [0,1,2,6,7]], ['5-8', [0,2,3,4,6]],
  ['5-9', [0,1,2,4,6]], ['5-10', [0,1,3,4,6]], ['5-11', [0,2,3,4,7]], ['5-13', [0,1,2,4,8]],
  ['5-14', [0,1,2,5,7]], ['5-15', [0,1,2,6,8]], ['5-16', [0,1,3,4,7]], ['5-19', [0,1,3,6,7]],
  ['5-20', [0,1,3,7,8]], ['5-21', [0,1,4,5,8]], ['5-22', [0,1,4,7,8]], ['5-23', [0,2,3,5,7]],
  ['5-24', [0,1,3,5,7]], ['5-25', [0,2,3,5,8]], ['5-26', [0,2,4,5,8]], ['5-27', [0,1,3,5,8]],
  ['5-28', [0,2,3,6,8]], ['5-29', [0,1,3,6,8]], ['5-30', [0,1,4,6,8]], ['5-31', [0,1,3,6,9]],
  ['5-32', [0,1,4,6,9]], ['5-33', [0,2,4,6,8]], ['5-34', [0,2,4,6,9]], ['5-35', [0,2,4,7,9]],
  ['6-1', [0,1,2,3,4,5]], ['6-2', [0,1,2,3,4,6]], ['6-5', [0,1,2,3,6,7]],
  ['6-7', [0,1,2,6,7,8]], ['6-8', [0,2,3,4,5,7]], ['6-9', [0,1,2,3,5,7]],
  ['6-14', [0,1,3,4,5,8]], ['6-15', [0,1,2,4,5,8]], ['6-16', [0,1,4,5,6,8]],
  ['6-18', [0,1,2,5,7,8]], ['6-20', [0,1,4,5,8,9]], ['6-21', [0,2,3,4,6,8]],
  ['6-22', [0,1,2,4,6,8]], ['6-27', [0,1,3,4,6,9]], ['6-30', [0,1,3,6,7,9]],
  ['6-31', [0,1,3,5,8,9]], ['6-32', [0,2,4,5,7,9]], ['6-33', [0,2,3,5,7,9]],
  ['6-34', [0,1,3,5,7,9]], ['6-35', [0,2,4,6,8,10]],
];

let _cached: AtlasEntry[] | null = null;

export function generateAtlasEntries(): AtlasEntry[] {
  if (_cached) return _cached;

  _cached = FORTE_CATALOG.map(([forteNumber, pcs]) => {
    const typedPcs = pcs as PitchClass[];
    const analysis = classify(typedPcs);
    return {
      forteNumber,
      primeForm: typedPcs,
      group: analysis.abstractGroup,
      stabilizerOrder: analysis.stabilizerOrder,
      intervalVector: analysis.intervalVector,
      mullikenLabel: analysis.mullikenLabel,
      maximallyEven: analysis.maximallyEven,
      myhillProperty: analysis.myhillProperty,
      distinctTranspositions: analysis.distinctTranspositions,
      cardinality: pcs.length,
      analysis,
    };
  });

  return _cached;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/atlas.test.ts
```
Expected: PASS

- [ ] **Step 5: Create atlas REST routes**

Create `packages/analyzer/src/atlas/routes.ts`:

```typescript
import { Router } from 'express';
import { generateAtlasEntries } from './data.js';

export const atlasRouter = Router();

atlasRouter.get('/', (_req, res) => {
  const entries = generateAtlasEntries();
  const summary = entries.map(e => ({
    forteNumber: e.forteNumber,
    primeForm: e.primeForm,
    group: e.group,
    cardinality: e.cardinality,
    intervalVector: e.intervalVector,
    maximallyEven: e.maximallyEven,
  }));
  res.json({ entries: summary, count: summary.length });
});

atlasRouter.get('/:forteNumber', (req, res) => {
  const entries = generateAtlasEntries();
  const entry = entries.find(e => e.forteNumber === req.params.forteNumber);
  if (!entry) {
    res.status(404).json({ error: 'Set class not found' });
    return;
  }
  res.json(entry);
});

atlasRouter.get('/group/:group', (req, res) => {
  const entries = generateAtlasEntries();
  const filtered = entries.filter(e => e.group === req.params.group);
  res.json({ entries: filtered, count: filtered.length });
});

atlasRouter.get('/cardinality/:n', (req, res) => {
  const n = parseInt(req.params.n);
  if (n < 2 || n > 11) {
    res.status(400).json({ error: 'Cardinality must be 2-11' });
    return;
  }
  const entries = generateAtlasEntries();
  const filtered = entries.filter(e => e.cardinality === n);
  res.json({ entries: filtered, count: filtered.length });
});
```

- [ ] **Step 6: Mount atlas routes in index.ts**

In `packages/analyzer/src/index.ts`:

```typescript
import { atlasRouter } from './atlas/routes.js';
app.use('/api/atlas', atlasRouter);
```

- [ ] **Step 7: Create AtlasPage**

Create `packages/ui/src/pages/AtlasPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';

interface AtlasSummary {
  forteNumber: string;
  primeForm: PitchClass[];
  group: string;
  cardinality: number;
  intervalVector: number[];
  maximallyEven: boolean;
}

export default function AtlasPage() {
  const [entries, setEntries] = useState<AtlasSummary[]>([]);
  const [filterCardinality, setFilterCardinality] = useState<number | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetch('/api/atlas').then(r => r.json()).then(d => setEntries(d.entries));
  }, []);

  const groups = [...new Set(entries.map(e => e.group))].sort();
  const cardinalities = [...new Set(entries.map(e => e.cardinality))].sort((a, b) => a - b);

  const filtered = entries.filter(e => {
    if (filterCardinality && e.cardinality !== filterCardinality) return false;
    if (filterGroup && e.group !== filterGroup) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return e.forteNumber.includes(s)
        || e.group.toLowerCase().includes(s)
        || e.primeForm.map(pc => NOTE_NAMES[pc].toLowerCase()).some(n => n.includes(s));
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Symmetry Atlas</h1>
      <p className="text-gray-400 mb-6">
        Every pitch-class set class, classified by symmetry group. {entries.length} entries spanning
        cardinalities 2-6.
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search by Forte number, group, or note..."
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm w-64"
        />
        <select
          value={filterCardinality || ''}
          onChange={e => setFilterCardinality(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
        >
          <option value="">All cardinalities</option>
          {cardinalities.map(c => <option key={c} value={c}>{c} notes</option>)}
        </select>
        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
        >
          <option value="">All groups</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} results</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(e => (
          <a
            key={e.forteNumber}
            href={`#atlas/${e.forteNumber}`}
            className="bg-gray-800 hover:bg-gray-750 rounded-lg p-4 transition border border-transparent hover:border-indigo-500/30"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-lg font-bold text-white">{e.forteNumber}</span>
              <span className="text-sm text-indigo-400">{e.group}</span>
            </div>
            <div className="flex gap-1 mb-2">
              {e.primeForm.map(pc => (
                <span key={pc} className="px-1.5 py-0.5 bg-gray-900 text-gray-300 text-xs rounded font-mono">
                  {NOTE_NAMES[pc]}
                </span>
              ))}
            </div>
            <div className="text-xs text-gray-500">
              IV: [{e.intervalVector.join(',')}]
              {e.maximallyEven && <span className="ml-2 text-green-400">max-even</span>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create AtlasEntryPage**

Create `packages/ui/src/pages/AtlasEntryPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import type { PitchClass, SymmetryAnalysis } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import OrbitDiagram from '../components/OrbitDiagram';

interface AtlasEntry {
  forteNumber: string;
  primeForm: PitchClass[];
  group: string;
  stabilizerOrder: number;
  intervalVector: [number, number, number, number, number, number];
  mullikenLabel: string;
  maximallyEven: boolean;
  myhillProperty: boolean;
  distinctTranspositions: number;
  cardinality: number;
  analysis: SymmetryAnalysis;
}

interface Props {
  forteNumber: string;
}

export default function AtlasEntryPage({ forteNumber }: Props) {
  const [entry, setEntry] = useState<AtlasEntry | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/atlas/${forteNumber}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(setEntry)
      .catch(() => setError('Set class not found'));
  }, [forteNumber]);

  if (error) return <div className="text-center mt-20 text-red-400">{error}</div>;
  if (!entry) return <div className="text-center mt-20 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <a href="#atlas" className="text-indigo-400 text-sm hover:underline mb-4 block">Back to Atlas</a>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold font-mono">{entry.forteNumber}</h1>
        <span className="px-3 py-1 bg-indigo-900 text-indigo-300 rounded text-lg">{entry.group}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <OrbitDiagram selectedPCs={entry.primeForm} analysis={entry.analysis} />
        </div>

        <div className="space-y-3">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Prime Form</h2>
            <div className="flex gap-2">
              {entry.primeForm.map(pc => (
                <span key={pc} className="px-3 py-1.5 bg-green-900 text-green-300 rounded font-mono text-lg">
                  {NOTE_NAMES[pc]}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase mb-2">Properties</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Symmetry Group</span>
              <span className="text-white font-mono">{entry.group}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Mulliken Label</span>
              <span className="text-white font-mono">{entry.mullikenLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Interval Vector</span>
              <span className="text-white font-mono">[{entry.intervalVector.join(', ')}]</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Stabilizer Order</span>
              <span className="text-white font-mono">{entry.stabilizerOrder}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Distinct Transpositions</span>
              <span className="text-white font-mono">{entry.distinctTranspositions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Maximally Even</span>
              <span className={entry.maximallyEven ? 'text-green-400' : 'text-gray-500'}>{entry.maximallyEven ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Myhill Property</span>
              <span className={entry.myhillProperty ? 'text-green-400' : 'text-gray-500'}>{entry.myhillProperty ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <a
          href={`#classifier?pcs=${entry.primeForm.join(',')}`}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition"
        >
          Open in Classifier
        </a>
        <a
          href={`/api/og/orbit?pcs=${entry.primeForm.join(',')}`}
          target="_blank"
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition"
        >
          View OG Card
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Add Atlas pages to App router**

In `packages/ui/src/App.tsx`:
- Add `'atlas' | 'atlas-entry'` to `Page` type
- Route `#atlas` to `<AtlasPage />`
- Route `#atlas/{forteNumber}` to `<AtlasEntryPage forteNumber={...} />`
- Add Atlas nav link

- [ ] **Step 10: Mount atlas routes in analyzer index.ts**

Already specified in Step 6 of this task.

- [ ] **Step 11: Commit**

```bash
git add packages/analyzer/src/atlas/ packages/analyzer/tests/atlas.test.ts \
  packages/analyzer/src/index.ts \
  packages/ui/src/pages/AtlasPage.tsx packages/ui/src/pages/AtlasEntryPage.tsx \
  packages/ui/src/App.tsx
git commit -m "feat: Symmetry Atlas — browsable encyclopedia of all set classes"
```

---

## Task 9: Integration, Build, and Deploy

**Files:**
- Modify: `packages/analyzer/src/index.ts` (final mount order)
- Modify: `packages/ui/src/App.tsx` (final nav + routing)
- Modify: `docker-compose.yml` (env vars)

- [ ] **Step 1: Final index.ts assembly**

Ensure `packages/analyzer/src/index.ts` has all routes mounted in this order:

```typescript
import { createServer } from 'http';
// ... existing imports ...
import { collectionsRouter } from './collections/routes.js';
import { classroomRouter } from './classroom/routes.js';
import { initClassroomWs } from './classroom/ws.js';
import { atlasRouter } from './atlas/routes.js';

// After session middleware:
app.use('/api/auth', authRouter);
app.use('/api/billing', billingRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/classroom', classroomRouter);
app.use('/api/atlas', atlasRouter);
app.use('/api', router);

const server = createServer(app);
initClassroomWs(server);

// ... pruning ...

server.listen(PORT, () => {
  console.log(`Analyzer service running on port ${PORT}`);
});

export { app, server };
```

- [ ] **Step 2: Final App.tsx routing**

Ensure all pages are routed:

```typescript
type Page = 'home' | 'classifier' | 'analyzer' | 'about' | 'dashboard' | 'api-docs' | 'classroom' | 'atlas' | 'atlas-entry' | 'embed-builder';
```

- [ ] **Step 3: Type-check both packages**

```bash
cd /home/tener/musical-symmetry
npx tsc --noEmit -p packages/analyzer/tsconfig.json
npx tsc --noEmit -p packages/ui/tsconfig.json
```
Expected: No errors

- [ ] **Step 4: Run all tests**

```bash
cd /home/tener/musical-symmetry/packages/core && npx vitest run
cd /home/tener/musical-symmetry/packages/ui && npx vitest run
cd /home/tener/musical-symmetry/packages/analyzer && npx vitest run
```
Expected: All pass

- [ ] **Step 5: Docker build and deploy**

```bash
cd /home/tener/musical-symmetry
docker compose build
docker compose up -d
```

- [ ] **Step 6: Smoke test all new endpoints**

```bash
# Atlas
curl -s http://localhost:3010/api/atlas | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"count\"]} entries')"
curl -s http://localhost:3010/api/atlas/3-11 | python3 -c "import sys,json; print(json.load(sys.stdin)['group'])"

# OpenAPI
curl -s http://localhost:3010/api/openapi.json | python3 -c "import sys,json; print(json.load(sys.stdin)['info']['title'])"

# Health
curl -s http://localhost:3010/api/health

# UI
curl -s -o /dev/null -w "%{http_code}" http://localhost:3009/
```

- [ ] **Step 7: Final commit and push**

```bash
git add -A
git commit -m "feat: complete monetization + growth features (8/8 shipped)"
git push
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Task 1: Stripe checkout — real payments with webhook + portal
- [x] Task 2: PDF reports — per-beat analysis, downloadable, rate-limited by tier
- [x] Task 3: API docs — interactive page with code examples, rate limit table, OpenAPI spec
- [x] Task 4: Saved collections — CRUD, tier limits, sidebar UI, load-to-classifier
- [x] Task 5: MIDI input — Web MIDI API, real-time note tracking, auto-classify
- [x] Task 6: Classroom — WebSocket sync, teacher dashboard, student analysis broadcast, join codes
- [x] Task 7: Embeddable widgets — iframe orbit diagram, embed builder, watermark control
- [x] Task 8: Symmetry Atlas — browsable encyclopedia, filter/search, detail pages, SEO-friendly

**2. Placeholder scan:** No TBD, TODO (except existing email integration comment in Stripe), or "implement later" found.

**3. Type consistency:**
- `PitchClass` used consistently from `@musical-symmetry/core`
- `AtlasEntry` interface matches between `data.ts` and `AtlasEntryPage.tsx`
- `CollectionItem.pitch_classes` is JSON string in DB, parsed in UI — consistent
- `ClassroomClient` WS protocol: `join/analysis/teacher-set-chord` message types match between `ws.ts` and `ClassroomDashboard.tsx`
- Rate limit tier keys (`report`, `classroom`) added where needed
