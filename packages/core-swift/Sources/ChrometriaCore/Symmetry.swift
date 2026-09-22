import Foundation

/// All twelve pitch classes, 0–11. Mirrors `ALL_PITCH_CLASSES` in
/// `packages/core/src/types.ts`.
private let allPitchClasses: [PitchClass] = Array(0..<12)

/// The set of transpositions under which `pcs` is invariant.
public func transpositionalStabilizer(_ pcs: [PitchClass]) -> [PitchClass] {
    allPitchClasses.filter { areEqual(transpose(pcs, $0), pcs) }
}

/// The set of inversion axes under which `pcs` is invariant.
public func inversionalAxes(_ pcs: [PitchClass]) -> [PitchClass] {
    allPitchClasses.filter { areEqual(invert(pcs, $0), pcs) }
}

/// Total order of the symmetry stabilizer (transpositions + inversions).
public func stabilizerOrder(_ pcs: [PitchClass]) -> Int {
    transpositionalStabilizer(pcs).count + inversionalAxes(pcs).count
}

/// Number of distinct transpositions of `pcs` (12 / transpositional stabilizer size).
public func distinctTranspositions(_ pcs: [PitchClass]) -> Int {
    12 / transpositionalStabilizer(pcs).count
}

/// The abstract symmetry group of `pcs`, as a literal group-name string
/// (`"C1"`, `"C2"`, ..., `"D6"`, `"D12"`, `"Z2"`). Mirrors
/// `packages/core/src/symmetry.ts` exactly, including capitalisation —
/// these strings are compared verbatim by later ports.
public func abstractGroup(_ pcs: [PitchClass]) -> String {
    // Single pitch class (or empty set) has full dihedral symmetry D12
    if pcs.count <= 1 { return "D12" }
    let tOrder = transpositionalStabilizer(pcs).count
    let iCount = inversionalAxes(pcs).count
    if iCount > 0 {
        if tOrder == 1 { return "Z2" }
        return "D\(tOrder)"
    }
    if tOrder == 1 { return "C1" }
    return "C\(tOrder)"
}
