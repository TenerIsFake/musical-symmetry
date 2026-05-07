# Chrometria Feature Wave — 2026-05-07

**App:** Musical Symmetry (Chrometria)
**Stack:** React + Vite + Tailwind SPA · TypeScript math library · Express API · SQLite (better-sqlite3)
**Repo layout:**
- `packages/core/src/` — pure math library (PcSet, symmetry, PLR, contour, rhythm, tuning)
- `packages/ui/src/` — React SPA (pages/, components/, hooks/, context/)
- `packages/analyzer/src/` — Express API (auth, assignments, contour, genre, classroom, collections, workspaces, digest)

---

## Cross-Cutting Notes

### Feature Parity — Web + Android
The Android app is a Capacitor 8 wrapper around the same React SPA. Every feature specced here automatically ships to Android without extra effort. Do **not** build native-only features unless they deliberately use a Capacitor plugin (e.g., haptics, native share sheet). All new pages and components render in both environments from day one.

### Interactive Diagrams
`OrbitDiagram` and `TonnetzViz` on the Classifier page are already interactive (clickable nodes and chords). `TonnetzViz` interaction is gated to Pro tier via `user.tier === 'pro' || user.tier === 'research'`. New interactive diagrams should follow the same gate pattern.

### Creator Access
`tenerjenkins@gmail.com` is permanently on the Research tier. This is enforced in `packages/analyzer/src/auth/db.ts` at login time via an email check that hard-sets `tier = 'research'`. No UI override is needed — the auto-upgrade happens server-side on every login.

### Tier Reference
| Tier | Monthly Price | Key limits |
|---|---|---|
| anonymous | free | 50 classifies/day, 3 analyzes/day |
| free | free | 100 classifies/day, 10 analyzes/day |
| pro | $5/mo | 1 000 classifies/day, unlimited OG cards |
| research | $15/mo | 10 000 classifies/day, all endpoints |

Auth gate pattern (frontend): `const { user } = useUser(); if (user.tier === 'free') { ... }`
Auth gate pattern (backend): `requireTier('pro', 'research')` or `rateLimit('endpoint-key')` from `packages/analyzer/src/auth/middleware.ts`.

---

## Batch 1 — Quick Wins (S effort each)

---

### Feature 3 — Personal Analysis History + Bookmarks

**Goal**
Persist every classification and file analysis a logged-in user performs so they can revisit, search, and tag past work. Replaces the ephemeral in-memory `ChordHistory` component for authenticated users.

**User Story**
As a logged-in user, I want to see every set I have ever classified, be able to search by Forte number or date, and bookmark favourites so I can build a personal reference library across sessions.

**Acceptance Criteria**
1. Every successful `/api/classify` call made by a logged-in user is written to `analysis_history` (pitch classes, Forte number, prime form, interval vector, timestamp).
2. Every successful `/api/analyze` (file analysis) stores a summary row linking to the full result JSON in `analysis_history`.
3. Free tier: history is queryable for the past 7 days. Rows older than 7 days are hidden (not deleted) for free users.
4. Pro/Research tier: unlimited history, no date filter applied.
5. Any row can be bookmarked (star toggle). Bookmarked rows are never hidden by the 7-day filter.
6. History page supports text search across Forte number, prime form, and user-supplied tags.
7. Tags are comma-separated strings stored per row. Up to 20 tags per entry.
8. Export to CSV is available on the history page (Research tier only, reusing `rateLimit` pattern).
9. Deleting a row removes it permanently (no soft-delete).
10. The existing `ChordHistory` component in the Classifier sidebar is replaced by a "Recent" panel that fetches the last 10 rows from the new API endpoint for authenticated users, falling back to in-memory state for anonymous users.

**Implementation Plan**

Files to **create**:
- `packages/analyzer/src/history/db.ts` — SQLite helpers: `insertHistory`, `queryHistory`, `toggleBookmark`, `deleteHistory`, `tagHistory`
- `packages/analyzer/src/history/routes.ts` — Express router mounted at `/api/history`; endpoints: `GET /`, `GET /:id`, `POST /:id/bookmark`, `POST /:id/tags`, `DELETE /:id`, `GET /export.csv`
- `packages/ui/src/pages/HistoryPage.tsx` — Full-page history browser with search bar, tag filter chips, bookmark filter toggle, date range picker, and CSV export button
- `packages/ui/src/hooks/useHistory.ts` — SWR-style hook wrapping `/api/history` with optimistic bookmark toggles

Files to **modify**:
- `packages/analyzer/src/auth/db.ts` — add `runHistoryMigration()` creating the `analysis_history` table (called at server start alongside other migrations)
- `packages/analyzer/src/routes.ts` — after every successful `/classify` response, call `insertHistory(userId, ...)` (non-blocking, fire-and-forget)
- `packages/analyzer/src/index.ts` (server entry) — mount `/api/history` router; call `runHistoryMigration()`
- `packages/ui/src/components/ChordHistory.tsx` — replace in-memory list with `useHistory()` for authenticated users; keep existing in-memory fallback for anonymous
- `packages/ui/src/App.tsx` (or router file) — add `/history` route pointing to `HistoryPage`

**DB Schema**
```sql
CREATE TABLE IF NOT EXISTS analysis_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK(type IN ('classify','analyze')),
  pitch_classes TEXT NOT NULL,   -- JSON array e.g. "[0,4,7]"
  forte      TEXT,
  prime_form TEXT,
  interval_vector TEXT,
  tags       TEXT DEFAULT '',
  bookmarked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_user ON analysis_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_bookmarked ON analysis_history(user_id, bookmarked);
```

**Tier Gating**
- Free: history scoped to last 7 days on `GET /api/history` (server applies `WHERE created_at >= date('now','-7 days') OR bookmarked = 1`)
- Pro/Research: no date filter
- CSV export: Research only (`requireTier('research')`)

**Effort Estimate:** S (small) — ~1–2 days

**Dependencies:** Existing `auth/db.ts` migration pattern; existing `useUser()` hook; no new npm packages required

