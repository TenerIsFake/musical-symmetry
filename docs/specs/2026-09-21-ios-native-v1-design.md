# Chrometria iOS — native v1 design

**Status:** approved decisions, ready for an implementation plan · **Date:** 2026-09-21
**Supersedes:** `ios-app-spec.md`, which was never built and described a different scope.

This records decisions that are settled, so they are not re-argued later. Where a decision
rests on something unverified, it says so.

---

## 0. Decisions taken

| # | Decision | By |
|---|---|---|
| 1 | Native iOS app, **not** a WebView wrapper | Tener, 2026-09-21 |
| 2 | `packages/core` is **ported to Swift**, verified against generated vectors | this design |
| 3 | **One-time non-consumable, US$12.99.** No subscription on iOS | Tener, 2026-09-21 |
| 4 | Account deletion ships **first**, before any Swift | this design |
| 5 | v1 is ~11 screens, offline-first | this design |
| 6 | Magic-link auth via a one-time **code**, not a universal link | this design |
| 7 | **No bidirectional sync** in v1 | this design |

## 1. What is already true (verified 2026-09-21, do not re-derive)

- **The app is already mostly client-side.** 26 of 42 pages import `@musical-symmetry/core`
  and ~21 of those make no API call. `POST /api/classify` is the same `classify()` the client
  already runs plus a history insert. The server owns identity, persistence, file parsing,
  classroom and share-card rendering — **not the mathematics.** This is the Guideline 4.2
  argument, and it is much stronger than earlier notes claimed.
- **`packages/core` is ~2k LOC** of integer mod-12 arithmetic with no significant data tables.
- **Test coverage is half.** 13 test files in `packages/core/tests/`; **nine modules have
  none**: `contour`, `rhythm`, `tuning`, `transform-chain`, `euclidean`, `constraint-composer`,
  `orchestration`, `quantize`, `voicings`.
- **Forte numbers are not in `core`.** Duplicated in `packages/ui/src/data/forte-numbers.ts`
  and `packages/analyzer/src/atlas/data.ts`.
- **No account-deletion route exists anywhere** in `packages/analyzer/src` (grep confirms).
- **No Stripe cancellation code exists.** `auth/stripe.ts` has only a checkout `cancel_url`.
- **Entitlement names already in code** (`packages/ui/src/utils/revenuecat.ts:54-60`):
  `research_access`, `pro_access`, `student_access`.
- **`sketches.user_id` is `INTEGER` against a `TEXT` `users.id`** (`sketches/db.ts:8` vs
  `auth/db.ts:21`). ⚠️ **Corrected 2026-09-21: this is a cosmetic schema smell, NOT a bug.**
  It was reported as a latent defect that would break the foreign key; tested empirically on
  a scratch database (both a hex id and an all-digit id) and `DELETE ... WHERE user_id = ?`
  matches correctly in both cases, because SQLite applies column affinity to the bound
  parameter. Worth tidying one day; **not** a deletion hazard, and nothing depends on fixing it.
- No `ios/` project, no Capacitor iOS, **no App Store Connect record**. Creating one is
  web-UI only.

## 2. ADR — `packages/core` becomes a Swift port

**Options:** port to Swift · run the TS in JavaScriptCore · compile to WASM.

**Decision: port to Swift.**

**Why.** Core is ~2k lines of integer arithmetic. JavaScriptCore would ship a JS engine to
evaluate 2k lines of mod-12 maths, and the whole reason for going native was Guideline 4.2 —
embedding a JS runtime to run the app's central logic argues against the position we are
trying to take. TypeScript has no direct WASM toolchain; AssemblyScript is a rewrite anyway
and adds a bridge. The tested half of core ports in days.

**Cost accepted:** two implementations of the same mathematics, which must agree forever.
That cost is only tolerable because of the conformance oracle below — without it, this
decision is wrong.

**Revisit if:** a native Android rewrite is planned (three copies changes the maths), or core
grows past roughly 10k LOC.

### 2.1 Conformance oracle — generated vectors, not a ported suite

Do **not** port Vitest to XCTest. Instead add a generator in `packages/core` that runs every
exported pure function over a fixed corpus and writes an exhaustive `test-vectors.json`:

