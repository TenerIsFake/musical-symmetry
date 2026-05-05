# What Shape Are the Goldberg Variations?

*Analyzing Bach's BWV 988 through group theory and pitch-class symmetry*

---

## The Question

Every chord has a shape. Not a shape you can see — a shape in **pitch-class space**, the 12-dimensional universe where C=0, C#=1, ... B=11. Some shapes are asymmetric (most chords). Some are perfectly symmetric (the diminished 7th, the whole-tone scale). The symmetry of a chord determines its character: how many keys it could belong to, how many ways it could resolve, how "directional" it feels.

I ran all 31 movements of Bach's Goldberg Variations (BWV 988) through a symmetry classifier and asked: **what is the mathematical shape of Baroque music?**

## The Result: 5,567 Beats of Symmetry Data

| Group | Count | % | What it means |
|-------|-------|---|---------------|
| C₁ (no symmetry) | 3,904 | 70.1% | The chord points toward one key |
| Z₂ (one axis) | 1,651 | 29.7% | The chord has one line of symmetry |
| D₂ (two axes) | 4 | 0.1% | Tritone — splits the octave in half |
| D₃ (triangular) | 2 | 0.04% | Augmented triad — three equal parts |
| D₄ (square) | 4 | 0.1% | Diminished 7th — four equal parts |
| C₂ (rotational) | 2 | 0.04% | Hexatonic set — cyclic symmetry |

**The first thing that jumps out: 99.8% of Bach is asymmetric or minimally symmetric.** This is tonal music's fundamental character — it *points*. Every beat wants to go somewhere specific. The symmetry classifier confirms numerically what every musician knows intuitively: Baroque music is directional.

## The Rare Moments of High Symmetry

But those 12 exceptional moments are where the music is most interesting:

### Diminished 7th (D₄) — The Crossroads

```
Variation 8,  beat 107: {C, E♭, F#, A}  — D₄, stabilizer order 8
Variation 8,  beat 155: {C, E♭, F#, A}  — D₄
Variation 25, beat 10:  {C, E♭, F#, A}  — D₄
Variation 25, beat 58:  {C, E♭, F#, A}  — D₄
```

The diminished 7th chord divides the octave into four equal parts. **Any of its four notes could be the root.** It belongs equally to four different keys. In group theory terms, it has stabilizer order 8 — meaning 8 of the 24 operations in the dihedral group D₁₂ map it onto itself.

Bach uses it at structural pivot points: Variation 8 is a lively two-part invention that suddenly freezes on this maximally-ambiguous harmony before resolving. Variation 25 — the famous "Black Pearl" Adagio in G minor — deploys it in the opening beats as a statement of emotional complexity.

### Augmented Triad (D₃) — Weightlessness

```
Variation 24, beat 180: {C, E, G#}  — D₃, stabilizer order 6
Variation 24, beat 252: {C, E, G#}  — D₃
```

Three notes equally spaced. No root, no gravity. Bach reaches for this exactly twice in the entire set, both in Variation 24 (a canon at the octave). The augmented triad creates a moment of suspension — the ear has no clue where it will resolve — before the canon reasserts its strict logic.

### Hexatonic Collection (C₂) — Hidden Architecture

```
Variation 21, beat 27: {C#, D#, E, G, A, A#}  — C₂
Variation 21, beat 59: {C#, D#, E, G, A, A#}  — C₂
```

This is the most surprising finding. A 6-note collection with cyclic symmetry — transposing it by a specific interval maps it onto itself. This appears in Variation 21, the canone alla settima (canon at the seventh), which is Bach's most chromatic variation. The hexatonic set emerges not because Bach "chose" it, but because the strict canonic procedure *generates* it. The symmetry is a mathematical consequence of the compositional constraint.

## Voice-Leading: The Pulse of the Music

Beyond static symmetry, I measured **voice-leading distance** — the minimum semitone movement between consecutive beats. This gives each variation a "smoothness profile":

| Variation | Style | Mean VL | Smooth (≤2) | Leaps (>4) |
|-----------|-------|---------|-------------|------------|
| Aria | Sarabande | 2.24 | 57% | 17% |
| Var 1 | Lively | 2.88 | 46% | 31% |
| Var 5 | Virtuosic | 3.28 | 49% | 39% |
| Var 15 | Canon (minor) | 1.97 | 63% | 9% |
| Var 25 | Adagio (minor) | 3.33 | 41% | 29% |
| Var 30 | Quodlibet | 2.45 | 54% | 22% |

**Variation 15 is the smoothest** (mean 1.97 semitones, 63% smooth). It's a canon in contrary motion — voices move by step by construction. The math confirms what performers know: this is the most "connected" variation.

**Variation 25 is the most restless** — almost no static moments (only 8% of transitions have VL=0). Every voice moves on every beat, creating its heartbreaking chromatic character.

**The Aria and the Quodlibet bookend the set** at nearly identical smoothness (2.24 vs 2.45). Bach architecturally "returns home" — and the voice-leading metric captures this numerically.

## Genre Comparison: Bach vs Modern Music

For context, I generated the same analysis for modern progressions:

| Genre | Dominant Group | Mean VL | Character |
|-------|---------------|---------|-----------|
| **Bach (Goldberg)** | C₁ (70%) | 2.24-3.33 | Asymmetric, moderate motion |
| Pop (I-V-vi-IV) | C₁ (100%) | 0.71 | Maximally smooth, zero symmetry |
| Neo-Soul | Z₂ (63%) | 2.21 | Higher symmetry from 7th chords |
| EDM | C₁ (100%) | 0.68 | Even smoother than pop |
| Jazz Fusion | C₁ (78%) | 1.72 | Quartal voicings avoid tritones |
| Radiohead | Z₂ (50%), D₄ | 1.07 | High symmetry + smooth approach |
| Trap | Z₂ (63%) | 0.92 | Sparse dyads → automatic Z₂ |

**Key insight:** Pop and EDM are 100% asymmetric (C₁) with ultra-low voice-leading distance. They achieve emotional simplicity through *both* harmonic asymmetry (pointing at one key) and minimal movement (common tones between chords). Bach has the same harmonic asymmetry but much more motion — the voices are constantly independent.

The most structurally similar genre to Bach is **Neo-Soul** — it has comparable voice-leading distance (2.21 vs 2.24) and introduces Z₂ symmetry through extended chords. This isn't coincidence: both Bach and neo-soul (D'Angelo, Erykah Badu) prioritize voice independence and chromatic color over simple triadic function.

## What This Means

Three takeaways from running group theory on 18th-century counterpoint:

1. **Tonal music is 99.8% asymmetric.** The "default state" is C₁ — one key, one direction, one meaning. Symmetry is the exception that creates drama.

2. **High-symmetry chords mark structural pivots.** Bach doesn't use diminished 7ths or augmented triads casually — they appear at exactly the moments where the music needs maximum ambiguity before choosing a path.

3. **Voice-leading distance is a better measure of "complexity" than harmony alone.** Two pieces can have the same chord types (all C₁ triads) but feel completely different because of how much the voices move. The metric captures this quantitatively.

---

*Analysis performed with [Musical Symmetry](https://symmetry.tendrid.us) — an open-source tool for exploring pitch-class set symmetry. The full API supports batch analysis of MIDI files.*

*Code: [github.com/TenerIsFake/musical-symmetry](https://github.com/TenerIsFake/musical-symmetry)*
