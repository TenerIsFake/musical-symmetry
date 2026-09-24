# Chrometria iOS — native v1 design

**Status:** partly superseded — see §0 · **Date:** 2026-09-21, revised 2026-09-23
**Supersedes:** `ios-app-spec.md`, which was never built and described a different scope.
**Superseded in part by:** the Capacitor-wrap decision of 2026-09-23. §0, §6, §7, §9 and §10
carry revision banners; §1, §3, §5 and §8 stand as written.

This records decisions that are settled, so they are not re-argued later. Where a decision
rests on something unverified, it says so.

---

## 0. Decisions taken

> ⚠️ **Revised 2026-09-23. Rows 1, 2, 5 and 6 are SUPERSEDED.** Tener chose a **Capacitor
> wrap** over a native rewrite, because everything after the core port needs Xcode and
> therefore macOS, which he does not have — a constraint that surfaced only when this plan
> forced the question. A wrap is developed on Linux with macOS as a CI build step.
> See `ios-pipeline/from-code/2026-09-23-DECISION-chrometria-capacitor-wrap.md`.
>
> The sections below are kept because most of the analysis survives the change — the Apple
> guidelines, the offline boundary, the account-deletion design and the auth reasoning apply
> to either approach. Read §2 (the Swift port) as **done and still useful, but no longer on
> the critical path**: `packages/core-swift` is merged and a wrap simply does not use it.

| # | Decision | By | Status |
|---|---|---|---|
| 1 | ~~Native iOS app~~ → **Capacitor wrap** | Tener, 2026-09-23 | supersedes the 09-21 decision |
| 2 | ~~`packages/core` ported to Swift~~ | — | done (`4c64ae0`), unused by a wrap |
| 3 | **One-time non-consumable, US$12.99.** No subscription on iOS | Tener, 2026-09-21 | stands — but see §6, what it unlocks changed |
| 4 | Account deletion ships **first** | this design | ✅ done; a wrap inherits it inside the webview |
| 5 | ~~v1 is ~11 native screens~~ | — | a wrap ships the existing web app |
| 6 | ~~Magic-link via a one-time code~~ | — | a wrap keeps the existing web auth flow |
| 7 | **No bidirectional sync** in v1 | this design | stands |

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

> **Revised 2026-09-23** for the Capacitor decision *and* to close a pricing leak the original
> text created. Read the revision notes — the price is unchanged, what it buys is not.

**One-time non-consumable, US$12.99**, bought through
**`@revenuecat/purchases-capacitor`** (already a dependency at `^13.1.0`). The original text
said the Swift SDK, "because the Capacitor plugin does not carry over" — that was true of a
native rewrite and is now backwards: the plugin is exactly what carries over.

**Rationale, recorded because it will be questioned:** the Stripe tiers are effectively API
rate limits (`middleware.ts` `TIER_LIMITS`) — they fund server cost, which a subscription
legitimately covers. The iOS app's value is on-device computation at zero marginal cost, so a
recurring charge has nothing to recur against. The market agrees: four of six comparable apps
are one-time, at $4.99–$17.99.

### 6.1 What $12.99 buys — on-device capability, never server quota

⚠️ **This supersedes "grants the existing `pro_access` entitlement" and
"effective tier = max(server tier, RevenueCat entitlement)".** Those two lines together
priced Pro's *server* quota at $12.99 once against $7/month on the web — 1,000 classify calls
a day, forever, for less than two months of the subscription, and the gap widened when
Research moved $8 → $15 on 2026-09-23. They also contradict the rationale directly above
them: a one-time price is defensible *because* the value is on-device, and it stops being
defensible the moment it hands out the thing that costs money to serve.

| | unlocked by the $12.99 purchase | stays on a subscription |
|---|---|---|
| runs where | the device | the server |
| marginal cost | zero | per request |
| features | ads off; classifier, atlas, progression/PLR, interval cycles, search, quiz, ear training, rhythm + Euclidean, tuning, transform, live pitch detection, MIDI, and the visualisations | API quota above the free tier, bulk operations, corpus, link analysis, digests, PDF reports, OG/share cards, classroom and rooms, server-side file analysis |

**The purchase and the account tier are separate axes and must stay separate in code:**

- Grant a **new entitlement, `ios_unlock`** — *not* `pro_access`. Reusing a tier entitlement is
  the leak, because `tierFromEntitlements` (`packages/ui/src/utils/revenuecat.ts:54-60`) maps
  entitlement → `User['tier']`, and tier is what the server's rate limiter reads.
- ~~**Delete `tierFromEntitlements`**~~ — **done 2026-09-23.** It is gone; nothing maps an
  entitlement onto `User['tier']` any more. The entitlement contract now lives in
  `packages/ui/src/utils/entitlements.ts`, and the leak is structural rather than
  documentary: `canUseServer(tier, required)` **takes no unlock parameter**, so no call site
  can pass one. `canUseOnDevice(tier, required, unlocked)` is the only gate the purchase
  opens. A test pins the arity, because that absence is the whole guarantee.
  (Context for why this needed doing at all: nothing imported `utils/revenuecat.ts` — zero
  call sites on any platform, Android included. Earlier notes calling the RevenueCat
  integration "wired" were reading the file, not its callers.)
- **No `max(server tier, entitlement)` rule, and no RevenueCat → `updateTier` webhook.** Both
  existed only to move an iOS purchase into the server tier, which is the thing being
  prevented. A purchase is a device fact; a subscription is an account fact.
- A signed-in account keeps whatever server tier it already pays for, on iOS as on the web.
  The two stack; neither substitutes for the other.