- all 4,095 non-empty pitch-class sets through `classify`, `normalize`, `intervalVector`,
  `identifyChord`
- all 24 major/minor triads through PLR, `classifyTransition`, `findPLRPath`
- fixed inputs for the remaining exports

Vitest asserts the TypeScript still matches the file (regression). XCTest loads the **same
file** and asserts Swift matches (conformance). One artefact, two consumers.

**Two constraints found in the code, not assumed:**
- `transform-chain.ts:90` `randomChain` uses `Math.random` — exclude it from the corpus or
  inject a seeded RNG.
- `rhythmEvenness`, `rhythmSimilarity`, `contourSimilarity`, `findBestScale.score` and the
  tuning frequencies return floats — compare with a 1e-9 tolerance, not equality.

**Generate vectors for the nine untested modules *before* porting them.** That is
characterization testing the web app currently lacks, and it is the only thing that makes
those modules safe to port. It also has value even if iOS never ships.

## 3. Offline boundary

**On device (core-backed):** classifier (with Tonnetz and orbit views), atlas, progression and
PLR, interval cycles, search, quiz, ear training, rhythm and Euclidean, voice-leading graph,
tuning, transform, live pitch detection, MIDI I/O.

- Replace Tone.js (`useAudio.ts`) with **AVAudioEngine**.
- Replace the autocorrelation in `useMicPitchDetect.ts` with an **AVAudioEngine tap + vDSP**.
- Use **CoreMIDI** — Web MIDI is silent on iOS today, so this is a capability gain.
- The atlas needs `FORTE_CATALOG` shipped on device (resolve the duplication while doing it).

**Stays server-side:** identity and sessions, entitlement sync, classroom and rooms
websockets, assignments, public profiles, corpus, link analysis, digests, bulk operations, PDF
reports, OG/share cards.

**Deferred (v1 uses the server):** file analysis. `analyzer.ts` and `slicer.ts` are small and
core-callable, but the parsers are `midi-file`, `fast-xml-parser` and a hand-rolled WAV
reader. v1.1 ports MIDI parsing natively — the highest 4.2 evidence per hour of work.

## 4. v1 scope — ~11 screens

**Principle:** everything that runs from core with no network, plus the account, purchase and
deletion plumbing Apple requires. Nothing that needs a second human or a server-side renderer.

**In:** Classifier · Atlas · Progression · Ear Training · Quiz · Live Detection · Rhythm +
Euclidean · Tuning · Search · Interval Cycles · Voice-Leading Graph · Settings (account,
purchase, delete).

**v1.1:** Analyzer with on-device MIDI · Flashcards (needs a local SRS; server-only today) ·
Melody · Practice · Harmonic Path · Orchestration · Compose · Transform · Palette.

**Not native:** classroom · rooms · assignments · corpus · profiles · embed · api-docs · daily
challenge · learning paths · sketchpad · timeline · annotate.

## 5. Account deletion — Guideline 5.1.1(v)

**Ships first. No Swift required, and it unblocks web, Android and iOS at once.**

`DELETE /api/auth/account`, behind `requireAuth`, body `{confirm: "<the user's email>"}`, all
in one transaction:

1. Cancel the Stripe subscription when `stripe_subscription_id` is set — **this code does not
   exist yet** and must be written.
2. Delete rows in tables that have **no cascade**: `workspaces`, `assignments` (both creator
   and student; no FK at all), `assignment_submissions`, `classrooms`, `classroom_members`,
   `sketches`, plus `magic_tokens` by email and `sessions` by user. Set `api_usage.user_id`
   NULL where nullable.
3. `DELETE FROM users` cascades the remaining tables.
4. Destroy the session, return 204.

**Resolve the `sketches.user_id` INTEGER/TEXT mismatch here** — deletion is the first code
that depends on that foreign key working.

**In-app:** Settings → Delete account → a sheet itemising exactly what is removed →
type-to-confirm → call → wipe local store and Keychain. The same endpoint gets a Dashboard
button on web and Android, replacing the email instructions at `PrivacyPage.tsx:185`.

