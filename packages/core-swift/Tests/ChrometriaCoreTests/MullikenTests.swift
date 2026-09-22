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
