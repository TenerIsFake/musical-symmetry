# ChrometriaCore Swift Port — Part 1: set-theory core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Swift package whose set-theory functions produce byte-identical results to the TypeScript engine for all 4,095 pitch-class sets, proven by the committed conformance vectors.

**Architecture:** A SwiftPM library, `ChrometriaCore`, with no UI and no Apple-only dependencies, so it builds and tests on Linux as well as macOS. Its XCTest suite loads `packages/core/test-vectors.json` — the same file Vitest replays — and asserts the Swift output matches. The port proceeds in dependency order, one module per task, each task green against its own vectors before the next begins.

**Tech Stack:** Swift 6.x (swift.org toolchain), SwiftPM, XCTest, Foundation only.

**Spec:** `docs/specs/2026-09-21-ios-native-v1-design.md` (§2 and §2.1)

---

## ⚠️ Read this before starting: what this plan can and cannot be built on

- **This plan is executable on the Linux build machine.** It is pure logic with no UIKit or SwiftUI, and swift.org ships an official toolchain for Ubuntu 24.04 x86_64. Task 1 installs it.
- **The rest of the iOS app is NOT.** Screens, the simulator, and any TestFlight build need Xcode, which needs macOS — and no machine in this project's build environment runs it. This repo is public, so GitHub Actions does offer free **macOS runners**, which can compile and sign an app; but compiling in CI is not the same as being able to see a screen while you build it.
- **This is a real consequence of choosing native over a WebView wrap, and it was not weighed when that call was made.** It does not reverse the decision. It does mean **a Mac, or a rented cloud Mac, is a prerequisite for every plan after this one** — worth knowing before more effort is spent.
- **Deliberate consequence for sequencing:** this part is the whole of the port that can be done without that purchase, which is another reason it comes first.

## Global Constraints

- **Foundation only.** No UIKit, SwiftUI, CoreGraphics or other Apple-only frameworks anywhere in this package. It must compile on Linux; that constraint is what keeps it testable here and portable later.
- **The vectors are the specification.** `packages/core/test-vectors.json` is authoritative. If Swift and the file disagree, Swift is wrong — unless the TypeScript is found to be wrong, in which case fix TypeScript, regenerate, and commit both together.
- **Never edit `test-vectors.json` by hand.** Regenerate with `npm -w packages/core run vectors`.
- **Floats compare to 1e-9**, never `==`. Integers and strings compare exactly.
- **Pitch classes are 0–11.** `mod12` is Euclidean: `mod12(-1) == 11`, matching the TypeScript, not Swift's `%` which yields `-1`.
- **Empty input is legal everywhere** and must not trap. The corpus deliberately includes `[]`.
- Package lives at `packages/core-swift/`, inside the existing monorepo, so the vectors sit at a stable relative path.

## File Structure

| File | Responsibility |
|---|---|
| `packages/core-swift/Package.swift` | SwiftPM manifest: one library target, one test target |
| `packages/core-swift/Sources/ChrometriaCore/PitchClass.swift` | The `PitchClass` type alias and `mod12` |
| `packages/core-swift/Sources/ChrometriaCore/PcSet.swift` | `toPcSet`, `transpose`, `invert`, `normalize`, `complement`, `areEqual` |
| `packages/core-swift/Sources/ChrometriaCore/Intervals.swift` | `intervalVector`, `myhillProperty`, `zRelated` |
| `packages/core-swift/Sources/ChrometriaCore/Evenness.swift` | `isMaximallyEven` |
| `packages/core-swift/Sources/ChrometriaCore/Symmetry.swift` | `transpositionalStabilizer`, `inversionalAxes`, `stabilizerOrder`, `distinctTranspositions`, `abstractGroup` |
| `packages/core-swift/Sources/ChrometriaCore/Mulliken.swift` | `mullikenLabel` |
| `packages/core-swift/Sources/ChrometriaCore/CharacterTable.swift` | `characterTableEntry` |
| `packages/core-swift/Sources/ChrometriaCore/Modes.swift` | `isRetrogradePalindrome` (only the part `classify` needs; the rest is a later plan) |
| `packages/core-swift/Sources/ChrometriaCore/Classify.swift` | `classify`, the aggregate `SymmetryAnalysis` |
| `packages/core-swift/Tests/ChrometriaCoreTests/VectorLoader.swift` | Loads and decodes `test-vectors.json`; shared by every test |
| `packages/core-swift/Tests/ChrometriaCoreTests/*Tests.swift` | One test file per source file, each driven by that function's vectors |

