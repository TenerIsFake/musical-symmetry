import Foundation

/// Whether the cyclic pattern of adjacent intervals in `pcs` reads the same
/// forwards and backwards. Mirrors `packages/core/src/modes.ts`'s
/// `isRetrogradePalindrome` exactly.
///
/// Only this one function is ported here — `analyzeModes` and
/// `brightnessIndex` (also in `modes.ts`) belong to a later plan; this file
/// exists early because `mullikenLabel` and `characterTableEntry` both
/// depend on this function, matching where the TypeScript keeps it.
public func isRetrogradePalindrome(_ pcs: [PitchClass]) -> Bool {
    let sorted = toPcSet(pcs)
    guard sorted.count >= 2 else { return true }
    var intervals: [Int] = []
    for i in 0..<sorted.count {
        let curr = sorted[i]
        let next = sorted[(i + 1) % sorted.count]
        intervals.append(mod12(next - curr))
    }
    return intervals.elementsEqual(intervals.reversed())
}