---

### Feature 4 — MIDI Keyboard Live Mode

**Goal**
As the user holds keys on a connected MIDI keyboard, the Classifier updates in real time (< 100 ms latency) showing the current pitch-class set, its symmetry analysis, and the Tonnetz/Orbit diagrams animating live.

**User Story**
As a pianist or keyboard player, I want to plug in my MIDI controller, press notes, and see the set theory analysis update instantly while I play — so I can explore harmonic relationships without typing pitch classes manually.

**Acceptance Criteria**
1. A "MIDI Live" toggle button appears in the ClassifierPage toolbar when `navigator.requestMIDIAccess` is available.
2. Enabling MIDI Live mode calls `useMidiInput().connect()` (already implemented in `packages/ui/src/hooks/useMidiInput.ts`).
3. The `pitchClasses` from `useMidiInput` are fed directly into the Classifier analysis pipeline with debounce ≤ 100 ms.
4. The OrbitDiagram and TonnetzViz diagrams update live as notes are held or released.
5. A "sustain" toggle keeps the current set frozen for inspection after releasing keys.
6. Free tier: live sessions auto-stop after 5 minutes (timer displayed in the UI); a prompt to upgrade is shown when the timer expires.
7. Pro/Research tier: unlimited session duration.
8. The device name (e.g., "Arturia KeyLab") is displayed in the toolbar while connected.
9. On MIDI device disconnect, the mode degrades gracefully (banner shown, analysis frozen at last known state).
10. No new page is required — this is an enhancement to `ClassifierPage.tsx`.

**Implementation Plan**

Files to **create**:
- `packages/ui/src/hooks/useLiveMidi.ts` — wraps `useMidiInput`, adds debounce, sustain toggle, and free-tier session timer; returns `{ pitchClasses, isLive, sustained, sessionElapsed, sessionLimitReached, ... }`

Files to **modify**:
- `packages/ui/src/pages/ClassifierPage.tsx` — import `useLiveMidi`; add "MIDI Live" button to toolbar; when `isLive` is true, override the manual pitch-class input state with `pitchClasses` from the hook; show device name badge and session timer for free tier
- `packages/ui/src/components/MidiInput.tsx` — expose a compact "MIDI connected" status badge reusable by ClassifierPage toolbar

**Tier Gating**
- Free: 5-minute session cap enforced client-side in `useLiveMidi` (server does not need to know — MIDI is purely client-side Web MIDI API)
- Pro/Research: unlimited

**Effort Estimate:** S (small) — ~1 day (most infrastructure already exists in `useMidiInput.ts`)

**Dependencies:** `packages/ui/src/hooks/useMidiInput.ts` (already implemented); `packages/ui/src/pages/ClassifierPage.tsx`

---

### Feature 7 — Citation Generator

**Goal**
For any analysis result, generate a properly formatted academic citation in APA, Chicago, MLA, or BibTeX format so researchers can cite Chrometria in papers.

**User Story**
As a music theory researcher, I want to click "Cite" on any analysis result and get a ready-to-copy citation in my preferred academic style, including the Forte number, pitch classes, and the date I performed the analysis.

**Acceptance Criteria**
1. A "Cite" button appears in the `ClassificationPanel` component for Research-tier users.
2. Clicking it opens a modal with a style selector (APA / Chicago / MLA / BibTeX).
3. Each format is generated client-side from the current analysis state — no network round-trip.
4. Generated citations include: Forte number, prime form, symmetry group, classification date (today), and a canonical URL of the form `https://symmetry.tendrid.us/#classifier?pcs=...`.
5. A one-click "Copy to clipboard" button is present in the modal.
6. BibTeX format outputs a valid `@misc` entry with a `howpublished` URL field.
7. Non-Research users see the "Cite" button grayed out with a tooltip: "Citation export requires Research tier."

**Implementation Plan**

Files to **create**:
- `packages/ui/src/utils/citations.ts` — pure functions: `formatAPA(analysis, date, url)`, `formatChicago(...)`, `formatMLA(...)`, `formatBibTeX(...)`; exports a `generateCitation(style, analysis, date, url)` dispatcher

Files to **modify**:
- `packages/ui/src/components/ClassificationPanel.tsx` — add "Cite" button; import `generateCitation`; render citation modal (can be an inline `<dialog>` or a small inline state panel — no new component file needed unless it grows beyond ~60 lines)

**Tier Gating**
- Research only; button is rendered but disabled with tooltip for free/pro

**Effort Estimate:** S (small) — ~4 hours

**Dependencies:** `ClassificationPanel.tsx`; `useUser()` hook

---

### Feature 9 — LaTeX Theorem Environment Export

**Goal**
Export a classifier result as a valid LaTeX `theorem` or `proposition` block with proper math notation, ready to paste into a paper.

**User Story**
As a music theory researcher writing a paper in LaTeX, I want a single click to copy a typeset theorem block for any set-class result, so I do not have to manually convert Forte notation to $T_n$/$I_n$ LaTeX math.

**Acceptance Criteria**
1. A "LaTeX" option appears in the existing `ExportMenu` component for Research-tier users.
2. The generated block is a valid LaTeX `theorem` environment (requires `\usepackage{amsthm}`).
3. Output includes: prime form as a set literal, Forte number, symmetry group in standard notation ($\mathbb{Z}_{12}$, $D_n$, etc.), interval vector as a 6-tuple, and stabilizer order.
4. $T_n$ and $I_n$ operators are rendered correctly (`T_n`, `I_n`, `T_nI_n`).
5. The output is copyable via a single "Copy LaTeX" button in the export dropdown.
6. Non-Research users see the menu item grayed out.

**Implementation Plan**

Files to **create**:
- `packages/ui/src/utils/export-academic.ts` — `generateLaTeX(analysis: SymmetryAnalysis): string`; maps `abstractGroup` strings from core to their LaTeX equivalents; builds the full theorem block

Files to **modify**:
- `packages/ui/src/components/ExportMenu.tsx` — add "LaTeX Theorem" menu item; import `generateLaTeX`; on click, write to clipboard and show a "Copied!" toast

