/// A pitch class, 0–11.
public typealias PitchClass = Int

/// Euclidean modulo 12.
///
/// Swift's `%` returns a negative remainder for negative input (`-1 % 12 == -1`),
/// which the TypeScript does not. Every vector for a negative input depends on
/// this difference, so it is the first thing ported.
public func mod12(_ n: Int) -> PitchClass {
    let r = n % 12
    return r < 0 ? r + 12 : r
}
