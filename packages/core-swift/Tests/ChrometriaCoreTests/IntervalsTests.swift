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
        let cases = try Vectors.cases(for: "myhillProperty")
        XCTAssertEqual(cases.count, 13)
        for vector in cases {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            let expected = try XCTUnwrap((vector.value as? NSNumber)?.boolValue)
            XCTAssertEqual(myhillProperty(input), expected, "myhill(\(input))")
        }
    }

    func testZRelatedMatchesVectors() throws {
        let cases = try Vectors.cases(for: "zRelated")
        XCTAssertEqual(cases.count, 13)
        for vector in cases {
            let a = try XCTUnwrap(vector.intArrayArg(0))
            let b = try XCTUnwrap(vector.intArrayArg(1))
            let expected = try XCTUnwrap((vector.value as? NSNumber)?.boolValue)
            XCTAssertEqual(zRelated(a, b), expected, "zRelated(\(a), \(b))")
        }
    }

    func testIsMaximallyEvenMatchesVectors() throws {
        let cases = try Vectors.cases(for: "isMaximallyEven")
        XCTAssertEqual(cases.count, 13)
        for vector in cases {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            let expected = try XCTUnwrap((vector.value as? NSNumber)?.boolValue)
            XCTAssertEqual(isMaximallyEven(input), expected, "ME(\(input))")
        }
    }
}