**Tier Gating**
- Research only

**Effort Estimate:** S (small) — ~4 hours

**Dependencies:** `ExportMenu.tsx`; `SymmetryAnalysis` type from `packages/core/src/types.ts`

---

### Feature 12 — Achievement System

**Goal**
Reward user engagement with badges awarded for reaching meaningful milestones (e.g., "First Classification", "100 Analyses", "Explored All Cardinalities"). Badges are visible on the Dashboard and in a dedicated Achievement panel.

**User Story**
As a user, I want to see progress badges on my dashboard that celebrate milestones in my exploration of music theory, giving me a sense of progression and motivating continued use.

**Acceptance Criteria**
1. Achievements are defined in a static registry (no DB for definitions — code-only).
2. When a user action triggers an achievement for the first time, it is written to the `achievements` table and a toast notification fires in the UI.
3. The Dashboard page shows an "Achievements" section with earned badges (icon + name) and a count of locked badges.
4. A full achievement list modal shows all badges, earned/locked status, and descriptions.
5. Initial badge set (minimum 12):
   - First Step: first classification
   - Triad Hunter: classify 10 triads
   - Symmetry Nerd: classify one set from each cardinality 2–8
   - Centurion: 100 total classifications
   - File Analyst: first file analysis
   - Chord Whisperer: identify 5 named chords
   - Z-Twin Finder: classify both sets in a Z-related pair
   - Week Streak: use the app 7 days in a row (tracked via login dates)
   - Atlas Explorer: visit 20 distinct Atlas entries
   - Quiz Ace: score 100% on a quiz round
   - Flashcard Builder: create first flashcard deck (Feature 1, can be added later)
   - Research Mode: first LaTeX export (Feature 9)
6. Achievement checks are lightweight (SQL COUNT queries) and run asynchronously — they must not delay the primary API response.
7. Available on all tiers (including free and anonymous — anonymous achievements are not persisted).

**Implementation Plan**

Files to **create**:
- `packages/analyzer/src/achievements/registry.ts` — static `ACHIEVEMENTS` array; each entry: `{ id, name, description, icon, check: (userId, db) => boolean }`
- `packages/analyzer/src/achievements/db.ts` — `runAchievementMigration()`, `checkAndGrantAchievements(userId)`, `getUserAchievements(userId)`
- `packages/analyzer/src/achievements/routes.ts` — `GET /api/achievements` (returns earned + locked list for current user)
- `packages/ui/src/components/AchievementBadge.tsx` — single badge display component (icon, name, locked/unlocked state, tooltip with description)
- `packages/ui/src/hooks/useAchievements.ts` — fetches `/api/achievements`; exposes `{ earned, locked, total }`

Files to **modify**:
- `packages/analyzer/src/auth/db.ts` — call `runAchievementMigration()` at server start
- `packages/analyzer/src/index.ts` — mount `/api/achievements` router
- `packages/analyzer/src/routes.ts` — after `/classify` and `/analyze` success, call `checkAndGrantAchievements(userId)` (fire-and-forget, no `await`)
- `packages/ui/src/pages/DashboardPage.tsx` — add achievements section using `AchievementBadge` and `useAchievements`

**DB Schema**
```sql
CREATE TABLE IF NOT EXISTS achievements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  granted_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, achievement_id)
);
```

**Tier Gating**
- Free — available to all authenticated users

**Effort Estimate:** S (small) — ~1–2 days

**Dependencies:** `auth/db.ts` migration pattern; `DashboardPage.tsx`; `useUser()` hook

---

### Feature 13 — Notification Digest Enhancement

**Goal**
Extend the existing weekly digest email to include: current activity streak, any new challenges available, and a "Z-related sets in your history" section personalised from the user's `analysis_history` (Feature 3).

**User Story**
As a Pro or Research user, I want my weekly digest to feel personal — showing my streak, pointing me to new challenges, and surfacing Z-related pairs hiding in my own history — rather than just generic usage stats.

**Acceptance Criteria**
1. The digest includes a "Current Streak" metric (consecutive days with at least one classification).
2. If a new Daily Challenge (Feature 10) has been issued since the last digest, a section previewing it is included.
3. If the user has at least two Z-related sets in their history, one pair is highlighted in a "Did you know?" section with a link to compare them in the app.
4. The streak calculation falls back gracefully to zero if `analysis_history` does not exist yet (i.e., Feature 3 not yet deployed).
5. The Daily Challenge section is omitted if Feature 10 is not deployed yet.
6. All new content is opt-out-able alongside the existing `digest_optout` flag (no new opt-out knob needed).
7. The email subject line changes from the static string to a personalised one, e.g. "Your 7-day streak — keep it going 🎵" when streak ≥ 7.

**Implementation Plan**

Files to **modify**:
- `packages/analyzer/src/digest/weekly-digest.ts` — add `getUserStreak(userId): number` helper (queries `analysis_history`); add `getZPairsInHistory(userId): ZPair[]` helper; update `buildDigestHtml` and `buildDigestText` to accept and render the new sections; update `sendWeeklyDigests` to gather and pass the new data; add dynamic subject line logic

**Tier Gating**
- All tiers that already receive digests (free, pro, research)

**Effort Estimate:** S (small) — ~4–6 hours

**Dependencies:** Feature 3 (`analysis_history` table) for streak and Z-pair sections; existing `weekly-digest.ts`; existing Resend integration

---

## Batch 2 — Medium Effort

---

### Feature 1 — Set Class Flashcard Deck Builder

**Goal**
Allow users to build custom study decks from the 224 set classes, assigning front/back content (Forte number → prime form, interval vector, symmetry group, etc.) for spaced-repetition study.

**User Story**
As a student preparing for a music theory exam, I want to create a flashcard deck from a subset of set classes (e.g., all trichords), configure what information appears on the front and back, and drill through them using a spaced-repetition algorithm.