---

### Task 1: Toolchain and package skeleton that loads the vectors

The first task is the risky one: it proves the toolchain works, the package builds, and the test target can actually read the JSON. Everything after is arithmetic.

**Files:**
- Create: `packages/core-swift/Package.swift`
- Create: `packages/core-swift/Sources/ChrometriaCore/PitchClass.swift`
- Create: `packages/core-swift/Tests/ChrometriaCoreTests/VectorLoader.swift`
- Create: `packages/core-swift/Tests/ChrometriaCoreTests/VectorLoaderTests.swift`

**Interfaces:**
- Consumes: nothing.
- Produces: `enum Vectors { static func cases(for name: String) throws -> [Vector] }` and
  `struct Vector { let name: String; let args: [Any]; let value: Any }`, plus the
  convenience accessors `Vector.intArrayArg(_ index: Int) -> [Int]?` and
  `Vector.intArrayValue: [Int]?`. Every later task calls `Vectors.cases(for:)`.
  (`Any` rather than a Codable wrapper: the recorded values are heterogeneous —
  numbers, strings, booleans, arrays and objects — and `JSONSerialization` already
  hands back exactly that. A generic wrapper would be more code for no more safety.)

- [ ] **Step 1: Install the Swift toolchain**

```bash
# Ubuntu 24.04 x86_64. Check the current release URL at swift.org/install/linux
cd /tmp
curl -fsSL -O https://download.swift.org/swift-6.0.3-release/ubuntu2404/swift-6.0.3-RELEASE/swift-6.0.3-RELEASE-ubuntu24.04.tar.gz
tar xzf swift-6.0.3-RELEASE-ubuntu24.04.tar.gz
sudo mv swift-6.0.3-RELEASE-ubuntu24.04 /opt/swift
echo 'export PATH=/opt/swift/usr/bin:$PATH' >> ~/.bashrc
export PATH=/opt/swift/usr/bin:$PATH
swift --version    # expect: Swift version 6.0.3
```

- [ ] **Step 2: Write the failing test**

`packages/core-swift/Tests/ChrometriaCoreTests/VectorLoaderTests.swift`:

```swift
import XCTest
@testable import ChrometriaCore

final class VectorLoaderTests: XCTestCase {
    func testLoadsTheCommittedVectorFile() throws {
        let all = try Vectors.cases(for: "intervalVector")
        // the corpus runs intervalVector over all 4,095 non-empty pc-sets
        XCTAssertEqual(all.count, 4095)
    }

    func testDecodesArgumentsAndValues() throws {
        let cases = try Vectors.cases(for: "intervalVector")
        let major = try XCTUnwrap(cases.first { $0.intArrayArg(0) == [0, 4, 7] })
        XCTAssertEqual(major.intArrayValue, [0, 0, 1, 1, 1, 0])
    }
}
```

- [ ] **Step 3: Run it and watch it fail**

```bash
cd packages/core-swift && swift test
```
Expected: compile failure — `cannot find 'Vectors' in scope`.

- [ ] **Step 4: Write the loader**

`packages/core-swift/Tests/ChrometriaCoreTests/VectorLoader.swift`:

