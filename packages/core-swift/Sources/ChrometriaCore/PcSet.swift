import Foundation

/// Sorted, de-duplicated pitch classes.
public func toPcSet(_ notes: [Int]) -> [PitchClass] {
    Array(Set(notes.map(mod12))).sorted()
}

public func transpose(_ pcs: [PitchClass], _ n: Int) -> [PitchClass] {
    toPcSet(pcs.map { $0 + n })
}

public func invert(_ pcs: [PitchClass], _ axis: Int) -> [PitchClass] {
    toPcSet(pcs.map { axis - $0 })
}

/// Normal form: of all rotations of the sorted set (including the identity
/// rotation), the one with the smallest span from its first to last element,
/// tie-broken by ordinary lexicographic comparison.
///
/// This mirrors `packages/core/src/pcset.ts` exactly, including its quirk
/// that the winning rotation is NOT necessarily transposed to start at 0 —
/// the untransposed `sorted` array is itself a candidate (the implicit i=0
/// case) and can win. Do not "fix" that; the vectors encode it.
public func normalize(_ pcs: [PitchClass]) -> [PitchClass] {
    let sorted = toPcSet(pcs)
    guard sorted.count > 1 else { return sorted }
    var best = sorted
    var bestSpan = mod12(sorted[sorted.count - 1] - sorted[0])
    for i in 1..<sorted.count {
        let pivot = sorted[i]
        let rotated = toPcSet(sorted.map { $0 - pivot })
        let span = mod12(rotated[rotated.count - 1] - rotated[0])
        if span < bestSpan || (span == bestSpan && lexLess(rotated, best)) {
            best = rotated
            bestSpan = span
        }
    }
    return best
}

private func lexLess(_ a: [PitchClass], _ b: [PitchClass]) -> Bool {
    for i in 0..<a.count {
        if a[i] < b[i] { return true }
        if a[i] > b[i] { return false }
    }
    return false
}

public func complement(_ pcs: [PitchClass]) -> [PitchClass] {
    let present = Set(toPcSet(pcs))
    return (0..<12).filter { !present.contains($0) }
}

public func areEqual(_ a: [PitchClass], _ b: [PitchClass]) -> Bool {
    toPcSet(a) == toPcSet(b)
}