**Acceptance Criteria**
1. A "Flashcards" page lists the user's decks with card counts and last-studied date.
2. Deck creation: user picks a name, optional description, and adds cards from a searchable set-class picker (all 224 set classes).
3. Each card has a configurable front and back drawn from: Forte number, prime form, interval vector, symmetry group, Mulliken label, cardinality.
4. Study mode cycles through due cards using the existing SM-2 algorithm in `packages/ui/src/utils/sm2.ts`.
5. Free tier: 1 deck, max 10 cards per deck.
6. Pro/Research: unlimited decks and cards.
7. Progress (SM-2 `easeFactor`, `interval`, `nextDue`) is persisted per card per user in the DB.
8. A "Quick Add from Atlas" button on Atlas entry pages adds that set class to a chosen deck in one click.

**Implementation Plan**

Files to **create**:
- `packages/analyzer/src/flashcards/db.ts` — `runFlashcardMigration()`, `createDeck`, `addCard`, `getDecks`, `getCards`, `updateCardProgress`, `deleteDeck`, `deleteCard`
- `packages/analyzer/src/flashcards/routes.ts` — CRUD router mounted at `/api/flashcards`; enforce free-tier card/deck limits server-side
- `packages/ui/src/pages/FlashcardPage.tsx` — deck list view + deck editor + study mode; study mode reuses `sm2` from utils
- `packages/ui/src/hooks/useFlashcards.ts` — wraps `/api/flashcards` endpoints

Files to **modify**:
- `packages/analyzer/src/auth/db.ts` — call `runFlashcardMigration()`
- `packages/analyzer/src/index.ts` — mount `/api/flashcards` router
- `packages/ui/src/App.tsx` — add `/flashcards` route
- `packages/ui/src/pages/AtlasEntryPage.tsx` — add "Quick Add to Flashcard Deck" button

**DB Schema**
```sql
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS flashcard_cards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id     INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  forte       TEXT NOT NULL,
  front_field TEXT NOT NULL DEFAULT 'forte',
  back_fields TEXT NOT NULL DEFAULT '["prime_form","interval_vector"]',
  ease_factor REAL DEFAULT 2.5,
  interval    INTEGER DEFAULT 0,
  next_due    TEXT DEFAULT (datetime('now')),
  repetitions INTEGER DEFAULT 0
);
```

**Tier Gating**
- Free: 1 deck, 10 cards (enforced server-side with HTTP 403 + upgrade prompt)
- Pro/Research: unlimited

**Effort Estimate:** M (medium) — ~2–3 days

**Dependencies:** `sm2.ts` (already exists); Atlas data in `packages/analyzer/src/atlas/data.ts`; `AtlasEntryPage.tsx`

---

### Feature 6 — Bulk Set Class Export API

**Goal**
Provide a programmatic REST API with API key authentication allowing researchers to retrieve computed properties for any or all 224 set classes in bulk JSON, suitable for use in scripts and data pipelines.

**User Story**
As a music theory researcher, I want an API key I can use in Python or R scripts to pull the full 224-set-class dataset with symmetry groups, interval vectors, and Forte numbers in one request, without scraping the UI.

