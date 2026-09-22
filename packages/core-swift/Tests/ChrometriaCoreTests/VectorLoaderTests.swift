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
