import Foundation

/// Mulliken symmetry label (e.g. `"B2u"`), mirroring
/// `packages/core/src/mulliken.ts` exactly.
///
/// - Primary (`A`/`B`): whether the set is invariant under T6.
/// - Subscript (`1`/`2`): whether the set has any inversional symmetry.
/// - Parity (`g`/`u`): whether the set's adjacent-interval pattern is a
///   retrograde palindrome.
public func mullikenLabel(_ pcs: [PitchClass]) -> String {
    let t6Symmetric = areEqual(transpose(pcs, 6), pcs)
    let hasInversion = !inversionalAxes(pcs).isEmpty
    let palindrome = isRetrogradePalindrome(pcs)

    let primary = t6Symmetric ? "A" : "B"
    let subscriptChar = hasInversion ? "1" : "2"
    let parity = palindrome ? "g" : "u"

    return "\(primary)\(subscriptChar)\(parity)"
}