**Acceptance Criteria**
1. A Research user can generate an API key from their account settings page.
2. `GET /api/bulk/set-classes` returns all 224 set classes with: Forte number, prime form, interval vector, cardinality, symmetry group, Mulliken label, Z-relation partner (if any), is_complement_related flag.
3. `GET /api/bulk/set-classes/:forte` returns the same fields for a single set class.
4. `POST /api/bulk/classify` accepts a JSON array of up to 5 000 pitch-class sets and returns batch classification results (extends existing `/api/classify/batch` which caps at 1 000).
5. All endpoints require a valid API key in the `X-API-Key` header.
6. Rate limits: 100 bulk requests per hour for Research tier (enforced via the existing `rateLimit` middleware pattern with a new `bulk` endpoint key).
7. Responses include standard rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`).
8. An OpenAPI spec entry is added for each new endpoint.

**Implementation Plan**

Files to **create**:
- `packages/analyzer/src/bulk/routes.ts` — Express router mounted at `/api/bulk`; implements the three endpoints above; calls `classify()` from core for the batch endpoint

Files to **modify**:
- `packages/analyzer/src/auth/middleware.ts` — add `'bulk': { research: 100 }` entry to `TIER_LIMITS`
- `packages/analyzer/src/index.ts` — mount `/api/bulk` router
- `packages/analyzer/src/api-docs/openapi.ts` — add bulk endpoint schemas
- `packages/ui/src/pages/ApiDocsPage.tsx` — add bulk endpoints to the documentation UI
- (Optional) account settings page — "Generate API Key" button for Research users; can reuse existing API key column in `users` table if already present

**Tier Gating**
- Research only (`requireTier('research')` on all `/api/bulk` routes)

**Effort Estimate:** M (medium) — ~1.5 days

**Dependencies:** Existing `rateLimit` middleware; `classify()` from `packages/core/src`; `openapi.ts`

---

### Feature 10 — Daily Set Challenge

**Goal**
Every day a new set-class challenge is generated and published. Users submit answers, earn streak points, and compete on a leaderboard. This creates a daily re-engagement loop.

**User Story**
As a regular user, I want a fresh music theory challenge every day — "What symmetry group does this set belong to?" — so I have a reason to return to the app daily and can see how I rank against others.

**Acceptance Criteria**
1. A "Daily Challenge" page shows today's featured set and a multiple-choice or free-input question.
2. Question types (rotated): identify symmetry group, identify cardinality, identify Forte number, identify Z-relation partner.
3. Submission records: user ID, date, answer, correctness, time-to-answer (seconds).
4. Each user can submit once per day per challenge.
5. After submission, the correct answer and a brief explanation are shown.
6. A streak counter (consecutive correct days) is displayed on the page and the Dashboard.
7. A top-10 leaderboard shows streak counts (usernames anonymised to first name + last initial).
8. The daily challenge is generated at server start if none exists for today (deterministic seed from the date → picks from the 224 set classes in round-robin order, consistent across restarts).
9. Available to all tiers (free, pro, research).
10. Streak data feeds Feature 13 (digest enhancement).

**Implementation Plan**

Files to **create**:
- `packages/analyzer/src/challenges/db.ts` — `runChallengeMigration()`, `getTodayChallenge()`, `generateTodayChallenge()` (deterministic by date), `submitChallenge(userId, answer)`, `getUserStreak(userId)`, `getLeaderboard()`
- `packages/analyzer/src/challenges/routes.ts` — `GET /api/challenges/today`, `POST /api/challenges/today/submit`, `GET /api/challenges/leaderboard`, `GET /api/challenges/streak`
- `packages/ui/src/pages/DailyChallengePage.tsx` — challenge display, answer form, streak counter, leaderboard table

Files to **modify**:
- `packages/analyzer/src/auth/db.ts` — call `runChallengeMigration()`
- `packages/analyzer/src/index.ts` — mount `/api/challenges` router; call `generateTodayChallenge()` at startup
- `packages/ui/src/App.tsx` — add `/challenge` route
- `packages/ui/src/pages/DashboardPage.tsx` — add "Today's Challenge" teaser card with streak count

**DB Schema**
```sql
CREATE TABLE IF NOT EXISTS daily_challenges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL UNIQUE,   -- ISO date 'YYYY-MM-DD'
  forte       TEXT NOT NULL,
  pitch_classes TEXT NOT NULL,
  question_type TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  distractors TEXT NOT NULL           -- JSON array of wrong answers
);
CREATE TABLE IF NOT EXISTS daily_submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES daily_challenges(id),
  answer      TEXT NOT NULL,
  correct     INTEGER NOT NULL,
  elapsed_sec INTEGER,
  submitted_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, challenge_id)
);
```

**Tier Gating**
- Free — available to all authenticated tiers

**Effort Estimate:** M (medium) — ~2 days

**Dependencies:** Feature 13 (digest) reads streak from this feature's DB; 224 set-class data from `packages/analyzer/src/atlas/data.ts`

---

### Feature 14 — Embeddable Widget v2

**Goal**
Provide an enhanced interactive Classifier embed that course instructors can drop into any webpage via a single `<iframe>` tag. The embed shows Chrometria branding and a call-to-action linking back to the full app.

**User Story**
As a music theory professor, I want to embed an interactive set-class classifier directly in my course website so students can explore pitch-class sets without leaving the page. The embed should require no sign-up and show the tool's branding.

**Acceptance Criteria**
1. Navigating to `/embed` renders a compact Classifier (pitch-class input, classification output, OrbitDiagram) styled for iframe embedding (no nav bar, no sidebar, dark or light theme via `?theme=dark|light`).
2. OrbitDiagram is interactive in the embed (click to highlight nodes).
3. A "Powered by Musical Symmetry" footer badge links to `https://symmetry.tendrid.us` with `target="_blank"`.
4. Embed accepts optional URL params: `?pcs=0,4,7` (initial set), `?theme=dark|light`, `?size=compact|full`.
5. The embed works without authentication — uses the anonymous rate limit bucket.
6. An "Open in Musical Symmetry" button deep-links to the Classifier page with the current pcs pre-loaded.
7. Documentation for embedding (an HTML snippet) is added to the API docs page.
8. Available free to embed (anyone can iframe it — no API key required for the iframe route).

**Implementation Plan**

Files to **modify**:
- `packages/ui/src/components/EmbedWidget.tsx` — refactor to accept `theme`, `size`, and initial `pcs` props; add "Powered by" footer; add "Open in app" button; ensure OrbitDiagram interaction is enabled
- `packages/ui/vite.config.ts` — verify the `/embed` route is handled by the SPA router (already likely configured)
- `packages/ui/src/App.tsx` — ensure `/embed` route renders `EmbedWidget` in a wrapper that suppresses nav/sidebar

Files to **create** (if embed needs its own entry point separate from the SPA):
- `packages/ui/src/pages/EmbedPage.tsx` — thin wrapper reading URL params and rendering `EmbedWidget`

Files to **modify**:
- `packages/ui/src/pages/ApiDocsPage.tsx` — add embed snippet documentation section

**Tier Gating**
- Free — available to everyone (no auth required for the embed route)

**Effort Estimate:** M (medium) — ~1.5 days

**Dependencies:** `EmbedWidget.tsx` (already exists); `OrbitDiagram.tsx`; `ApiDocsPage.tsx`

---

### Feature 15 — Social Cards (Shareable OG Image)

**Goal**
After any analysis, generate a shareable social media card (OG image) and provide a one-click share flow for Twitter/X, Mastodon, and copy-link — so users can share interesting set-class finds with their networks.

**User Story**
As a user who discovers an interesting symmetry, I want to click "Share" and get a pre-composed tweet (or copy a link) with a beautiful card image previewing the set's properties, so I can share music theory discoveries easily.

**Acceptance Criteria**
1. A "Share" button on `ClassificationPanel` opens a share panel (existing `SharePanel.tsx` component).
2. The share panel shows a preview of the generated OG image (fetched from existing `/api/og/:style` endpoint).
3. A style picker lets the user choose from the 20 existing card styles (orbit, tonnetz, spectrum, etc.).
4. "Share to Twitter/X" opens `https://twitter.com/intent/tweet` with pre-populated text and the share URL.
5. "Copy Link" copies the `/share/:style?pcs=...` URL to clipboard.
6. The share URL uses the existing `/api/share/:style` server-side endpoint which already handles OG meta tags and crawler redirect.
7. Available to all tiers (including anonymous — uses existing anonymous `/api/og` rate limit).
8. On Capacitor (Android), tapping "Share" calls the native Capacitor Share plugin (`@capacitor/share`) passing the URL and title — providing native share sheet on Android.

**Implementation Plan**

Files to **modify**:
- `packages/ui/src/components/SharePanel.tsx` — add card style picker (grid of 20 style thumbnails or dropdown); add OG image preview `<img>` fetched from `/api/og/{style}?pcs=...`; add Twitter share button; ensure "Copy Link" uses `/api/share/{style}` URL; add Capacitor Share path (detect `Capacitor.isNativePlatform()`, call `Share.share()`)

