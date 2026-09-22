import Foundation

/// Interval-class vector: six counts, for interval classes 1 through 6.
///
/// Mirrors `packages/core/src/intervals.ts` exactly.
public func intervalVector(_ pcs: [PitchClass]) -> [Int] {
    let sorted = toPcSet(pcs)
    var vec = [0, 0, 0, 0, 0, 0]
    for i in 0..<sorted.count {
        for j in (i + 1)..<sorted.count {
            let diff = mod12(sorted[j] - sorted[i])
            let ic = diff <= 6 ? diff : 12 - diff
            if ic >= 1 && ic <= 6 { vec[ic - 1] += 1 }
        }
    }
    return vec
}

/// Myhill's property: every generic interval maps to exactly two distinct
/// specific (semitone) intervals.
///
/// Mirrors `packages/core/src/intervals.ts` exactly, including that a set of
/// fewer than 2 pitch classes is defined as `false` rather than vacuously true.
public func myhillProperty(_ pcs: [PitchClass]) -> Bool {
    let sorted = toPcSet(pcs)
    let n = sorted.count
    if n < 2 { return false }
    for genericInterval in 1..<n {
        var specificSizes = Set<Int>()
        for i in 0..<n {
            let j = (i + genericInterval) % n
            let diff = mod12(sorted[j] - sorted[i])
            specificSizes.insert(diff)
        }
        if specificSizes.count != 2 { return false }
    }
    return true
}

/// Two sets are Z-related if they share an interval vector but are not
/// related by transposition or inversion.
///
/// Mirrors `packages/core/src/intervals.ts` exactly.
public func zRelated(_ a: [PitchClass], _ b: [PitchClass]) -> Bool {
    let va = intervalVector(a)
    let vb = intervalVector(b)
    if va != vb { return false }
    let sa = toPcSet(a)
    let sb = toPcSet(b)
    if sa.count != sb.count { return false }
    for n in 0..<12 {
        let transposed = toPcSet(sa.map { $0 + n })
        if transposed.count == sb.count && transposed == sb { return false }
        let inverted = toPcSet(sa.map { n - $0 })
        if inverted.count == sb.count && inverted == sb { return false }
    }
    return true
}
