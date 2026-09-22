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
