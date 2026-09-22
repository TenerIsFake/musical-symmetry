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
            let expected = try XCTUnwrap(vector.value as? [String: Any],
                                          "classify(\(input)): recorded value did not decode as an object")
            let actual = classify(input)

            // Guards against a regenerated vector file silently dropping a
            // field: the loop below only checks keys the RECORDED object
            // carries, so if the corpus lost a key, this is the only place
            // that would notice. All 4,095 cases currently carry exactly 12.
            XCTAssertEqual(expected.count, 12,
                            "classify(\(input)): expected 12 recorded fields, got \(expected.count)")

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