```swift
import Foundation

/// One recorded case from `packages/core/test-vectors.json`.
///
/// The file is generated by the TypeScript engine and is the specification
/// this port is held to — see docs/specs/2026-09-21-ios-native-v1-design.md §2.1.
/// Never edit it by hand; regenerate with `npm -w packages/core run vectors`.
struct Vector {
    let name: String
    let args: [Any]
    let value: Any

    func intArrayArg(_ index: Int) -> [Int]? {
        guard index < args.count, let raw = args[index] as? [Any] else { return nil }
        return raw.compactMap { ($0 as? NSNumber)?.intValue }
    }

    var intArrayValue: [Int]? {
        guard let raw = value as? [Any] else { return nil }
        return raw.compactMap { ($0 as? NSNumber)?.intValue }
    }
}

enum Vectors {
    /// Resolved relative to this source file so the tests do not depend on the
    /// working directory swift test happens to be run from.
    private static var fileURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // ChrometriaCoreTests
            .deletingLastPathComponent()   // Tests
            .deletingLastPathComponent()   // core-swift
            .appendingPathComponent("core/test-vectors.json")
    }

    private static let all: [Vector] = {
        guard let data = try? Data(contentsOf: fileURL),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let raw = root["vectors"] as? [[String: Any]]
        else { return [] }
        return raw.compactMap { entry in
            guard let name = entry["name"] as? String else { return nil }
            return Vector(name: name,
                          args: entry["args"] as? [Any] ?? [],
                          value: entry["value"] as Any)
        }
    }()

    static func cases(for name: String) throws -> [Vector] {
        let matching = all.filter { $0.name == name }
        // An empty result means a typo'd name or a missing file, and would make
        // a test vacuously pass. Fail loudly instead.
        if matching.isEmpty {
            throw NSError(domain: "Vectors", code: 1, userInfo: [
                NSLocalizedDescriptionKey:
                    "no vectors named \(name) — check the spelling and that " +
                    "packages/core/test-vectors.json exists"])
        }
        return matching
    }
}
```

- [ ] **Step 5: Write the package manifest and the placeholder source**

`packages/core-swift/Package.swift`:

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ChrometriaCore",
    products: [.library(name: "ChrometriaCore", targets: ["ChrometriaCore"])],
    targets: [
        .target(name: "ChrometriaCore"),
        .testTarget(name: "ChrometriaCoreTests", dependencies: ["ChrometriaCore"]),
    ]
)
```

`packages/core-swift/Sources/ChrometriaCore/PitchClass.swift`:

```swift
/// A pitch class, 0–11.
public typealias PitchClass = Int

/// Euclidean modulo 12.
///
/// Swift's `%` returns a negative remainder for negative input (`-1 % 12 == -1`),
/// which the TypeScript does not. Every vector for a negative input depends on
/// this difference, so it is the first thing ported.
public func mod12(_ n: Int) -> PitchClass {
    let r = n % 12
    return r < 0 ? r + 12 : r
}
```

- [ ] **Step 6: Run the tests and watch them pass**

```bash
cd packages/core-swift && swift test
```
Expected: 2 tests pass.

- [ ] **Step 7: Prove the loader cannot pass vacuously**

Temporarily change `cases(for: "intervalVector")` to `cases(for: "intervalVectorX")` in the test and re-run. Expected: FAIL with "no vectors named intervalVectorX". Change it back.

This matters because a loader that silently returns `[]` would make every later task's test pass while testing nothing — the exact failure the TypeScript spec this replaces suffered from.

- [ ] **Step 8: Commit**

```bash
git add packages/core-swift
git commit -m "feat(core-swift): SwiftPM package and conformance vector loader"
```

---

### Task 2: mod12 and the pitch-class set operations

**Files:**
- Create: `packages/core-swift/Sources/ChrometriaCore/PcSet.swift`
- Create: `packages/core-swift/Tests/ChrometriaCoreTests/PcSetTests.swift`
- Modify: `packages/core-swift/Sources/ChrometriaCore/PitchClass.swift` (already has `mod12`)

**Interfaces:**
- Consumes: `mod12(_:) -> PitchClass`, `Vectors.cases(for:)`.
- Produces: `toPcSet([Int]) -> [PitchClass]`, `transpose([PitchClass], Int) -> [PitchClass]`,
  `invert([PitchClass], Int) -> [PitchClass]`, `normalize([PitchClass]) -> [PitchClass]`,
  `complement([PitchClass]) -> [PitchClass]`, `areEqual([PitchClass], [PitchClass]) -> Bool`.

- [ ] **Step 1: Write the failing test**

`packages/core-swift/Tests/ChrometriaCoreTests/PcSetTests.swift`:

```swift
import XCTest
@testable import ChrometriaCore