No new files required — all server-side infrastructure (OG image generation, `/api/share/:style`) already exists in `packages/analyzer/src/routes.ts`.

**Tier Gating**
- Free — available to all users

**Effort Estimate:** M (medium) — ~1 day (server side already done; mostly UI wiring)

**Dependencies:** Existing `/api/og/:style` and `/api/share/:style` endpoints; `SharePanel.tsx`; `ClassificationPanel.tsx`; optional `@capacitor/share` for Android

---

### Feature 16 — Public Atlas Profiles

**Goal**
Pro and Research users can publish curated collections as public profile pages. Anyone (including unauthenticated visitors) can view these pages, driving organic discovery and SEO.

**User Story**
As a Pro user, I want to publish a curated collection of set classes — for example, "Coltrane Changes in Set Theory" — as a public page I can link to from my teaching materials, so others can explore my analysis without needing an account.

**Acceptance Criteria**
1. A "Publish" toggle on any owned collection promotes it to a public profile page at `/u/:username/:slug`.
2. The public profile page shows: user display name, collection name, description, and a grid of set-class cards (each linking to the Atlas entry).
3. Unauthenticated visitors can view public profiles — no login required.
4. Pro/Research: can publish collections (max 10 public collections for Pro, unlimited for Research).
5. Free: can view public profiles but cannot publish.
6. Each public profile page has proper OG meta tags (title, description, OG image using a card from the collection).
7. A user's public profile index page at `/u/:username` lists all their published collections.
8. Published collections can be unpublished (reverting to private) at any time.
9. The URL slug is auto-generated from the collection name (slugified) and must be unique per user.

**Implementation Plan**

Files to **create**:
- `packages/analyzer/src/public-profiles/routes.ts` — `GET /api/public/:username` (list public collections), `GET /api/public/:username/:slug` (single collection content), `POST /api/collections/:id/publish`, `DELETE /api/collections/:id/publish`
- `packages/ui/src/pages/PublicProfilePage.tsx` — public collection viewer (no auth required; reads from `/api/public/:username/:slug`)
- `packages/ui/src/pages/PublicProfileIndexPage.tsx` — lists all published collections for a username (`/u/:username`)

Files to **modify**:
- `packages/analyzer/src/collections/db.ts` — add `published` (0/1) and `slug` columns; add `getPublicCollection(username, slug)`, `listPublicCollections(username)`, `publishCollection(id, slug)`, `unpublishCollection(id)` helpers
- `packages/analyzer/src/index.ts` — mount `/api/public` router; serve public profile pages with OG meta tags via server-side HTML injection or redirect
- `packages/ui/src/App.tsx` — add `/u/:username` and `/u/:username/:slug` routes
- `packages/ui/src/hooks/useCollections.ts` — add `publishCollection()` and `unpublishCollection()` actions

**DB Schema (migration to existing collections table)**
```sql
ALTER TABLE collections ADD COLUMN published INTEGER DEFAULT 0;
ALTER TABLE collections ADD COLUMN slug TEXT;
ALTER TABLE collections ADD COLUMN published_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_public ON collections(user_id, slug) WHERE published = 1;
```

**Tier Gating**
- Publishing: Pro (max 10) and Research (unlimited)
- Viewing: all tiers including anonymous

**Effort Estimate:** M (medium) — ~2 days

**Dependencies:** Existing `collections/db.ts` and `collections/routes.ts`; `useCollections.ts`; Atlas set-class data for card rendering

---

## Batch 3 — Large Effort

---

### Feature 2 — Collaborative Analysis Rooms

**Goal**
Multiple users share a live Classifier session via WebSocket — seeing each other's pitch-class input, analysis results, and diagram state in real time. Designed for classroom use and remote collaboration.

**User Story**
As a music theory instructor, I want to create a room, share a URL with my students, and have everyone see the same Classifier state live as I manipulate it — with students able to submit their own sets for group discussion.

**Acceptance Criteria**
1. A "New Room" button on ClassifierPage creates a room and generates a shareable URL (`/room/:roomId`).
2. Joining via the URL shows the room in view-only mode for Free users.
3. Pro/Research users in a room can submit pitch-class sets that become visible to all participants.
4. The host (room creator) can see all submitted sets and "pin" one to the shared view.
5. Up to 20 participants per room (limit enforced server-side).
6. Room state (current pcs, pinned analysis) is broadcast to all connected clients via WebSocket.
7. Pro/Research: voice-over capability uses the browser's built-in Web Audio API for a "listening indicator" only (no actual audio relay — this is a visual cue that the host is speaking, implemented via microphone volume detection).
8. Rooms expire after 4 hours of inactivity (last message timestamp).
9. Room history is not persisted after expiry.
10. A participant list panel shows connected users (display name or "Guest #N" for anonymous).
11. Works on Capacitor (Android) via the same WebSocket connection — no native plugin needed.

**Implementation Plan**

Files to **create**:
- `packages/analyzer/src/rooms/ws.ts` — WebSocket server logic; room lifecycle (create, join, leave, broadcast, expiry); room state management in memory (Map); message types: `join`, `leave`, `set-pcs`, `pin`, `participant-list`
- `packages/analyzer/src/rooms/routes.ts` — `POST /api/rooms` (create room, returns `{ roomId }`), `GET /api/rooms/:roomId` (room metadata)
- `packages/ui/src/pages/RoomPage.tsx` — room view with embedded Classifier, participant list, submission panel; reads room state from WebSocket via `useWebSocket`
- `packages/ui/src/hooks/useRoom.ts` — wraps `useWebSocket`; provides `{ participants, pinnedPcs, myPcs, submitPcs, isHost }`

