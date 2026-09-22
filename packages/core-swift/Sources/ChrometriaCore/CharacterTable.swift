import Foundation

/// Character-table entry (±1 per symmetry operation), mirroring
/// `packages/core/src/character-table.ts` exactly — including the operation
/// key names `"E"`, `"T6"`, `"I"`, `"R"`, which are compared verbatim against
/// recorded JSON both here and in `classify`.
public func characterTableEntry(_ pcs: [PitchClass]) -> [String: Int] {
    [
        "E": 1,
        "T6": areEqual(transpose(pcs, 6), pcs) ? 1 : -1,
        "I": inversionalAxes(pcs).isEmpty ? -1 : 1,
        "R": isRetrogradePalindrome(pcs) ? 1 : -1,
    ]
}