final class PcSetTests: XCTestCase {
    func testMod12MatchesVectors() throws {
        for vector in try Vectors.cases(for: "mod12") {
            let input = (vector.args[0] as? NSNumber)?.intValue ?? 0
            let expected = (vector.value as? NSNumber)?.intValue
            XCTAssertEqual(mod12(input), expected, "mod12(\(input))")
        }
    }

    func testNormalizeMatchesAll4095Vectors() throws {
        let cases = try Vectors.cases(for: "normalize")
        XCTAssertEqual(cases.count, 4095, "the corpus should cover every non-empty set")
        for vector in cases {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(normalize(input), vector.intArrayValue, "normalize(\(input))")
        }
    }

    func testToPcSetMatchesVectors() throws {
        for vector in try Vectors.cases(for: "toPcSet") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(toPcSet(input), vector.intArrayValue, "toPcSet(\(input))")
        }
    }
}
```

- [ ] **Step 2: Run and watch it fail**

```bash
cd packages/core-swift && swift test
```
Expected: compile failure — `cannot find 'normalize' in scope`.

- [ ] **Step 3: Port the module**

Read `packages/core/src/pcset.ts` first; it is 55 lines and the Swift should mirror it line for line rather than being rewritten cleverly. `normalize` in particular returns the *normal form* — rotations compared for the most compact spacing — and getting it subtly wrong will fail thousands of vectors at once, which is the point.

`packages/core-swift/Sources/ChrometriaCore/PcSet.swift`:

```swift
import Foundation

/// Sorted, de-duplicated pitch classes.
public func toPcSet(_ notes: [Int]) -> [PitchClass] {
    Array(Set(notes.map(mod12))).sorted()
}

public func transpose(_ pcs: [PitchClass], _ n: Int) -> [PitchClass] {
    toPcSet(pcs.map { $0 + n })
}

public func invert(_ pcs: [PitchClass], _ axis: Int) -> [PitchClass] {
    toPcSet(pcs.map { axis - $0 })
}

public func complement(_ pcs: [PitchClass]) -> [PitchClass] {
    let present = Set(toPcSet(pcs))
    return (0..<12).filter { !present.contains($0) }
}

public func areEqual(_ a: [PitchClass], _ b: [PitchClass]) -> Bool {
    toPcSet(a) == toPcSet(b)
}

/// Normal form: the rotation that packs the set most tightly to the left.
/// Port `packages/core/src/pcset.ts` exactly — do not substitute a different
/// tie-breaking rule, the vectors encode this one.
public func normalize(_ pcs: [PitchClass]) -> [PitchClass] {
    let set = toPcSet(pcs)
    guard set.count > 1 else { return set }
    var best: [PitchClass] = []
    for i in 0..<set.count {
        let rotated = (0..<set.count).map { mod12(set[($0 + i) % set.count] - set[i]) }
        if best.isEmpty || isMoreCompact(rotated, than: best) { best = rotated }
    }
    return best
}

