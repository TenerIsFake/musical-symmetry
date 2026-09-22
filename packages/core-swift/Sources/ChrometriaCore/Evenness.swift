import Foundation

/// Whether a pitch-class set is maximally even: its adjacent step sizes
/// (cyclically) take at most two distinct values, and when there are two,
/// they differ by exactly 1 semitone.
///
/// Mirrors `packages/core/src/evenness.ts` exactly, including its special
/// cases: the empty set is `false`, and a 12-note set (the full chromatic)
/// is unconditionally `true`.
public func isMaximallyEven(_ pcs: [PitchClass]) -> Bool {
    let sorted = toPcSet(pcs)
    let k = sorted.count
    if k == 0 { return false }
    if k == 12 { return true }
    var steps = [Int]()
    steps.reserveCapacity(k)
    for i in 0..<k {
        let next = sorted[(i + 1) % k]
        let curr = sorted[i]
        steps.append(((next - curr) % 12 + 12) % 12)
    }
    let uniqueSteps = Set(steps)
    if uniqueSteps.count > 2 { return false }
    if uniqueSteps.count == 1 { return true }
    let stepValues = uniqueSteps.sorted()
    return stepValues[1] - stepValues[0] == 1
}