- **Do not sell the Research tier in-app**, and include no external purchase links (3.1.1).
  Honour `research` if the signed-in account already has it.
- There are zero existing subscribers, so there is **no migration problem**.
- The non-consumable must be created in the ASC web UI — the API returns 403 for these.

**The honest trade this makes:** an iOS-only user who never signs in pays once and never
again, and the app is genuinely fully featured for them, because everything they touch runs on
their phone. A user who wants the server — classrooms, bulk, corpus, the API — subscribes, and
pays iOS's 15–30% on nothing. That is the split the price was chosen on.

**Restore purchases is mandatory** (3.1.1 requires it for non-consumables) and is
`restorePurchases()` above, which currently nothing calls.

⚠️ **Independent of iOS: the web prices contradicted each other.** `LandingPage.tsx` advertised
$9/mo and $29/mo while `DashboardPage.tsx` charged $7/mo and $15/mo. **Settled 2026-09-23:**
Research $15, Pro $7, Student $3 everywhere; the landing page was the one that was wrong.

## 7. Auth

> **Superseded 2026-09-23 by the Capacitor decision.** A wrap runs the existing web auth
> inside the webview and needs none of this: no JSON verify variant, no six-digit code, no
> Keychain. Kept because the reasoning is the right answer *if* a native client is ever
> built, and because the 4.8 warning below applies to the wrap unchanged.

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

> **Superseded 2026-09-23 by the Capacitor decision.** The D3 risk below was a *porting* risk:
> it existed because native screens would have had to reimplement the visualisations. A wrap
> ships the same D3 that runs on the web today, so that risk goes to zero — and it is replaced
> by the one the native decision was originally taken to avoid: **Guideline 4.2 minimum
> functionality**. The mitigating fact is in §1 — 26 of 42 pages import
> `@musical-symmetry/core` and ~21 make no API call, so the app is not a thin client dressed
> as an app. The new first-week risk is the toolchain: whether `npx cap add ios` and a
> headless macOS CI build actually produce a signed `.ipa` without a Mac to debug on.

**The biggest risk is not the mathematics** — that ports in days against vectors. It is the
**D3 visualisations**: `VoiceLeadingGraphPage` is 852 lines, plus Tonnetz, orbit and the
timeline chart. That is where the bulk of the effort goes, and where a reviewer forms their
judgement about whether the app is genuinely native. Prototype one of them early; if the
hardest visualisation cannot be made to feel native, that finding should arrive in week one,
not month three.

## 10. Sequence

> **Revised 2026-09-23.** Steps 1–3 of the original sequence are **done**: the deletion
> endpoint shipped (`eec2a07`, `cbb7140`), the vector generator and characterization vectors
> landed, and the Swift core port merged (`4c64ae0`) with CI enforcing TS/Swift equivalence.
> The remaining steps assumed native screens and no longer apply.

The Capacitor sequence, in dependency order:

1. **`ios/` platform scaffold** — `@capacitor/ios` plus `npx cap add ios`, and an `ios` section
   in `capacitor.config.ts` mirroring the Android one. Capacitor 8 uses Swift Package Manager
   rather than CocoaPods, which is why this step runs on Linux at all.
   ⚠️ **`cap add ios` ships Capacitor's own logo as the app icon** and nothing objects — it
   builds, installs and reaches TestFlight. Yissian's build 2 went out with the equivalent
   Expo placeholder. `scripts/make-ios-icon.py` renders the real icon from
   `public/chrometria-icon.svg` at 1024×1024 with the alpha channel flattened (Apple rejects
   an icon that has one); `src/__tests__/ios-icon.test.ts` pins both, and pins the placeholder
   out by hash, because size and colour type alone do not distinguish it.
2. ~~**The purchase UI**~~ — **done 2026-09-23.** `DeviceUnlockCard` sells and restores;
   `DeviceUnlockProvider` holds the entitlement once for the whole app; 25 screens consult it
   through `useOnDeviceGate()`. Three things worth not re-deriving:
   - **The price is read from the store, never hardcoded.** App Store prices are
     per-storefront and US$12.99 is one tier of many.
   - **`unlockForSale` is narrower than `purchasesSupported`.** Android has a live `goog_`
     key for a product of its own, so it "supports purchases" while not selling *this* one.
     Without the split, the safety of every gated screen on Android would rest on a
     RevenueCat dashboard never mapping `ios_unlock` to a Play product.
   - ⚠️ **A limit with a server-side twin stays on the account tier.** Sketchpad's bar count
     reads like a local editor cap; `packages/analyzer/src/sketches/routes.ts` revalidates it
     on save. Widening it client-side grants nothing — it moves the refusal from the editor
     to a 403, shown to the one user who paid.
3. **macOS CI** — build, sign, upload to TestFlight. Two documented snags: `capacitor.config.ts`
   needs TypeScript loadable as a devDependency, and the Capacitor template ships no shared
   `xcscheme` (Xcode writes one on first GUI open, which never happens on a headless runner).
4. **ASC record, the $12.99 non-consumable, and the `appl_` RevenueCat key** — Tener/Cowork,
   web consoles only. ⚠️ **Order matters and the trap is real:** a key with no product behind
   it is a Guideline 2.1 non-functional purchase, a product with no key is an invisible
   upsell. Wire the product into the offering's *first* package, then set the iOS key **last**,
   in the same change that ships it. Yissian hit exactly this.
5. **TestFlight**, then the sandbox purchase on a real device — the only thing that proves the
   purchase path. `VALID` on ASC proves it only on paper.

Steps 1–3 need nothing from Apple and no decisions. Step 4 is the gate, and it should not be
requested before step 1 has produced something that compiles — a request filed early becomes a
stale request.