private func isMoreCompact(_ a: [PitchClass], than b: [PitchClass]) -> Bool {
    for i in stride(from: a.count - 1, through: 1, by: -1) where a[i] != b[i] {
        return a[i] < b[i]
    }
    return false
}
```

- [ ] **Step 4: Run and watch them pass**

```bash
cd packages/core-swift && swift test
```
Expected: all pass. If `normalize` fails, compare against `packages/core/src/pcset.ts` rather than adjusting the test — the vectors are the specification.

- [ ] **Step 5: Commit**

```bash
git add packages/core-swift
git commit -m "feat(core-swift): pitch-class set operations, green on all 4,095 vectors"
```

---

### Task 3: Interval vector, Myhill, Z-relation, maximal evenness

**Files:**
- Create: `packages/core-swift/Sources/ChrometriaCore/Intervals.swift`
- Create: `packages/core-swift/Sources/ChrometriaCore/Evenness.swift`
- Create: `packages/core-swift/Tests/ChrometriaCoreTests/IntervalsTests.swift`

**Interfaces:**
- Consumes: `toPcSet`, `mod12`, `Vectors.cases(for:)`.
- Produces: `intervalVector([PitchClass]) -> [Int]` (always 6 elements),
  `myhillProperty([PitchClass]) -> Bool`, `zRelated([PitchClass], [PitchClass]) -> Bool`,
  `isMaximallyEven([PitchClass]) -> Bool`.

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import ChrometriaCore

final class IntervalsTests: XCTestCase {
    func testIntervalVectorMatchesAll4095Vectors() throws {
        let cases = try Vectors.cases(for: "intervalVector")
        XCTAssertEqual(cases.count, 4095)
        for vector in cases {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(intervalVector(input), vector.intArrayValue, "iv(\(input))")
        }
    }

    func testMyhillPropertyMatchesVectors() throws {
        for vector in try Vectors.cases(for: "myhillProperty") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(myhillProperty(input), vector.value as? Bool, "myhill(\(input))")
        }
    }

    func testIsMaximallyEvenMatchesVectors() throws {
        for vector in try Vectors.cases(for: "isMaximallyEven") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(isMaximallyEven(input), vector.value as? Bool, "ME(\(input))")
        }
    }
}
```

- [ ] **Step 2: Run and watch it fail**

```bash
cd packages/core-swift && swift test --filter IntervalsTests
```
Expected: compile failure — `cannot find 'intervalVector' in scope`.

- [ ] **Step 3: Port the modules**

`Intervals.swift` — mirror `packages/core/src/intervals.ts`:

```swift
/// Interval-class vector: six counts, for interval classes 1 through 6.
public func intervalVector(_ pcs: [PitchClass]) -> [Int] {
    let sorted = toPcSet(pcs)
    var vec = [0, 0, 0, 0, 0, 0]
    for i in 0..<sorted.count {
        for j in (i + 1)..<sorted.count {
            let diff = mod12(sorted[j] - sorted[i])
            let ic = diff <= 6 ? diff : 12 - diff
            if ic >= 1 && ic <= 6 { vec[ic - 1] += 1 }
        }
    }
    return vec
}
```

Then port `myhillProperty` and `zRelated` from the same file, and `isMaximallyEven` from
`packages/core/src/evenness.ts`, into `Evenness.swift`.

- [ ] **Step 4: Run and watch them pass**

```bash
cd packages/core-swift && swift test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core-swift
git commit -m "feat(core-swift): interval vector, Myhill, Z-relation, maximal evenness"
```

---

### Task 4: Symmetry group analysis

**Files:**
- Create: `packages/core-swift/Sources/ChrometriaCore/Symmetry.swift`
- Create: `packages/core-swift/Tests/ChrometriaCoreTests/SymmetryTests.swift`

**Interfaces:**
- Consumes: `toPcSet`, `transpose`, `invert`, `areEqual`.
- Produces: `transpositionalStabilizer([PitchClass]) -> [PitchClass]`,
  `inversionalAxes([PitchClass]) -> [PitchClass]`, `stabilizerOrder([PitchClass]) -> Int`,
  `distinctTranspositions([PitchClass]) -> Int`, `abstractGroup([PitchClass]) -> String`.

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import ChrometriaCore