Files to **modify**:
- `packages/analyzer/src/index.ts` — instantiate WebSocket server (`ws` npm package) on the same HTTP server; attach rooms WebSocket handler
- `packages/analyzer/src/classroom/ws.ts` — review for reusable patterns (rooms WS is distinct from classroom WS but can share connection management helpers)
- `packages/ui/src/App.tsx` — add `/room/:roomId` route
- `packages/ui/src/pages/ClassifierPage.tsx` — add "New Room" button; link to room creation flow

**Tier Gating**
- Free: join and view only (cannot submit pcs to shared view)
- Pro/Research: full participation (submit, pin), voice indicator

**Effort Estimate:** L (large) — ~5–7 days

**Dependencies:** `ws` npm package (check if already in `packages/analyzer/package.json`); `useWebSocket.ts` (already exists); `classroom/ws.ts` for reference patterns; existing session/auth middleware for WebSocket handshake

---

### Feature 5 — Spotify / YouTube Link Analyzer

**Goal**
A user pastes a Spotify track URL or YouTube video URL; the server fetches audio server-side, runs the existing Analyzer pipeline, and returns a full timeline analysis — no file upload required.

**User Story**
As a user curious about the harmonic structure of a specific song, I want to paste its Spotify or YouTube link and get the same symmetry timeline analysis I'd get from uploading a MIDI file, without any manual steps.

**Acceptance Criteria**
1. A new "Link" input tab on the Analyzer page accepts Spotify track URLs and YouTube video URLs.
2. On submission, the server fetches the audio using `yt-dlp` (already available in the server environment or installed as a runtime dependency).
3. Audio is extracted to a temporary WAV/MP3 file on disk (cleaned up after analysis, max 10 minutes of audio).
4. The WAV is passed through the existing `parseWav` parser and `analyzeTimeline` pipeline.
5. Results are returned in the same timeline format as `/api/analyze`.
6. Free: 1 link analysis per day.
7. Pro: 10 link analyses per day.
8. Research: unlimited.
9. Spotify URLs require Spotify's audio preview (30-second clips via `yt-dlp` or the public preview URL) — full-track analysis is limited to YouTube.
10. Progress feedback is streamed to the client (SSE or polling) since audio download + analysis can take 10–30 seconds.
11. Server enforces a 10-minute audio cap — longer content is truncated before analysis.

**Implementation Plan**

Files to **create**:
- `packages/analyzer/src/link-analyzer/fetcher.ts` — `fetchAudioFromUrl(url): Promise<Buffer>` using `yt-dlp` child process; handles Spotify (preview) and YouTube URLs; enforces 10-minute cap; cleans up temp files
- `packages/analyzer/src/link-analyzer/routes.ts` — `POST /api/link-analyze` with SSE progress stream; calls `fetchAudioFromUrl`, then existing `parseWav` + `analyzeTimeline`; enforces per-user rate limits via new `link-analyze` endpoint key

Files to **modify**:
- `packages/analyzer/src/auth/middleware.ts` — add `'link-analyze': { free: 1, pro: 10, research: -1 }` to `TIER_LIMITS`
- `packages/analyzer/src/index.ts` — mount `/api/link-analyze` router
- `packages/ui/src/pages/AnalyzerPage.tsx` — add "Link" tab with URL input form; connect to SSE stream for progress; display results using existing `TimelineChart` and `SliceDetail` components

**Tier Gating**
- Free: 1/day
- Pro: 10/day
- Research: unlimited

**Effort Estimate:** L (large) — ~4–6 days

**Dependencies:** `yt-dlp` on server (must be installed in Docker image / environment); existing `parsers/wav.ts`; existing `analyzeTimeline`; `AnalyzerPage.tsx` with its file-upload UI as a pattern

---

### Feature 8 — Comparative Corpus Analysis

**Goal**
Research users upload a folder of MIDI and/or MusicXML files and receive aggregate statistics across the entire corpus: most common set classes, symmetry group distribution, Z-relation density, average interval vector, and comparative charts.

**User Story**
As a musicologist, I want to upload 50 Mozart piano sonata MIDI files and get a statistical breakdown of which set classes appear most often, what symmetry groups dominate, and how the distribution compares to a Schoenberg corpus I uploaded previously — so I can support or refute theoretical claims about style.

**Acceptance Criteria**
1. A "Corpus" page (Research tier only) allows batch upload of up to 100 files (MIDI, MusicXML, WAV) in a single operation.
2. The server processes files sequentially (not in parallel) to avoid memory spikes; progress is streamed via SSE.
3. Aggregate statistics returned:
   - Top 20 set classes by frequency (with Forte numbers)
   - Symmetry group distribution (pie/bar chart)
   - Cardinality distribution
   - Z-relation density (% of slices that are Z-related to another slice in the corpus)
   - Average interval vector across the corpus
   - Per-file summary table
4. Results can be exported as JSON or CSV.
5. Corpora are saved under a user-named label and can be retrieved and compared later (stored in the `corpora` table).
6. Side-by-side comparison of two saved corpora shows difference charts.
7. Research tier only — Free and Pro users see a locked page with feature description.

**Implementation Plan**

Files to **create**:
- `packages/analyzer/src/corpus/stats.ts` — `computeCorpusStats(timelines: Timeline[]): CorpusStats`; pure function operating on arrays of existing `analyzeTimeline` outputs
- `packages/analyzer/src/corpus/db.ts` — `runCorpusMigration()`, `saveCorpus(userId, name, stats)`, `listCorpora(userId)`, `getCorpus(id)`, `deleteCorpus(id)`
- `packages/analyzer/src/corpus/routes.ts` — `POST /api/corpus/analyze` (SSE multipart upload + analysis), `GET /api/corpus`, `GET /api/corpus/:id`, `DELETE /api/corpus/:id`, `GET /api/corpus/compare?a=id&b=id`
- `packages/ui/src/pages/CorpusPage.tsx` — batch upload UI, progress stream display, stats visualisation (charts reusing existing `TimelineChart` patterns), comparison view