Build it fully in-app. Whether Apple tolerates completing deletion on a web page is
unverified, and building it properly makes the question moot.

## 6. Purchases — Guideline 3.1.1

**One-time non-consumable, US$12.99**, granting the existing `pro_access` entitlement via
RevenueCat's **Swift** SDK (the Capacitor plugin does not carry over).

**Rationale, recorded because it will be questioned:** the Stripe tiers are effectively API
rate limits (`middleware.ts` `TIER_LIMITS`) — they fund server cost, which a subscription
legitimately covers. The iOS app's value is on-device computation at zero marginal cost, so a
recurring charge has nothing to recur against. The market agrees: four of six comparable apps
are one-time, at $4.99–$17.99.

- **Do not sell the Research tier in-app**, and include no external purchase links (3.1.1).
  Honour `research` if the signed-in account already has it.
- **Effective tier = max(server tier, RevenueCat entitlement).**
- Add a RevenueCat webhook → `updateTier` so a purchase on iOS is visible on the web.
- There are zero existing subscribers, so there is **no migration problem**.
- The non-consumable must be created in the ASC web UI — the API returns 403 for these.

⚠️ **Independent of iOS: the web prices contradict each other.** `LandingPage.tsx:389,411`
advertises $9/mo and $29/mo; `DashboardPage.tsx:354-355` charges $7/mo and $15/mo. The site
advertises prices it does not charge. Fix that on its own merits.

## 7. Auth

Magic-link email (Resend) stays, and **Sign in with Apple is not required**: Guideline 4.8
applies to third-party and social logins and exempts apps using only their own account system.
⚠️ **Adding Google or any social login later would trigger 4.8** — decide that knowingly.

`GET /api/auth/verify` sets a cookie and 302s to `/#dashboard`, which is useless to a native
app. Add a JSON variant that also issues a **six-digit code** alongside the token; the app
posts the code and receives the account's API key (`x-api-key` auth already exists at
`middleware.ts:18`), stored in the **Keychain**.

Codes rather than universal links because Gmail's in-app browser breaks the
apple-app-site-association handoff. `ASWebAuthenticationSession` is unnecessary — there is no
OAuth flow here.

**Anonymous use keeps working** — it already does, and 5.1.1(v) requires it.

## 8. Data, sync and privacy labels

**On device:** SQLite/SwiftData for history, collections, quiz progress and settings; Keychain
for the API key.

**No bidirectional sync in v1.** The server tables carry `created_at` only — no `updated_at`,
no client ids (`auth/db.ts:69-92`) — so conflict resolution cannot be built without schema
work. Local history stays local; collections push one way when signed in.

**Privacy labels.** Anonymous use collects nothing. Signed in: email (contact info, linked),
user id (identifier), and `api_usage` records IP and endpoint per request (`auth/db.ts:34`) →
usage data, linked. RevenueCat → purchase history. **Microphone audio never leaves the
device.** AdSense and analytics are already guarded behind `isNativePlatform` and must stay
that way.

## 9. Risk

**The biggest risk is not the mathematics** — that ports in days against vectors. It is the
**D3 visualisations**: `VoiceLeadingGraphPage` is 852 lines, plus Tonnetz, orbit and the
timeline chart. That is where the bulk of the effort goes, and where a reviewer forms their
judgement about whether the app is genuinely native. Prototype one of them early; if the
hardest visualisation cannot be made to feel native, that finding should arrive in week one,
not month three.

## 10. Sequence

1. **Deletion endpoint + web/Android UI** — no Swift, unblocks three platforms, fixes the
   `sketches` FK bug, writes the missing Stripe cancellation.
2. **Vector generator + characterization vectors for every core module** — no Swift; valuable
   to the web app on its own.
3. **Swift port of core**, green against the vectors.
4. **Classifier + Atlas + Live Detection** — the thinnest slice that is recognisably the
   product, and it exercises the port, the audio stack and the visualisations.
5. **Code-based auth + the $12.99 unlock.**
6. **TestFlight.** Everything else is v1.1.

Steps 1 and 2 need no Swift, no App Store record and no decisions. They are the right place
to start, and they retain their value even if the iOS app is never finished.