final class SymmetryTests: XCTestCase {
    func testStabilizerAndAxesMatchVectors() throws {
        for vector in try Vectors.cases(for: "transpositionalStabilizer") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(transpositionalStabilizer(input), vector.intArrayValue,
                           "stabilizer(\(input))")
        }
        for vector in try Vectors.cases(for: "inversionalAxes") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(inversionalAxes(input), vector.intArrayValue, "axes(\(input))")
        }
    }

    func testAbstractGroupMatchesVectors() throws {
        for vector in try Vectors.cases(for: "abstractGroup") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(abstractGroup(input), vector.value as? String, "group(\(input))")
        }
    }

    func testCountsMatchVectors() throws {
        for vector in try Vectors.cases(for: "stabilizerOrder") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(stabilizerOrder(input), (vector.value as? NSNumber)?.intValue)
        }
        for vector in try Vectors.cases(for: "distinctTranspositions") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(distinctTranspositions(input), (vector.value as? NSNumber)?.intValue)
        }
    }
}
```

- [ ] **Step 2: Run and watch it fail**

```bash
cd packages/core-swift && swift test --filter SymmetryTests
```
Expected: compile failure — `cannot find 'transpositionalStabilizer' in scope`.

- [ ] **Step 3: Port `packages/core/src/symmetry.ts`**

The group names in `abstractGroup` are literal strings (`"C1"`, `"C2"`, `"D6"` and so on).
Copy them exactly; a different capitalisation fails thousands of vectors.

- [ ] **Step 4: Run and watch them pass**

```bash
cd packages/core-swift && swift test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core-swift
git commit -m "feat(core-swift): symmetry group analysis"
```

---

### Task 5: Mulliken labels and character table

**Files:**
- Create: `packages/core-swift/Sources/ChrometriaCore/Mulliken.swift`
- Create: `packages/core-swift/Sources/ChrometriaCore/CharacterTable.swift`
- Create: `packages/core-swift/Tests/ChrometriaCoreTests/MullikenTests.swift`

**Interfaces:**
- Consumes: `transpositionalStabilizer`, `inversionalAxes`, `toPcSet`.
- Produces: `mullikenLabel([PitchClass]) -> String`,
  `characterTableEntry([PitchClass]) -> [String: Int]`.

**Note on the return type:** the vectors record `characterTableEntry` as an object whose
values are `1` or `-1` — for example `{"E": 1, "T6": -1, "I": -1, "R": -1}`. Model it as
`[String: Int]`, not an enum, so the comparison against the JSON is direct.

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import ChrometriaCore

final class MullikenTests: XCTestCase {
    func testMullikenLabelMatchesVectors() throws {
        for vector in try Vectors.cases(for: "mullikenLabel") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(mullikenLabel(input), vector.value as? String, "mulliken(\(input))")
        }
    }

    func testCharacterTableEntryMatchesVectors() throws {
        for vector in try Vectors.cases(for: "characterTableEntry") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            let expected = try XCTUnwrap(vector.value as? [String: Any])
                .mapValues { ($0 as? NSNumber)?.intValue ?? 0 }
            XCTAssertEqual(characterTableEntry(input), expected, "chars(\(input))")
        }
    }
}
```

- [ ] **Step 2: Run and watch it fail**

```bash
cd packages/core-swift && swift test --filter MullikenTests
```
Expected: compile failure.

- [ ] **Step 3: Port `packages/core/src/mulliken.ts` and `character-table.ts`**

Both produce literal strings and ±1 integers. Copy the label vocabulary verbatim.

- [ ] **Step 4: Run and watch them pass**

- [ ] **Step 5: Commit**

```bash
git add packages/core-swift
git commit -m "feat(core-swift): Mulliken labels and character table"
```

---

### Task 6: `classify` — the aggregate, exhaustively verified