Files to **modify**:
- `packages/analyzer/src/auth/middleware.ts` — add `'corpus': { research: 20 }` (20 batch uploads per day)
- `packages/analyzer/src/auth/db.ts` — call `runCorpusMigration()`
- `packages/analyzer/src/index.ts` — mount `/api/corpus` router
- `packages/ui/src/App.tsx` — add `/corpus` route (guarded: redirect to `/pricing` for non-Research)

**DB Schema**
```sql
CREATE TABLE IF NOT EXISTS corpora (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  file_count  INTEGER NOT NULL,
  stats_json  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);
```

**Tier Gating**
- Research only

**Effort Estimate:** L (large) — ~5–7 days

**Dependencies:** `parseUploadedFile` from `packages/analyzer/src/routes.ts`; `analyzeTimeline` from `packages/analyzer/src/analyzer.ts`; `multer` (already installed)

---

### Feature 11 — Learning Paths

**Goal**
Curated lesson sequences that guide users through music theory concepts using the app's existing interactive tools. Each lesson has explanatory content, a task to complete in-app, and a quiz question to confirm understanding.

**User Story**
As a self-taught musician, I want guided lessons that walk me through set theory from "What is a pitch class?" up to "Neo-Riemannian transformations" — each lesson using the actual app tools, with progress tracked so I can resume where I left off.

**Acceptance Criteria**
1. A "Learn" page shows available learning paths (e.g., "Introduction to Set Theory", "Symmetry and Groups", "Voice Leading Geometry", "Neo-Riemannian Theory").
2. Each path contains 5–15 lessons. Each lesson has: title, markdown explanation text, an in-app task (e.g., "classify this set in the Classifier"), and an optional quiz question.
3. Lesson completion is tracked per user in the DB (completed = task done + quiz answered correctly if present).
4. Free tier: first 2 lessons of each path are unlocked; remaining lessons show a soft upgrade prompt.
5. Pro/Research: full access to all paths and lessons.
6. Progress is shown as a progress bar on the Learn page and on the Dashboard.
7. Lesson content is stored as JSON/markdown in the codebase (not in the DB) — only progress is persisted in the DB.
8. New learning paths can be added by writing a new JSON file without changing application code.
9. A "Resume" button on the Dashboard deep-links to the next incomplete lesson.
10. Lessons can embed interactive tool deep-links that open the relevant app page with pre-set parameters.

**Implementation Plan**

Files to **create**:
- `packages/ui/src/data/learning-paths/` — directory; one JSON file per path (e.g., `intro-set-theory.json`, `symmetry-groups.json`, `neo-riemannian.json`, `voice-leading-geometry.json`). Each file is a typed `LearningPath` object with `lessons[]`.
- `packages/ui/src/data/learning-paths/types.ts` — `LearningPath`, `Lesson`, `LessonTask`, `QuizQuestion` type definitions
- `packages/analyzer/src/learning/db.ts` — `runLearningMigration()`, `getLessonProgress(userId)`, `markLessonComplete(userId, pathId, lessonId)`, `resetProgress(userId, pathId)`
- `packages/analyzer/src/learning/routes.ts` — `GET /api/learning/progress`, `POST /api/learning/progress/:pathId/:lessonId/complete`
- `packages/ui/src/pages/LearningPathPage.tsx` — path overview + lesson list with completion status; lesson detail view with markdown renderer, task link, and quiz component
- `packages/ui/src/hooks/useLearningProgress.ts` — wraps `/api/learning/progress`

Files to **modify**:
- `packages/analyzer/src/auth/db.ts` — call `runLearningMigration()`
- `packages/analyzer/src/index.ts` — mount `/api/learning` router
- `packages/ui/src/App.tsx` — add `/learn`, `/learn/:pathId`, `/learn/:pathId/:lessonId` routes
- `packages/ui/src/pages/DashboardPage.tsx` — add "Resume Learning" card with next-lesson deep-link and path progress bars

**DB Schema**
```sql
CREATE TABLE IF NOT EXISTS lesson_progress (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id     TEXT NOT NULL,
  lesson_id   TEXT NOT NULL,
  completed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, path_id, lesson_id)
);
```

**Tier Gating**
- Free: lessons 1–2 of each path (enforced client-side with server validation on progress submission)
- Pro/Research: all lessons

**Effort Estimate:** L (large) — ~6–8 days (bulk of effort is authoring lesson content)

**Dependencies:** Markdown renderer (e.g., `react-markdown`, check if already in `packages/ui/package.json`); `DashboardPage.tsx`; Quiz logic from `packages/ui/src/pages/QuizPage.tsx` (can reuse question component)

---

## Summary Table

| # | Feature | Batch | Tier Gate | Effort |
|---|---------|-------|-----------|--------|
| 3 | Personal Analysis History + Bookmarks | 1 | Free (7-day limit), Pro (unlimited) | S |
| 4 | MIDI Keyboard Live Mode | 1 | Free (5-min cap), Pro (unlimited) | S |
| 7 | Citation Generator | 1 | Research only | S |
| 9 | LaTeX Theorem Environment Export | 1 | Research only | S |
| 12 | Achievement System | 1 | All tiers | S |
| 13 | Notification Digest Enhancement | 1 | All tiers | S |
| 1 | Set Class Flashcard Deck Builder | 2 | Free (1 deck/10 cards), Pro (unlimited) | M |
| 6 | Bulk Set Class Export API | 2 | Research only | M |
| 10 | Daily Set Challenge | 2 | All tiers | M |
| 14 | Embeddable Widget v2 | 2 | All tiers (no auth) | M |
| 15 | Social Cards | 2 | All tiers | M |
| 16 | Public Atlas Profiles | 2 | Pro/Research (publish), All (view) | M |
| 2 | Collaborative Analysis Rooms | 3 | Free (view), Pro/Research (full) | L |
| 5 | Spotify / YouTube Link Analyzer | 3 | Free (1/day), Pro (10/day), Research (unlimited) | L |
| 8 | Comparative Corpus Analysis | 3 | Research only | L |
| 11 | Learning Paths | 3 | Free (2 lessons), Pro/Research (all) | L |

---

*Generated: 2026-05-07 | Chrometria / Musical Symmetry*
