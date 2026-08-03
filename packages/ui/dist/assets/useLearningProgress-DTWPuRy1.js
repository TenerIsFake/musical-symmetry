import{r as t}from"./index-C8tS4unP.js";import{A as r}from"./main-D7j2zPlZ.js";const y="intro-set-theory",f="Introduction to Pitch-Class Set Theory",g="Learn how mathematicians and theorists classify musical collections using sets, transposition, inversion, and symmetry groups.",b="🎵",v=[{id:"pitch-classes",title:"What is a Pitch Class?",content:`## What is a Pitch Class?

In Western music, we recognize twelve distinct pitches before the pattern repeats at the octave: C, C#, D, D#, E, F, F#, G, G#, A, A#, B. A **pitch class** is one of these twelve categories — independent of which octave the note actually sounds in.

The key insight is **octave equivalence**: we treat middle C, high C, and low C as the same pitch class because they share the same *quality* in the musical context. This allows us to strip away register and focus purely on harmonic content.

We number pitch classes 0 through 11, using **mod-12 arithmetic** — the same kind of arithmetic that governs a clock face. C = 0, C# = 1, D = 2, and so on up to B = 11. Addition wraps around: pitch class 9 (A) plus 5 semitones = 14 mod 12 = 2 (D). This is sometimes called **clock arithmetic** because of the analogy with hours on a clock.

This numbering system makes it possible to describe musical relationships with precision. The interval between any two pitch classes is just their difference mod 12. The major third from C to E is 4 − 0 = 4 semitones. The minor seventh from D to C is (0 + 12) − 2 = 10 semitones.

Pitch-class notation lets us talk about musical objects — chords, scales, motives — in a register-neutral way. A C major chord and a C major chord two octaves higher are the same **pitch-class set**: {0, 4, 7}.`,task:{description:"Classify {0, 4, 7} in the Classifier to see its symmetry group and Forte name.",link:"#classifier?pcs=0,4,7"},quiz:{question:"Which of the following correctly applies mod-12 arithmetic to pitch classes?",options:["Pitch class 11 + 3 = 14","Pitch class 11 + 3 = 2","Pitch class 11 + 3 = 1","Pitch class 11 + 3 = 15"],correctIndex:1,explanation:"14 mod 12 = 2. In pitch-class arithmetic, we always reduce sums modulo 12, so 11 + 3 = 14 ≡ 2 (mod 12), which corresponds to pitch class D."}},{id:"pitch-class-sets",title:"Pitch-Class Sets",content:`## Pitch-Class Sets

A **pitch-class set** (or pc set) is simply an unordered collection of pitch classes drawn from the twelve pitch classes {0, 1, 2, ..., 11}. The word *unordered* is crucial: {0, 4, 7} is the same set as {4, 7, 0} or {7, 0, 4}. We don't care about melodic ordering, only about which pitch classes appear.

Sets can have any cardinality from 0 to 12. A single note is a set of cardinality 1 (a *monad*). A dyad has 2 elements; a trichord has 3; a tetrachord has 4, and so on up to the 12-tone aggregate. The most theoretically interesting sets are often in the 3–6 element range.

We write sets using curly braces with members separated by commas: {0, 1, 6} is a trichord containing C, C#, and F#. Note that pitch class 10 is sometimes written as 'T' (for ten) and 11 as 'E' (for eleven) to keep notation compact: {0, T, E} instead of {0, 10, 11}.

Sets are described as **transpositionally** and **inversionally** equivalent when one can be transformed into the other by these operations. Sets in the same equivalence class share the same intervallic fingerprint. Allen Forte catalogued all such equivalence classes in his 1973 book *The Structure of Atonal Music*, producing 224 distinct **set classes**.

Chrometria lets you input any set and instantly see which Forte set class it belongs to, its symmetry group, its interval vector, and more. The mathematical structure underlying these sets turns out to be surprisingly rich and connects to group theory, chemistry, and crystallography.`,task:{description:"Try classifying {0, 1, 6} in the Classifier to see what set class it belongs to.",link:"#classifier?pcs=0,1,6"},quiz:{question:"Which of the following statements about pitch-class sets is TRUE?",options:["{0, 4, 7} and {4, 7, 0} are different sets because order matters","{0, 4, 7} and {4, 7, 0} are the same set because order is irrelevant","Pitch-class sets must always contain exactly three elements","Pitch classes range from 0 to 12, giving 13 possible values"],correctIndex:1,explanation:"Pitch-class sets are unordered collections, so {0, 4, 7} and {4, 7, 0} are the same set. Sets can have any cardinality from 0 to 12, and pitch classes range from 0 to 11 (12 total values, using mod-12 arithmetic)."}},{id:"transposition",title:"Transposition",content:`## Transposition

Musicians transpose a melody or chord by shifting every note up or down by a fixed number of semitones. In pitch-class arithmetic, this is the **T_n operation** (read "transposition by n"). Applied to a set S, it produces a new set where every element x is replaced by x + n (mod 12).

For example, transposing {0, 4, 7} (C major) by T_5 (up a perfect fourth):
- 0 + 5 = 5 (F)
- 4 + 5 = 9 (A)
- 7 + 5 = 0 (C, since 12 mod 12 = 0)

The result is {5, 9, 0}, which is F major — exactly what we'd expect when transposing C major up a fourth.

Transpositions form a **group** under composition (more on groups in the Symmetry Groups path). There are 12 distinct transpositions: T_0 (the identity, which changes nothing), T_1 through T_11. Applying T_n and then T_m gives T_{(n+m) mod 12}.

Two sets are **transpositionally equivalent** if one can be obtained from the other by some T_n. All 12 major triads — C, C#, D, D#... — are transpositionally equivalent. They all belong to the same Forte set class 3-11.

Transposition is perhaps the most intuitive transformation in music, but it's only one half of the story. When we add inversion, we get the full dihedral group that governs pitch-class set equivalence.`,task:{description:"Classify both {0, 4, 7} (C major) and {2, 6, 9} (D major) to confirm they share the same Forte name.",link:"#compare"},quiz:{question:"What is T_7 applied to pitch class 8 (Ab)?",options:["Pitch class 1 (Db)","Pitch class 3 (Eb)","Pitch class 15","Pitch class 1 (Db) — same as T_7(8) = 15 mod 12 = 3"],correctIndex:1,explanation:"T_7(8) = 8 + 7 = 15. Then 15 mod 12 = 3, which is pitch class Eb. Transposition always reduces mod 12 to stay within the range 0–11."}},{id:"inversion",title:"Inversion",content:`## Inversion

Inversion is the second fundamental operation in pitch-class set theory. The **I_n operation** (inversion about the axis n) maps each pitch class x to n − x (mod 12). The simplest case, I_0, maps x to −x mod 12, effectively "flipping" the set around pitch class 0.

Applied to {0, 4, 7}:
- I_0(0) = 0 − 0 = 0
- I_0(4) = 0 − 4 = −4 ≡ 8 (mod 12)
- I_0(7) = 0 − 7 = −7 ≡ 5 (mod 12)

Result: {0, 5, 8}, which is Ab major — the inversion of C major about C.

More generally, I_n(x) = n − x (mod 12). So I_7 maps x to 7 − x. Applied to {0, 4, 7}: we get {7, 3, 0} = {0, 3, 7}, which is C minor. Major and minor triads are inversionally related to each other — that's why they sound so similar!

Two sets are **inversionally equivalent** if one can be obtained from the other by some I_n. Together, the 12 transpositions and 12 inversions make 24 operations in the **dihedral group** D_12 (also written Dih(12)). This group is what Forte used to define set-class equivalence.

The relationship between major and minor is one of the most beautiful facts in tonal harmony: the two most common chord types in Western music are inversional mirrors of each other. This is not a coincidence — it's a consequence of the group structure underlying pitch-class space.`,task:{description:"Classify {0, 3, 7} (C minor) and compare it with {0, 4, 7} (C major) to confirm they share the Forte name 3-11.",link:"#classifier?pcs=0,3,7"},quiz:{question:"Which operation maps {0, 4, 7} to {0, 3, 7} (C major to C minor)?",options:["T_3 (transposition by 3)","I_7 (inversion about 7)","T_7 (transposition by 7)","I_3 (inversion about 3)"],correctIndex:1,explanation:"I_7(0) = 7, I_7(4) = 3, I_7(7) = 0 → {7, 3, 0} = {0, 3, 7}. Inversion about 7 maps C major to C minor, confirming they are inversionally equivalent."}},{id:"normal-prime-form",title:"Normal Form and Prime Form",content:`## Normal Form and Prime Form

With 12 transpositions and 12 inversions available, any pitch-class set has up to 24 different representations. To make comparison practical, theorists developed **canonical forms** that give each set class a unique, standardized representation.

**Normal form** is the most compact arrangement of a set within an octave, with the smallest possible span from first to last element. The algorithm packs the set into the smallest containing interval, then left-justifies among ties (prioritizing the smallest intervals earlier). For example, {7, 0, 4} in normal form is [0, 4, 7] — we rotate to start with the smallest gap at the top.

**Prime form** goes further: it's the normal form of either the set or its inversion, whichever is more compact, then transposed to start on 0. This gives each set class a single, unique label. The major triad {0, 4, 7} and all 24 of its transpositional and inversional relatives have prime form (0,4,7). The minor triad {0,3,7} also has prime form (0,3,7) — wait, isn't that different? Actually, both major and minor triads share the same prime form: Forte compares the inversion too, and (0,3,7) is more compact than (0,4,7) when you measure from the opposite end, so the prime form ends up being (0,3,7).

Forte labeled each set class with a code like **3-11**, where the first number is the cardinality (3 notes) and the second is an index within that cardinality. The major and minor triads are 3-11 — one of 12 distinct trichord classes.

Chrometria's Atlas gives you instant access to all 224 set classes with their prime forms, Forte numbers, and symmetry groups. Prime form is the key that unlocks any entry.`,task:{description:"Look up set class 3-11 in the Atlas to see its prime form, interval vector, and symmetry properties.",link:"#atlas/3-11"},quiz:{question:"What is the purpose of prime form in pitch-class set theory?",options:["To specify the exact octave register of each pitch","To give each set class a unique canonical representative for easy comparison","To determine the tempo and meter of a musical passage","To indicate which instrument should play which note"],correctIndex:1,explanation:"Prime form gives each set class a unique, standardized representation independent of transposition and inversion. This makes it possible to determine whether two apparently different sets actually belong to the same class by reducing both to their prime forms and comparing."}},{id:"interval-vectors",title:"Interval Vectors",content:`## Interval Vectors

The **interval vector** (also called the interval-class vector or ICV) is a six-digit tally that counts how many times each interval class appears in a set. Interval classes 1 through 6 correspond to the six types of intervals possible between two distinct pitch classes (we don't count 0, and classes 7–11 duplicate 1–5 by inversion symmetry):

- IC 1: minor second / major seventh (1 or 11 semitones)
- IC 2: major second / minor seventh (2 or 10 semitones)
- IC 3: minor third / major sixth (3 or 9 semitones)
- IC 4: major third / minor sixth (4 or 8 semitones)
- IC 5: perfect fourth / perfect fifth (5 or 7 semitones)
- IC 6: tritone (6 semitones — only one, since its inversion is itself)

For the major triad {0, 4, 7}, we compute all pairs:
- 0 and 4: difference 4 → IC 4
- 0 and 7: difference 7 → IC 5 (since 12−7=5)
- 4 and 7: difference 3 → IC 3

The interval vector is written \`[001110]\` — one IC3, one IC4, one IC5, zeros elsewhere.

The interval vector is a powerful fingerprint. Two sets with the same interval vector are not necessarily the same set class — this rare phenomenon is called **Z-relation** (Forte used Z to label such pairs). But in practice, the interval vector captures most of the sonic character of a set. Sets rich in IC5 (perfect fourths/fifths) tend to sound open and resonant; sets heavy in IC1 sound dissonant and tense.

Comparing vectors is one of the fastest ways to understand why two sets sound similar or different. The major and minor triads share the same vector — further evidence of their deep relationship.`,task:{description:"Compare the interval vectors of the major triad {0,4,7} and minor triad {0,3,7} in the Classifier to confirm they match.",link:"#classifier?pcs=0,4,7"},quiz:{question:"What does it mean when two pitch-class sets are Z-related?",options:["They are transpositionally equivalent","They have identical interval vectors but belong to different set classes","They are inversionally equivalent","They share the same prime form"],correctIndex:1,explanation:"Z-related sets share the same interval vector (same ic-content) but cannot be mapped onto each other by any combination of transposition and inversion. They sound similar but are structurally distinct. Forte named them with a Z prefix, such as 4-Z15 and 4-Z29."}},{id:"forte-catalog",title:"The Forte Catalog",content:`## The Forte Catalog

In 1973, music theorist **Allen Forte** published *The Structure of Atonal Music*, which contained a complete enumeration of all pitch-class set classes. His catalog lists **224 distinct set classes**, organized by cardinality from 1 to 12 (with 0 and 12 being trivial cases).

Forte's numbering system assigns each set class a code of the form **N-k**, where N is the cardinality and k is a sequential index. For instance:
- 3-1 is the chromatic trichord {0,1,2}
- 3-11 is the consonant triad {0,3,7} or {0,4,7}
- 3-12 is the augmented triad {0,4,8}

The index k has no deep mathematical meaning — it's mostly in order of prime form. But some numbers are marked with **Z** (e.g., 4-Z15, 4-Z29) to indicate Z-related pairs that share an interval vector.

The most theoretically significant set classes often have special names: the whole-tone scale (6-35), the octatonic scale (8-28), the hexatonic scale (6-20), the acoustic scale (7-34). Forte's catalog gives theorists a shared vocabulary for discussing any collection of pitches, whether it appears in Webern, jazz, or folk music.

By the 1980s, set theory had become a core analytical tool in musicology departments. Critics noted that it could be applied mechanically without musical insight, but as a *descriptive* tool for identifying structural relationships, Forte's catalog remains indispensable.

Chrometria's Atlas presents all 224 set classes with full data: prime form, interval vector, Forte name, symmetry group under the dihedral group D_12, and the unique Chrometria analysis of symmetry subgroup structure. The Atlas is searchable by Forte name, cardinality, or interval content.`,task:{description:"Explore the Atlas to browse the full catalog of 224 set classes sorted by symmetry group.",link:"#atlas"},quiz:{question:"How many distinct pitch-class set classes did Forte catalog in 1973?",options:["144","192","224","256"],correctIndex:2,explanation:"Allen Forte's 1973 catalog lists 224 distinct set classes, ranging from cardinality 1 through 12 and defined by equivalence under transposition and inversion. This number accounts for all possible pitch-class collections up to the symmetries of the dihedral group D_12."}},{id:"symmetry-groups",title:"Symmetry Groups",content:`## Symmetry Groups

Most pitch-class set theory stops at Forte's classification: prime form and interval vectors suffice for most analytical tasks. But Chrometria goes further by asking: what is the **symmetry group** of each set class?

A set's symmetry group consists of all the operations in D_12 (the 24 transpositions and inversions) that map the set *to itself*. Most sets have only the trivial symmetry — no operation except the identity leaves them unchanged. But special sets have larger symmetry groups.

The whole-tone scale {0,2,4,6,8,10} is fixed by T_2, T_4, T_6, T_8, T_10, and T_0 — six transpositions — giving it a cyclic symmetry group of order 6. The augmented triad {0,4,8} is fixed by T_4 and T_8 — it has three-fold symmetry. The diminished seventh chord {0,3,6,9} has four-fold symmetry.

Chrometria classifies these symmetry groups using **Mulliken labels** borrowed from molecular spectroscopy — the same notation chemists use for molecular orbitals. This cross-disciplinary connection reveals that the mathematics of musical symmetry is identical to the mathematics of molecular point groups: both describe the symmetries of objects in a cyclic space.

Sets with larger symmetry groups are called **maximally even** when they are as evenly spaced as possible around the pitch-class clock. The whole-tone scale and augmented triad are maximally even. These sets play special roles in tonal and post-tonal music because of their high symmetry.

By understanding the symmetry group of a set, you gain insight into why certain chord progressions feel inevitable, why the whole-tone scale sounds so dreamy and unmoored, and why the tritone creates such powerful tension. Symmetry is the hidden geometry of music.`,task:{description:"Search the Atlas for maximally even sets and explore their symmetry groups.",link:"#search"},quiz:{question:"What is a maximally even set in pitch-class set theory?",options:["A set that contains all 12 pitch classes","A set whose elements are as evenly distributed as possible around the pitch-class clock","A set with an interval vector of all equal values","A set that is its own inversion"],correctIndex:1,explanation:"A maximally even set distributes its elements as evenly as possible around the 12-element pitch-class clock. Examples include the whole-tone scale (6 notes, each 2 semitones apart), augmented triad (3 notes, 4 semitones apart), and the diminished seventh chord (4 notes, 3 semitones apart). These sets have the largest possible symmetry groups."}}],T={id:y,title:f,description:g,icon:b,lessons:v},w="symmetry-groups",_="Symmetry Groups in Music",x="Discover the deep mathematical structure of musical symmetry using group theory — from cyclic groups to Mulliken labels borrowed from chemistry.",C="🔬",k=[{id:"what-is-a-group",title:"What is a Group?",content:`## What is a Group?

A **group** is one of the most fundamental objects in abstract algebra. A group consists of a set G together with an operation * that satisfies four properties:

1. **Closure**: For any two elements a, b in G, the result a * b is also in G.
2. **Associativity**: For any a, b, c in G, (a * b) * c = a * (b * c).
3. **Identity**: There exists an element e in G such that a * e = e * a = a for all a.
4. **Inverses**: For every a in G, there exists an element a⁻¹ such that a * a⁻¹ = a⁻¹ * a = e.

Groups appear throughout mathematics and science wherever there is symmetry. The rotations of a square form a group; the permutations of three objects form a group; the integers under addition form a group. What makes groups powerful is that the same abstract structure can describe completely different-seeming phenomena.

In music, the twelve transpositions of pitch-class space form a group under composition. Applying T_3 then T_5 is the same as applying T_8, because (3 + 5) mod 12 = 8. The identity is T_0 (doing nothing). The inverse of T_n is T_{12−n}, which undoes the transposition.

Group theory provides the language for describing *exactly* what makes two musical structures equivalent and what transformations preserve their identity. It's the mathematical backbone of Chrometria's analysis engine.`,task:{description:"Explore the Classifier and observe how different transpositions of {0, 4, 7} all share the same Forte name.",link:"#classifier?pcs=0,4,7"},quiz:{question:"Which of the four group axioms ensures that you can always 'undo' an operation?",options:["Closure","Associativity","Identity","Inverses"],correctIndex:3,explanation:"The Inverses axiom guarantees that for every element a in the group, there is an element a⁻¹ that 'undoes' a. In pitch-class transpositions, the inverse of T_n is T_{12−n}: applying T_5 and then T_7 brings you back to where you started, because 5 + 7 = 12 ≡ 0 (mod 12)."}},{id:"cyclic-group-z12",title:"The Cyclic Group Z₁₂",content:`## The Cyclic Group Z₁₂

The twelve transpositions T_0, T_1, ..., T_11 form the **cyclic group Z₁₂** (also written C₁₂ or ℤ/12ℤ). This is one of the most important groups in music theory.

A cyclic group is generated by a single element g, called the **generator**, such that every group element can be written as a power of g: g, g², g³, ... For Z₁₂, the generator is T_1. Applying T_1 twelve times returns to the identity: T_1^12 = T_0.

Z₁₂ is **abelian** — the order of operations doesn't matter: T_3 * T_5 = T_5 * T_3 (both equal T_8). This commutativity is a consequence of the additive nature of transpositions in mod-12 arithmetic.

The subgroups of Z₁₂ correspond to divisors of 12: there are subgroups of order 1, 2, 3, 4, 6, and 12. These subgroups correspond to musically meaningful interval cycles:
- Order 2: {T_0, T_6} — tritone subdivision
- Order 3: {T_0, T_4, T_8} — augmented triad cycle
- Order 4: {T_0, T_3, T_6, T_9} — diminished seventh cycle
- Order 6: {T_0, T_2, T_4, T_6, T_8, T_10} — whole-tone cycle
- Order 12: all of Z₁₂ — chromatic cycle

The subgroup structure of Z₁₂ explains why certain harmonies — augmented, diminished, whole-tone — have special symmetric properties. Each subgroup is the **stabilizer** of some maximally symmetric set.`,task:{description:"Explore the Interval Cycles page to visualize the cyclic subgroups of Z₁₂.",link:"#cycles"},quiz:{question:"Which interval cycle corresponds to the subgroup of Z₁₂ with order 4?",options:["The whole-tone cycle (0, 2, 4, 6, 8, 10)","The augmented triad cycle (0, 4, 8)","The tritone cycle (0, 6)","The diminished seventh cycle (0, 3, 6, 9)"],correctIndex:3,explanation:"The diminished seventh cycle {0, 3, 6, 9} corresponds to the order-4 subgroup {T_0, T_3, T_6, T_9} of Z₁₂. Applying T_3 four times returns to the start: 0 → 3 → 6 → 9 → 0 (mod 12)."}},{id:"dihedral-group-d12",title:"The Dihedral Group D₁₂",content:`## The Dihedral Group D₁₂

When we add the 12 inversion operations I_0 through I_11 to the 12 transpositions, we get a larger group called the **dihedral group D₁₂** (or Dih₁₂), which has order 24.

The dihedral group Dih_n is familiar from geometry: it's the symmetry group of a regular n-gon, consisting of n rotations and n reflections. For music, we think of the 12 pitch classes arranged in a circle (the pitch-class clock), with rotations corresponding to transpositions and reflections to inversions.

D₁₂ is **not abelian**. The order of transpositions and inversions matters: T_3 * I_5 ≠ I_5 * T_3 in general. Specifically, if you transpose and then invert: I_n * T_k = I_{n+k}. If you invert then transpose: T_k * I_n = I_{n−k}. This non-commutativity reflects the asymmetry between the two types of operations.

Allen Forte used D₁₂ to define set-class equivalence: two sets are in the same class if and only if one can be mapped to the other by some element of D₁₂. The 24 elements of D₁₂ create orbits — **equivalence classes** — among all possible pitch-class sets. Instead of 2^12 = 4096 subsets, we get only 224 distinct set classes.

For each set class, its **symmetry group** (or stabilizer) is the subgroup of D₁₂ that maps the set to itself. Most sets have trivial stabilizer {T_0}, meaning no non-identity operation fixes the set. Special sets have larger stabilizers, and these are precisely the sets that sound most 'symmetric' to the ear.`,task:{description:"Compare two different inversions of {0, 4, 7} in the Classifier and confirm they share the same Forte name.",link:"#classifier?pcs=0,3,7"},quiz:{question:"How many elements does the dihedral group D₁₂ contain?",options:["12 (one for each pitch class)","24 (12 transpositions + 12 inversions)","48 (all possible pitch-class mappings)","144 (12 × 12)"],correctIndex:1,explanation:"D₁₂ contains 24 elements: 12 transpositions T_0 through T_11 and 12 inversions I_0 through I_11. Forte used these 24 operations to define set-class equivalence, reducing 4096 possible sets to 224 distinct set classes."}},{id:"stabilizers-orbits",title:"Stabilizers and Orbits",content:`## Stabilizers and Orbits

Two of the most important concepts in group theory applied to music are **stabilizers** (or stabilizer subgroups) and **orbits**.

Given a group G acting on a set X, and an element x in X:
- The **orbit** of x is the collection of all elements G can send x to: {g(x) : g ∈ G}. All elements in the same orbit are equivalent under the group action.
- The **stabilizer** (or stabilizer subgroup) of x is the set of all g ∈ G that fix x: {g ∈ G : g(x) = x}. The stabilizer measures how symmetric x is — a larger stabilizer means more symmetry.

The **orbit-stabilizer theorem** is a beautiful result: |G| = |Orbit(x)| × |Stabilizer(x)|. The size of the group equals the size of the orbit times the size of the stabilizer. For D₁₂ with |G| = 24:
- A set with trivial stabilizer (order 1) has an orbit of size 24 — 24 different transpositions/inversions, all distinct.
- The augmented triad {0,4,8} has stabilizer {T_0, T_4, T_8}, order 3, so its orbit has size 24/3 = 8. There are only 4 distinct augmented triads (since two are related by inversion too).

In Chrometria's Atlas, the symmetry group shown for each set class *is* the stabilizer of that set. Set classes with larger stabilizers are rarer and more symmetric. The maximally symmetric sets — whole-tone scale, aggregate — have the largest stabilizers.

The stabilizer structure also tells you how many distinct forms a set has: a set with a stabilizer of order k appears in 24/k distinct forms. The major/minor triad has stabilizer order 2 (just the identity and one inversion that maps major to minor), giving 24/2 = 12 forms — corresponding to the 12 major and 12 minor triads (24 forms, but they come in major/minor pairs).`,task:{description:"Look up the augmented triad 3-12 in the Atlas and note its symmetry group order.",link:"#atlas/3-12"},quiz:{question:"According to the orbit-stabilizer theorem, if a set has a stabilizer of order 4 in D₁₂ (|D₁₂| = 24), how many distinct forms does it have?",options:["4","6","12","24"],correctIndex:1,explanation:"By the orbit-stabilizer theorem, |orbit| = |G| / |stabilizer| = 24 / 4 = 6. A set with stabilizer order 4 appears in exactly 6 distinct forms under the action of D₁₂. The diminished seventh chord is an example: it has only 3 distinct forms despite having 4 pitch classes, because its high symmetry collapses many transpositions to the same set."}},{id:"mulliken-labels",title:"Mulliken Labels",content:`## Mulliken Labels

Chrometria labels the symmetry groups of pitch-class sets using **Mulliken symbols** — a notation system originally developed by physicist Robert S. Mulliken in the 1930s to classify molecular orbitals and vibrational modes in chemistry.

Mulliken symbols describe the **irreducible representations** of symmetry groups. In chemistry, these describe how atomic orbitals transform under the symmetry operations of a molecule. Chrometria borrows this notation because the underlying mathematics is identical: both domains are classifying objects by how they transform under a group.

The main Mulliken labels you'll encounter in Chrometria:
- **A** (non-degenerate, symmetric): The set is symmetric under all operations in its stabilizer. For pitch-class sets, this means the set maps to itself under the relevant transpositions and inversions.
- **B** (non-degenerate, antisymmetric): The set changes sign under some operations — not directly applicable to pitch-class sets in the usual sense, but used by Chrometria for certain representations.
- **E** (doubly degenerate): Corresponds to pairs of operations that form 2D representations. The E label appears for sets related to two-fold degeneracy.
- **T** (triply degenerate): Three-fold degeneracy, corresponding to the 3D representations of octahedral groups.

Subscripts and superscripts refine the label: subscript g (gerade) and u (ungerade) indicate behavior under inversion; primes indicate behavior under horizontal reflection planes.

By mapping musical symmetry groups to Mulliken labels, Chrometria connects music theory to an entire century of work in molecular spectroscopy. The character tables used by chemists to analyze molecules apply directly to pitch-class sets.`,task:{description:"Browse the Atlas and look at the Mulliken labels for several set classes to see the range of symmetry types.",link:"#atlas"},quiz:{question:"Mulliken labels were originally developed for which field before being applied to music theory?",options:["Crystallography","Quantum mechanics and molecular orbital theory","Topology","Number theory"],correctIndex:1,explanation:"Robert S. Mulliken developed Mulliken symbols in the 1930s to describe irreducible representations of symmetry groups in molecular orbital theory and quantum mechanics. Chrometria borrows this notation because the mathematical structure — group representations — is identical when applied to pitch-class sets."}},{id:"character-tables",title:"Character Tables",content:`## Character Tables

A **character table** is the complete summary of a group's irreducible representations. For each symmetry group, the character table lists all conjugacy classes (types of symmetry operations) across the top and all irreducible representations (Mulliken labels) down the side. The entries are **characters** — the traces of the representation matrices.

For the cyclic group C₃ (relevant for augmented triads and some 3-fold symmetric sets):

| C₃ | E | C₃ | C₃² |
|----|---|----|------|
| A  | 1 | 1  | 1    |
| E  | 2 | -1 | -1   |

The 'E' row shows the 2D irreducible representation, with character 2 for the identity, -1 for each rotation. These numbers encode how functions (or, in music, pitch-class sets) transform under each symmetry operation.

**Why does this matter for music?** The character table determines which intervals and harmonies are possible within a given symmetry class. It predicts which transformations will sound 'smooth' (preserving the same representation) versus 'jarring' (mixing representations). This is directly analogous to selection rules in spectroscopy — some transitions are allowed, others forbidden by symmetry.

Chrometria uses character tables to compute the full symmetry classification of each pitch-class set. When you see a Mulliken label in the Atlas, it's telling you exactly which row of the relevant character table that set belongs to — and therefore, precisely how it transforms under every operation in its symmetry group.

This is Chrometria's unique contribution: taking the 50-year-old Forte catalog and lifting it to a richer description that connects music to the same mathematics used to understand molecular spectra, crystal lattices, and quantum mechanics.`,task:{description:"Find a set with high symmetry in the Atlas and explore its character table entry via the detail page.",link:"#atlas"},quiz:{question:"What information does a character table encode about a symmetry group?",options:["The tempo and meter of compositions that use the group","The traces of representation matrices for each conjugacy class and irreducible representation","The MIDI note numbers for each pitch class","The historical timeline of who discovered each symmetry group"],correctIndex:1,explanation:"A character table encodes the **characters** (matrix traces) of each irreducible representation (Mulliken label) evaluated on each conjugacy class of symmetry operations. This completely characterizes all the group's representations and determines how objects — whether molecular orbitals or pitch-class sets — transform under the group's symmetry operations."}}],I={id:w,title:_,description:x,icon:C,lessons:k},A=[T,I];function F(c){const[m,o]=t.useState(new Set),[d,l]=t.useState(!1),n=t.useCallback(async()=>{if(c){l(!0);try{const e=await fetch(`${r}/api/learning/progress`,{credentials:"include"});if(e.ok){const s=await e.json();o(new Set(s.progress.map(i=>`${i.path_id}/${i.lesson_id}`)))}}catch{}finally{l(!1)}}},[c]);t.useEffect(()=>{n()},[n]);const p=t.useCallback(async(e,s)=>{try{(await fetch(`${r}/api/learning/progress/${e}/${s}/complete`,{method:"POST",credentials:"include"})).ok&&o(a=>new Set([...a,`${e}/${s}`]))}catch{}},[]),u=t.useCallback(async e=>{try{(await fetch(`${r}/api/learning/progress/${e}`,{method:"DELETE",credentials:"include"})).ok&&o(i=>{const a=new Set(i);for(const h of a)h.startsWith(`${e}/`)&&a.delete(h);return a})}catch{}},[]);return{completedLessons:m,loading:d,markComplete:p,resetPath:u,refresh:n}}export{A as L,F as u};