This is the payoff task: `classify` is what the Classifier screen calls, and it composes
every function ported so far.

**Files:**
- Create: `packages/core-swift/Sources/ChrometriaCore/Modes.swift` (only `isRetrogradePalindrome`)
- Create: `packages/core-swift/Sources/ChrometriaCore/Classify.swift`
- Create: `packages/core-swift/Tests/ChrometriaCoreTests/ClassifyTests.swift`

**Interfaces:**
- Consumes: every function from Tasks 2–5.
- Produces: `struct SymmetryAnalysis: Equatable` and `classify([PitchClass]) -> SymmetryAnalysis`.

**The exact field names, from the vectors** — these are the JSON keys and must match:
`pitchClasses`, `transpositionalStabilizer`, `inversionalAxes`, `stabilizerOrder`,
`abstractGroup`, `distinctTranspositions`, `intervalVector`, `myhillProperty`,
`maximallyEven`, `mullikenLabel`, `isRetrogradePalindrome`, `characterTableEntry`.

⚠️ **Why this task carries more weight than it looks.** The standalone vectors for
`mullikenLabel`, `abstractGroup`, `characterTableEntry`, `stabilizerOrder`,
`inversionalAxes`, `transpositionalStabilizer`, `distinctTranspositions`, `myhillProperty`
and `isMaximallyEven` are only **13 cases each** — a deliberately varied sample, but a
sample. Their exhaustive coverage comes through `classify`, which runs all twelve fields
over all 4,095 sets. So this one test is what actually holds those nine functions to the
TypeScript. Compare every field; skipping one means porting that function on thirteen
examples.

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import ChrometriaCore

final class ClassifyTests: XCTestCase {
    /// Every non-empty pitch-class set, compared field by field against the
    /// TypeScript. If this passes, the analysis path is proven equivalent.
    func testClassifyMatchesAll4095Vectors() throws {
        let cases = try Vectors.cases(for: "classify")
        XCTAssertEqual(cases.count, 4095)

        var mismatches: [String] = []
        for vector in cases {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            guard let expected = vector.value as? [String: Any] else { continue }
            let actual = classify(input)

            // Compare EVERY field, not a chosen few. This test is the only
            // exhaustive coverage several of these functions get — see the note
            // below — so a field left out here is a function ported on the
            // strength of thirteen examples.
            for (key, want) in expected {
                let got = actual.field(key)
                if !sameJSON(got, want) {
                    mismatches.append("\(key) \(input): got \(String(describing: got)), want \(want)")
                }
            }
        }
        XCTAssertEqual(Array(mismatches.prefix(10)), [], "first mismatches")
        XCTAssertTrue(mismatches.isEmpty, "\(mismatches.count) field(s) disagree with TypeScript")
    }
}
```

`sameJSON` — put it beside the test, in `ClassifyTests.swift`:

```swift
/// Compare a Swift value against a value decoded from JSON.
///
/// Needed because the recorded side arrives as NSNumber/NSString/NSArray and
/// the Swift side is Int/String/[Int]. Without it every comparison fails on
/// type, not on value, and the suite becomes useless noise.
func sameJSON(_ got: Any?, _ want: Any) -> Bool {
    switch (got, want) {
    case let (g as Int, w as NSNumber):      return g == w.intValue
    case let (g as Bool, w as NSNumber):     return g == w.boolValue
    case let (g as String, w as String):     return g == w
    case let (g as [Int], w as [Any]):
        return g.count == w.count &&
            zip(g, w).allSatisfy { $0 == ($1 as? NSNumber)?.intValue }
    case let (g as [String: Int], w as [String: Any]):
        return g.count == w.count &&
            g.allSatisfy { $1 == (w[$0] as? NSNumber)?.intValue }
    default: return false
    }
}
```

- [ ] **Step 2: Run and watch it fail**

```bash
cd packages/core-swift && swift test --filter ClassifyTests
```
Expected: compile failure — `cannot find 'classify' in scope`.

- [ ] **Step 3: Implement**

```swift
public struct SymmetryAnalysis: Equatable {
    public let pitchClasses: [PitchClass]
    public let transpositionalStabilizer: [PitchClass]
    public let inversionalAxes: [PitchClass]
    public let stabilizerOrder: Int
    public let abstractGroup: String
    public let distinctTranspositions: Int
    public let intervalVector: [Int]
    public let myhillProperty: Bool
    public let maximallyEven: Bool
    public let mullikenLabel: String
    public let isRetrogradePalindrome: Bool
    public let characterTableEntry: [String: Int]
}

