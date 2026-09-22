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
