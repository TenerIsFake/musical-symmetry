import XCTest
@testable import ChrometriaCore

final class ModesTests: XCTestCase {
    func testIsRetrogradePalindromeMatchesVectors() throws {
        let cases = try Vectors.cases(for: "isRetrogradePalindrome")
        XCTAssertEqual(cases.count, 13)
        for vector in cases {
            let input = try XCTUnwrap(vector.intArrayArg(0))
            let expected = try XCTUnwrap(vector.value as? NSNumber).boolValue
            XCTAssertEqual(isRetrogradePalindrome(input), expected, "palindrome(\(input))")
        }
    }
}
