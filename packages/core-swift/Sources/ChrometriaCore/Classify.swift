import Foundation

/// The full symmetry analysis of a pitch-class set, mirroring
/// `packages/core/src/classify.ts`'s return shape exactly — the twelve
/// field names below are compared verbatim against recorded JSON keys.
public struct SymmetryAnalysis: Equatable {
    public let pitchClasses: [PitchClass]
    public let transpositionalStabilizer: [PitchClass]
    public let inversionalAxes: [PitchClass]
    public let stabilizerOrder: Int
    public let abstractGroup: String
    public let distinctTranspositions: Int
    public let intervalVector: [Int]
    public let myhillProperty: Bool
    public let maximallyEven: Bool
    public let mullikenLabel: String
    public let isRetrogradePalindrome: Bool
    public let characterTableEntry: [String: Int]
}

extension SymmetryAnalysis {
    /// Look a field up by its JSON key, so the conformance test can walk the
    /// recorded object rather than naming fields one at a time and forgetting one.
    func field(_ key: String) -> Any? {
        switch key {
        case "pitchClasses": return pitchClasses
        case "transpositionalStabilizer": return transpositionalStabilizer
        case "inversionalAxes": return inversionalAxes
        case "stabilizerOrder": return stabilizerOrder
        case "abstractGroup": return abstractGroup
        case "distinctTranspositions": return distinctTranspositions
        case "intervalVector": return intervalVector
        case "myhillProperty": return myhillProperty
        case "maximallyEven": return maximallyEven
        case "mullikenLabel": return mullikenLabel
        case "isRetrogradePalindrome": return isRetrogradePalindrome
        case "characterTableEntry": return characterTableEntry
        default: return nil   // an unknown key is a mismatch, never a pass
        }
    }
}

/// The aggregate: every symmetry-related property of a pitch-class set,
/// composed from every function ported in Tasks 2–5. Mirrors
/// `packages/core/src/classify.ts`'s `classify` exactly.
public func classify(_ pcs: [PitchClass]) -> SymmetryAnalysis {
    SymmetryAnalysis(
        pitchClasses: pcs,
        transpositionalStabilizer: transpositionalStabilizer(pcs),
        inversionalAxes: inversionalAxes(pcs),
        stabilizerOrder: stabilizerOrder(pcs),
        abstractGroup: abstractGroup(pcs),
        distinctTranspositions: distinctTranspositions(pcs),
        intervalVector: intervalVector(pcs),
        myhillProperty: myhillProperty(pcs),
        maximallyEven: isMaximallyEven(pcs),
        mullikenLabel: mullikenLabel(pcs),
        isRetrogradePalindrome: isRetrogradePalindrome(pcs),
        characterTableEntry: characterTableEntry(pcs)
    )
}
