import XCTest
@testable import ChrometriaCore

final class PcSetTests: XCTestCase {
    func testMod12MatchesVectors() throws {
        for vector in try Vectors.cases(for: "mod12") {
            let input = try XCTUnwrap((vector.args[0] as? NSNumber)?.intValue)
            let expected = try XCTUnwrap((vector.value as? NSNumber)?.intValue)
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

    func testTransposeMatchesVectors() throws {
        for vector in try Vectors.cases(for: "transpose") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            let n = try XCTUnwrap((vector.args[1] as? NSNumber)?.intValue)
            XCTAssertEqual(transpose(input, n), vector.intArrayValue, "transpose(\(input), \(n))")
        }
    }

    func testInvertMatchesVectors() throws {
        for vector in try Vectors.cases(for: "invert") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            let axis = try XCTUnwrap((vector.args[1] as? NSNumber)?.intValue)
            XCTAssertEqual(invert(input, axis), vector.intArrayValue, "invert(\(input), \(axis))")
        }
    }

    func testComplementMatchesVectors() throws {
        for vector in try Vectors.cases(for: "complement") {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            XCTAssertEqual(complement(input), vector.intArrayValue, "complement(\(input))")
        }
    }

    func testAreEqualMatchesVectors() throws {
        for vector in try Vectors.cases(for: "areEqual") {
            let a = try XCTUnwrap(vector.intArrayArg(0))
            let b = try XCTUnwrap(vector.intArrayArg(1))
            let expected = try XCTUnwrap((vector.value as? NSNumber)?.boolValue)
            XCTAssertEqual(areEqual(a, b), expected, "areEqual(\(a), \(b))")
        }
    }
}
