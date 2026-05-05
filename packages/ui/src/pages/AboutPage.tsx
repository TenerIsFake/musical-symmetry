export default function AboutPage() {
  return (
    <article className="prose prose-invert prose-lg max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">About the Math</h2>
      <p className="text-gray-400 text-sm mb-8">
        A formal overview of the mathematical foundations underlying this tool.
        Intended for music theorists, mathematicians, and researchers.
      </p>

      {/* Section 1 */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">1. Pitch-Class Sets</h3>
        <p>
          We model pitch using the cyclic group <strong>Z/12Z</strong> — the integers modulo 12.
          Each element represents a pitch class: 0 = C, 1 = C♯, 2 = D, …, 11 = B. Enharmonic
          equivalence and octave equivalence are built into the structure.
        </p>
        <p>
          A <em>pitch-class set</em> (pc-set) is any subset of Z/12Z. For example, {'{'}0, 4, 7{'}'} represents
          a C major triad. There are 2¹² = 4096 possible subsets, though most analysis focuses on
          sets of cardinality 3–9.
        </p>
        <p>
          <strong>Normal form</strong> is the most compact rotation of a pc-set, determined by minimizing
          the interval from first to last element, then from first to second-to-last, and so on.
          This provides a canonical representative for each rotation class.
        </p>
        <p>
          <strong>Forte numbering</strong> (e.g., 3-11 for major/minor triads) assigns a unique label to
          each equivalence class under transposition and inversion. Allen Forte's catalog (1973)
          lists 220 distinct set classes for cardinalities 0–12.
        </p>
      </section>

      {/* Section 2 */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">2. The Dihedral Group D₁₂</h3>
        <p>
          The symmetry group acting on pitch-class space is the <strong>dihedral group D₁₂</strong>,
          the group of symmetries of a regular 12-gon. It has 24 elements:
        </p>
        <ul className="list-disc ml-6 space-y-1">
          <li>
            <strong>Transpositions Tₙ</strong> (n = 0, …, 11): Tₙ(x) = x + n mod 12.
            These form a cyclic subgroup Z₁₂ ◁ D₁₂.
          </li>
          <li>
            <strong>Inversions Iₙ</strong> (n = 0, …, 11): Iₙ(x) = n − x mod 12.
            Each is a reflection of the pitch-class clock.
          </li>
        </ul>
        <p className="mt-3">
          The group multiplication rule is: TₘTₙ = Tₘ₊ₙ, TₘIₙ = Iₘ₊ₙ, IₘTₙ = Iₘ₋ₙ, IₘIₙ = Tₘ₋ₙ
          (all subscripts mod 12).
        </p>
        <p>
          The <strong>stabilizer</strong> (or <em>symmetry group</em>) of a pc-set S is the subgroup
          Stab(S) = {'{'}g ∈ D₁₂ : g(S) = S{'}'}. The <strong>orbit</strong> of S is the set of all
          distinct images {'{'}g(S) : g ∈ D₁₂{'}'}. By the orbit-stabilizer theorem:
          |Orbit(S)| × |Stab(S)| = 24.
        </p>
      </section>

      {/* Section 3 */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">3. Classification</h3>
        <p>
          This tool computes the <strong>abstract isomorphism class</strong> of each pc-set's stabilizer.
          The algorithm:
        </p>
        <ol className="list-decimal ml-6 space-y-1">
          <li>Enumerate all 24 elements of D₁₂ and test which fix the given set.</li>
          <li>Determine the group structure of the resulting stabilizer (order, generators, relations).</li>
          <li>Match against known abstract groups by order and presentation.</li>
        </ol>
        <p className="mt-3">
          The possible stabilizer groups for subsets of Z/12Z are:
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm mt-2 border-collapse">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="pr-4 py-1 text-left">Group</th>
                <th className="pr-4 py-1 text-left">Order</th>
                <th className="pr-4 py-1 text-left">Description</th>
                <th className="py-1 text-left">Example pc-set</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr><td className="pr-4 py-0.5">C₁</td><td className="pr-4">1</td><td className="pr-4">Trivial (no symmetry)</td><td>{'{'}0, 1, 3{'}'} (3-2)</td></tr>
              <tr><td className="pr-4 py-0.5">Z₂</td><td className="pr-4">2</td><td className="pr-4">Single transposition</td><td>{'{'}0, 1, 6, 7{'}'} (4-6)</td></tr>
              <tr><td className="pr-4 py-0.5">C₂</td><td className="pr-4">2</td><td className="pr-4">Single inversion</td><td>{'{'}0, 4, 7{'}'} (3-11)</td></tr>
              <tr><td className="pr-4 py-0.5">C₃</td><td className="pr-4">3</td><td className="pr-4">Cyclic order 3 (T₄, T₈)</td><td>{'{'}0, 4, 8{'}'} augmented triad subset</td></tr>
              <tr><td className="pr-4 py-0.5">C₄</td><td className="pr-4">4</td><td className="pr-4">Cyclic order 4 (T₃, T₆, T₉)</td><td>{'{'}0, 3, 6, 9{'}'} (4-28)</td></tr>
              <tr><td className="pr-4 py-0.5">C₆</td><td className="pr-4">6</td><td className="pr-4">Cyclic order 6</td><td>{'{'}0, 2, 4, 6, 8, 10{'}'} (6-35)</td></tr>
              <tr><td className="pr-4 py-0.5">D₂</td><td className="pr-4">4</td><td className="pr-4">Klein four-group</td><td>{'{'}0, 1, 6, 7{'}'} with inversional symmetry</td></tr>
              <tr><td className="pr-4 py-0.5">D₃</td><td className="pr-4">6</td><td className="pr-4">Dihedral order 6</td><td>{'{'}0, 4, 8{'}'} (3-12, augmented triad)</td></tr>
              <tr><td className="pr-4 py-0.5">D₄</td><td className="pr-4">8</td><td className="pr-4">Dihedral order 8</td><td>{'{'}0, 3, 6, 9{'}'} (fully-diminished seventh)</td></tr>
              <tr><td className="pr-4 py-0.5">D₆</td><td className="pr-4">12</td><td className="pr-4">Dihedral order 12</td><td>{'{'}0, 2, 4, 6, 8, 10{'}'} (whole-tone scale)</td></tr>
              <tr><td className="pr-4 py-0.5">D₁₂</td><td className="pr-4">24</td><td className="pr-4">Full symmetry group</td><td>{'{'}0,1,2,3,4,5,6,7,8,9,10,11{'}'} or ∅</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          The <strong>interval vector</strong> (IC vector) of a pc-set counts the multiplicity of each
          interval class 1–6. It is invariant under the full D₁₂ action and thus constant on orbits.
          Two sets with identical interval vectors but different set classes are called <em>Z-related</em>.
        </p>
      </section>

      {/* Section 4 */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">4. Mulliken Labels</h3>
        <p>
          We borrow notation from <strong>molecular spectroscopy</strong>. In chemistry, Mulliken symbols
          (A, B, E, T, …) label the irreducible representations of point groups by their symmetry
          behavior. We apply the same formalism to pitch-class sets.
        </p>
        <p>
          The key operators forming the relevant character table are:
        </p>
        <ul className="list-disc ml-6 space-y-1">
          <li><strong>E</strong> — Identity (every set is invariant)</li>
          <li><strong>T₆</strong> — Tritone transposition (the unique order-2 transposition)</li>
          <li><strong>I</strong> — Inversion I₀ (reflection through C/F♯ axis)</li>
          <li><strong>R</strong> — Retrograde-related inversion (I₆ = T₆ ∘ I₀)</li>
        </ul>
        <p className="mt-3">
          A pc-set's behavior under these operators determines its Mulliken label. For instance, a set
          symmetric under both T₆ and I₀ receives the label <em>A₁g</em>, while one antisymmetric to
          both would be <em>B₁u</em>. The character table assigns +1 (symmetric) or −1 (antisymmetric)
          for each operator, yielding a complete classification.
        </p>
      </section>

      {/* Section 5 */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">5. Neo-Riemannian Theory</h3>
        <p>
          Neo-Riemannian theory studies transformations between triads that preserve common tones
          while minimizing voice-leading distance. The three primary operations on consonant triads are:
        </p>
        <ul className="list-disc ml-6 space-y-1">
          <li>
            <strong>P</strong> (Parallel): Preserves the fifth; moves the third by semitone.
            C major ↔ C minor.
          </li>
          <li>
            <strong>L</strong> (Leading-tone exchange): Preserves the minor third; moves one note by semitone.
            C major ↔ E minor.
          </li>
          <li>
            <strong>R</strong> (Relative): Preserves the major third; moves one note by whole tone.
            C major ↔ A minor.
          </li>
        </ul>
        <p className="mt-3">
          Each is an involution (self-inverse). Compositions generate the full PLR group, isomorphic to
          D₁₂ acting on the 24 major and minor triads.
        </p>
        <p>
          <strong>Voice-leading parsimony:</strong> P, L, and R each move exactly one voice by at most
          two semitones. This minimal motion is what makes Neo-Riemannian transformations aurally smooth.
        </p>
        <p>
          The <strong>Tonnetz</strong> is a planar graph with pitch classes at vertices, arranged so that
          the three axes represent major thirds, minor thirds, and fifths. Triads correspond to triangles.
          Topologically, the Tonnetz for Z/12Z is a torus — a quotient of the real plane by a lattice.
          P, L, and R correspond to reflections across triangle edges.
        </p>
      </section>

      {/* Section 6 */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">6. Voice-Leading Distance</h3>
        <p>
          Voice-leading distance quantifies how far apart two chords are in "voice-leading space."
          Given two pc-sets A and B of equal cardinality n, the voice-leading distance is:
        </p>
        <p className="font-mono text-sm bg-gray-800 p-3 rounded my-3">
          d(A, B) = min<sub>σ ∈ Sₙ</sub> Σᵢ |aᵢ − b<sub>σ(i)</sub>|<sub>12</sub>
        </p>
        <p>
          where |x|₁₂ = min(x mod 12, 12 − x mod 12) is the circular distance, and σ ranges over all
          permutations (voice assignments). This is the <strong>minimal voice assignment problem</strong>,
          solvable in O(n³) via the Hungarian algorithm.
        </p>
        <p>
          <strong>Generalized (unequal cardinality):</strong> When |A| ≠ |B|, we extend the smaller set
          by doubling pitches (splitting voices) or use the subset-sum formulation. The algorithm finds
          the minimum-cost injection from the smaller set into the larger, allowing voice splits and
          merges with appropriate penalties.
        </p>
        <p>
          <strong>Musical significance:</strong> Small voice-leading distance correlates with perceptual
          smoothness. Tymoczko (2011) shows that the geometry of voice-leading space — an orbifold
          T ⁿ/Sₙ — explains why certain progressions sound connected while others sound disjunct.
          Efficient voice leading is a primary compositional constraint in tonal and post-tonal music alike.
        </p>
      </section>

      {/* Section 7 */}
      <section className="mb-10">
        <h3 className="text-xl font-semibold text-indigo-300 mb-3">7. References</h3>
        <ul className="list-none space-y-3 text-sm text-gray-300">
          <li>
            Forte, Allen. <em>The Structure of Atonal Music</em>. New Haven: Yale University Press, 1973.
          </li>
          <li>
            Lewin, David. <em>Generalized Musical Intervals and Transformations</em>.
            New Haven: Yale University Press, 1987.
          </li>
          <li>
            Cohn, Richard. "Introduction to Neo-Riemannian Theory: A Survey and a Historical Perspective."
            <em>Journal of Music Theory</em> 42, no. 2 (1998): 167–180.
          </li>
          <li>
            Quinn, Ian. "General Equal-Tempered Harmony."
            <em>Perspectives of New Music</em> 44, no. 2 (2006): 6–50.
          </li>
          <li>
            Tymoczko, Dmitri. <em>A Geometry of Music: Harmony and Counterpoint in the Extended Common Practice</em>.
            New York: Oxford University Press, 2011.
          </li>
        </ul>
      </section>
    </article>
  );
}
