# Musical Symmetry

**See the hidden geometry of chords.**

Musical Symmetry analyzes pitch-class sets using group theory — the same math that classifies crystal structures and molecular shapes. Select notes, upload MIDI files, or sing into your microphone to discover the abstract symmetry groups that give chords their character.

[**Try it live**](https://symmetry.tendrid.us)

---

## What It Does

Every chord has a **shape** in pitch-class space. A major triad has no symmetry (C₁) — it points toward one key. A diminished 7th has full square symmetry (D₄) — any of its four notes could be the root. This tool classifies those shapes and shows you what they mean musically.

**For musicians:** Understand *why* certain chords feel tense, dreamy, or stable — it's the symmetry.

**For researchers:** Full classification engine (Forte-style set theory + Neo-Riemannian PLR + voice-leading metrics) with a JSON API for batch analysis.

## Features

- **Interactive classifier** — click notes on a piano, get instant symmetry analysis
- **20+ presets** — major/minor triads, jazz extensions, Scriabin's mystic chord, whole-tone scales
- **Plain-English explanations** — "This chord is perfectly balanced — it could resolve anywhere"
- **Voice-leading distance** — see how much motion connects consecutive chords
- **Neo-Riemannian progressions** — PLR transformations with order classification
- **File analyzer** — upload MIDI/MusicXML/WAV, see how symmetry evolves over time
- **Live microphone** — real-time pitch detection via Web Audio API
- **Orbit diagram** — visual pitch-class clock with symmetry axes
- **Tonnetz** — triangular lattice showing triadic relationships
- **Mode explorer** — 7-note scales ranked by brightness
- **Molecular analogs** — which molecule shares your chord's point group?
- **Shareable URLs** — link directly to any chord (e.g., `#classifier?pcs=0,4,7`)

## The Math

The engine classifies pitch-class sets (subsets of Z/12Z) under the action of the dihedral group D₁₂. For each set it computes:

| Property | Description |
|----------|-------------|
| Abstract group | The stabilizer's isomorphism class (C₁, Z₂, D₃, D₄, etc.) |
| Mulliken label | Spectroscopic notation (A₁, B₂, etc.) from character theory |
| Interval vector | 6-element vector counting interval-class content |
| Stabilizer order | Size of the symmetry group |
| Maximal evenness | Whether notes are as spread out as possible |
| Myhill property | Whether the set has exactly 2 interval sizes per generic interval |
| Character table | How the set transforms under {E, T₆, I, R} |
| Voice-leading distance | Minimal semitone movement to the previous chord |

### References

- Forte, A. (1973). *The Structure of Atonal Music*
- Lewin, D. (1987). *Generalized Musical Intervals and Transformations*
- Cohn, R. (1998). "Neo-Riemannian Operations, Parsimonious Trichords, and Their Tonnetz Representations"
- Tymoczko, D. (2011). *A Geometry of Music*
- Quinn, I. (2006). "General Equal-Tempered Harmony"

## Quick Start

```bash
# Clone and install
git clone https://github.com/TenerIsFake/musical-symmetry.git
cd musical-symmetry
npm install

# Run tests (132 core + 22 UI + 18 analyzer = 172 total)
npm -w packages/core test
npm -w packages/ui test
npm -w packages/analyzer test

# Development
npm -w packages/ui run dev          # UI at http://localhost:3009
npm -w packages/analyzer run dev    # API at http://localhost:3010

# Docker (production)
docker compose up -d
# UI: http://localhost:3009
# API: http://localhost:3009/api/health
```

## API

```bash
# Analyze a MIDI file
curl -X POST http://localhost:3009/api/analyze \
  -F "file=@song.mid"

# Response includes per-beat analysis:
{
  "filename": "song.mid",
  "totalBeats": 64,
  "slices": [
    {
      "slice": { "startBeat": 1, "pitchClasses": [0, 4, 7] },
      "analysis": {
        "abstractGroup": "C1",
        "stabilizerOrder": 1,
        "intervalVector": [0, 0, 1, 1, 1, 0],
        ...
      },
      "chord": { "root": 0, "quality": "major", "name": "C major" },
      "voiceLeadingFromPrev": null
    },
    ...
  ]
}
```

## Project Structure

```
packages/
├── core/      Pure TypeScript engine — group theory, PLR, voice leading (0 deps)
├── ui/        React + D3 + Tailwind — interactive classifier + analyzer
└── analyzer/  Express API — MIDI/MusicXML/WAV parsing + batch analysis
```

## License

MIT