extension SymmetryAnalysis {
    /// Look a field up by its JSON key, so the conformance test can walk the
    /// recorded object rather than naming fields one at a time and forgetting one.
    func field(_ key: String) -> Any? {
        switch key {
        case "pitchClasses": return pitchClasses
        case "transpositionalStabilizer": return transpositionalStabilizer
        case "inversionalAxes": return inversionalAxes
        case "stabilizerOrder": return stabilizerOrder
        case "abstractGroup": return abstractGroup
        case "distinctTranspositions": return distinctTranspositions
        case "intervalVector": return intervalVector
        case "myhillProperty": return myhillProperty
        case "maximallyEven": return maximallyEven
        case "mullikenLabel": return mullikenLabel
        case "isRetrogradePalindrome": return isRetrogradePalindrome
        case "characterTableEntry": return characterTableEntry
        default: return nil   // an unknown key is a mismatch, never a pass
        }
    }
}

public func classify(_ pcs: [PitchClass]) -> SymmetryAnalysis {
    SymmetryAnalysis(
        pitchClasses: pcs,
        transpositionalStabilizer: transpositionalStabilizer(pcs),
        inversionalAxes: inversionalAxes(pcs),
        stabilizerOrder: stabilizerOrder(pcs),
        abstractGroup: abstractGroup(pcs),
        distinctTranspositions: distinctTranspositions(pcs),
        intervalVector: intervalVector(pcs),
        myhillProperty: myhillProperty(pcs),
        maximallyEven: isMaximallyEven(pcs),
        mullikenLabel: mullikenLabel(pcs),
        isRetrogradePalindrome: isRetrogradePalindrome(pcs),
        characterTableEntry: characterTableEntry(pcs)
    )
}
```

- [ ] **Step 4: Run and watch it pass**

```bash
cd packages/core-swift && swift test
```
Expected: all pass. A failure here names the first ten disagreeing sets; fix the underlying
module, not `classify`.

- [ ] **Step 5: Prove the suite can fail**

Temporarily change `intervalVector` to write `vec[6 - ic]` instead of `vec[ic - 1]` and
re-run. Expected: thousands of mismatches. Revert.

Do not skip this. A conformance suite that has never been seen failing is not evidence of
anything — and a mutation that *seems* like a change but is not (`diff <= 6` to `diff < 6`
is a no-op, because `12 - 6` is also `6`) proves nothing either.

- [ ] **Step 6: Commit**

```bash
git add packages/core-swift
git commit -m "feat(core-swift): classify matches TypeScript on all 4,095 pitch-class sets"
```

---

## What this plan deliberately leaves out

These are later plans, not omissions:

- **The remaining core modules** — chords, scales, PLR, transitions, voice-leading, contour,
  rhythm, tuning, euclidean, transform-chain, voicings, quantize, constraint-composer,
  orchestration. Same pattern, same vectors, no new risk once Task 1 exists.
- **Everything with a user interface.** Needs macOS; see the note at the top.
- **Auth, purchases, storage.** Spec §5–§8.

## Definition of done

`swift test` passes in `packages/core-swift`, and `classify` agrees with the TypeScript on
all 4,095 non-empty pitch-class sets. At that point the central claim of the port decision —
that two implementations of this mathematics can be kept in step — is demonstrated rather
than assumed, on the machine that already exists.
