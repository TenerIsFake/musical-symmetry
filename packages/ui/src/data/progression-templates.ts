export interface TemplateChord {
  root: number;
  quality: string;
  pcs: number[];
}

export interface ProgressionTemplate {
  id: string;
  name: string;
  category: 'classical' | 'jazz' | 'pop' | 'film';
  romanNumerals: string;
  chords: TemplateChord[]; // in key of C
  description: string;
  symmetryNote?: string;
}

// All pitch classes in key of C (0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B)
export const PROGRESSION_TEMPLATES: ProgressionTemplate[] = [
  // ── Classical ──────────────────────────────────────────────────────────────
  {
    id: 'cls-authentic-cadence',
    name: 'Authentic Cadence',
    category: 'classical',
    romanNumerals: 'I – IV – V – I',
    chords: [
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
    ],
    description: 'The foundational cadence of Western tonal music, driving tension and resolution.',
    symmetryNote: 'Symmetric around the tonic: IV and V are equidistant by a perfect 4th/5th.',
  },
  {
    id: 'cls-50s-doo-wop',
    name: '50s / Doo-Wop',
    category: 'classical',
    romanNumerals: 'I – vi – IV – V',
    chords: [
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
      { root: 9,  quality: 'minor', pcs: [9, 0, 4]  },  // Am
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
    ],
    description: 'The timeless "Heart and Soul" pattern — ubiquitous in classical, pop, and rock.',
    symmetryNote: 'vi is the relative minor of I; together they share all tones — reflective duality.',
  },
  {
    id: 'cls-pachelbel',
    name: "Pachelbel's Canon",
    category: 'classical',
    romanNumerals: 'I – V – vi – iii – IV – I – IV – V',
    chords: [
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
      { root: 9,  quality: 'minor', pcs: [9, 0, 4]  },  // Am
      { root: 4,  quality: 'minor', pcs: [4, 7, 11] },  // Em
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
    ],
    description: "Baroque's most recognizable ground bass, underpinning hundreds of modern songs.",
    symmetryNote: 'The descending bass line C–G–A–E–F–C–F–G forms a near-palindromic arc.',
  },
  {
    id: 'cls-circle-of-fifths',
    name: 'Circle of Fifths',
    category: 'classical',
    romanNumerals: 'I – IV – vii° – iii – vi – ii – V – I',
    chords: [
      { root: 0,  quality: 'major',      pcs: [0, 4, 7]   },  // C
      { root: 5,  quality: 'major',      pcs: [5, 9, 0]   },  // F
      { root: 11, quality: 'diminished', pcs: [11, 2, 5]  },  // Bdim
      { root: 4,  quality: 'minor',      pcs: [4, 7, 11]  },  // Em
      { root: 9,  quality: 'minor',      pcs: [9, 0, 4]   },  // Am
      { root: 2,  quality: 'minor',      pcs: [2, 5, 9]   },  // Dm
      { root: 7,  quality: 'major',      pcs: [7, 11, 2]  },  // G
      { root: 0,  quality: 'major',      pcs: [0, 4, 7]   },  // C
    ],
    description: 'A full traversal of the diatonic cycle of fifths, beloved in Baroque sequences.',
    symmetryNote: 'Each root moves down a perfect 5th — pure rotational symmetry on the pitch-class circle.',
  },
  {
    id: 'cls-lament-bass',
    name: 'Lament Bass (Descending Tetrachord)',
    category: 'classical',
    romanNumerals: 'i – VII – VI – V',
    chords: [
      { root: 0,  quality: 'minor', pcs: [0, 3, 7]  },  // Cm
      { root: 10, quality: 'major', pcs: [10, 2, 5] },  // Bb
      { root: 8,  quality: 'major', pcs: [8, 0, 3]  },  // Ab
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
    ],
    description: 'The classic descending minor bass line used from Purcell to modern film scores.',
    symmetryNote: 'Chromatic descent C→B♭→A♭→G spans a tritone — D6 symmetry under inversion.',
  },

  // ── Jazz ───────────────────────────────────────────────────────────────────
  {
    id: 'jazz-ii-v-i',
    name: 'ii–V–I',
    category: 'jazz',
    romanNumerals: 'ii7 – V7 – Imaj7',
    chords: [
      { root: 2,  quality: 'min7',   pcs: [2, 5, 9, 0]  },  // Dm7
      { root: 7,  quality: 'dom7',   pcs: [7, 11, 2, 5] },  // G7
      { root: 0,  quality: 'maj7',   pcs: [0, 4, 7, 11] },  // Cmaj7
    ],
    description: 'The cornerstone of jazz harmony — nearly every jazz standard contains this cell.',
    symmetryNote: 'The tritone F→B in G7 inverts to B→F, the same tritone — tritone symmetry.',
  },
  {
    id: 'jazz-rhythm-changes',
    name: 'Rhythm Changes (A section)',
    category: 'jazz',
    romanNumerals: 'I – vi – ii – V – I – VI7 – ii – V',
    chords: [
      { root: 0,  quality: 'maj7',  pcs: [0, 4, 7, 11] },  // Cmaj7
      { root: 9,  quality: 'min7',  pcs: [9, 0, 4, 7]  },  // Am7
      { root: 2,  quality: 'min7',  pcs: [2, 5, 9, 0]  },  // Dm7
      { root: 7,  quality: 'dom7',  pcs: [7, 11, 2, 5] },  // G7
      { root: 0,  quality: 'maj7',  pcs: [0, 4, 7, 11] },  // Cmaj7
      { root: 9,  quality: 'dom7',  pcs: [9, 1, 4, 7]  },  // A7
      { root: 2,  quality: 'min7',  pcs: [2, 5, 9, 0]  },  // Dm7
      { root: 7,  quality: 'dom7',  pcs: [7, 11, 2, 5] },  // G7
    ],
    description: "Based on Gershwin's 'I Got Rhythm' — the most covered chord changes in jazz.",
    symmetryNote: 'The I–vi–ii–V cell repeats with a secondary dominant pivot at bar 5.',
  },
  {
    id: 'jazz-coltrane-changes',
    name: 'Coltrane Changes',
    category: 'jazz',
    romanNumerals: 'Imaj7 – bIII7 – bVImaj7 – bVI7 – bImaj7 – VII7 – Imaj7',
    chords: [
      { root: 0,  quality: 'maj7', pcs: [0, 4, 7, 11]  },  // Cmaj7
      { root: 3,  quality: 'dom7', pcs: [3, 7, 10, 1]  },  // Eb7
      { root: 8,  quality: 'maj7', pcs: [8, 0, 3, 7]   },  // Abmaj7
      { root: 8,  quality: 'dom7', pcs: [8, 0, 3, 6]   },  // Ab7
      { root: 1,  quality: 'maj7', pcs: [1, 5, 8, 0]   },  // Dbmaj7 (enharmonic bII)
      { root: 11, quality: 'dom7', pcs: [11, 3, 6, 10] },  // B7
      { root: 0,  quality: 'maj7', pcs: [0, 4, 7, 11]  },  // Cmaj7
    ],
    description: "Coltrane's tritone-substitution cycle, heard on 'Giant Steps' and 'Countdown'.",
    symmetryNote: 'Roots C→E♭→A♭ divide the octave into three equal parts — perfect T4 (M3) symmetry.',
  },
  {
    id: 'jazz-tritone-sub',
    name: 'Tritone Substitution ii–V–I',
    category: 'jazz',
    romanNumerals: 'ii7 – ♭II7 – Imaj7',
    chords: [
      { root: 2,  quality: 'min7', pcs: [2, 5, 9, 0]  },  // Dm7
      { root: 1,  quality: 'dom7', pcs: [1, 5, 8, 11] },  // Db7
      { root: 0,  quality: 'maj7', pcs: [0, 4, 7, 11] },  // Cmaj7
    ],
    description: 'The tritone substitution replaces V7 with ♭II7, creating smooth chromatic bass motion.',
    symmetryNote: 'G7 and D♭7 share the same tritone (F–B) — they are tritone-symmetric partners.',
  },
  {
    id: 'jazz-modal-so-what',
    name: 'Modal Dorian (So What)',
    category: 'jazz',
    romanNumerals: 'Im7 – ♭VII – Im7',
    chords: [
      { root: 2,  quality: 'min7', pcs: [2, 5, 9, 0]   },  // Dm7 (D Dorian)
      { root: 0,  quality: 'maj7', pcs: [0, 4, 7, 11]  },  // Cmaj7
      { root: 2,  quality: 'min7', pcs: [2, 5, 9, 0]   },  // Dm7
    ],
    description: "Inspired by Miles Davis's 'So What' — static modal harmony with one shift for color.",
    symmetryNote: 'D Dorian is the mode of C major, sharing all pitch classes — tonal mirror relationship.',
  },
  {
    id: 'jazz-blues-changes',
    name: 'Jazz Blues',
    category: 'jazz',
    romanNumerals: 'I7 – IV7 – I7 – I7 – IV7 – IV7 – I7 – VI7 – ii7 – V7 – I7 – V7',
    chords: [
      { root: 0,  quality: 'dom7', pcs: [0, 4, 7, 10]  },  // C7
      { root: 5,  quality: 'dom7', pcs: [5, 9, 0, 3]   },  // F7
      { root: 0,  quality: 'dom7', pcs: [0, 4, 7, 10]  },  // C7
      { root: 0,  quality: 'dom7', pcs: [0, 4, 7, 10]  },  // C7
      { root: 5,  quality: 'dom7', pcs: [5, 9, 0, 3]   },  // F7
      { root: 5,  quality: 'dom7', pcs: [5, 9, 0, 3]   },  // F7
      { root: 0,  quality: 'dom7', pcs: [0, 4, 7, 10]  },  // C7
      { root: 9,  quality: 'dom7', pcs: [9, 1, 4, 7]   },  // A7
      { root: 2,  quality: 'min7', pcs: [2, 5, 9, 0]   },  // Dm7
      { root: 7,  quality: 'dom7', pcs: [7, 11, 2, 5]  },  // G7
      { root: 0,  quality: 'dom7', pcs: [0, 4, 7, 10]  },  // C7
      { root: 7,  quality: 'dom7', pcs: [7, 11, 2, 5]  },  // G7
    ],
    description: '12-bar jazz blues — the template for countless bebop heads and blues standards.',
    symmetryNote: 'IV7 appears at bars 2 and 5 forming a near-symmetrical bracket around the tonic.',
  },

  // ── Pop ────────────────────────────────────────────────────────────────────
  {
    id: 'pop-axis',
    name: 'Axis Progression',
    category: 'pop',
    romanNumerals: 'I – V – vi – IV',
    chords: [
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
      { root: 9,  quality: 'minor', pcs: [9, 0, 4]  },  // Am
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
    ],
    description: "The 'Axis of Awesome' — used in hundreds of hit songs across every genre.",
    symmetryNote: 'vi lies exactly between I and V harmonically; IV is its subdominant mirror.',
  },
  {
    id: 'pop-andalusian',
    name: 'Andalusian Cadence',
    category: 'pop',
    romanNumerals: 'i – VII – VI – V',
    chords: [
      { root: 9,  quality: 'minor', pcs: [9, 0, 4]  },  // Am
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
      { root: 4,  quality: 'major', pcs: [4, 8, 11] },  // E
    ],
    description: 'Flamenco-derived descending minor progression — evocative and modal in character.',
    symmetryNote: 'Descending tetrachord A–G–F–E creates near-chromatic stepwise symmetry.',
  },
  {
    id: 'pop-sensitive-female',
    name: 'vi–IV–I–V (Sensitive Female)',
    category: 'pop',
    romanNumerals: 'vi – IV – I – V',
    chords: [
      { root: 9,  quality: 'minor', pcs: [9, 0, 4]  },  // Am
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
    ],
    description: 'A rotation of the Axis progression starting on vi — darker, more introspective feel.',
    symmetryNote: 'Same four chords as the Axis, rotated: the symmetry group is cyclic (Z4).',
  },
  {
    id: 'pop-minor-descending',
    name: 'Minor Descending (i–VII–VI–VII)',
    category: 'pop',
    romanNumerals: 'i – VII – VI – VII',
    chords: [
      { root: 9,  quality: 'minor', pcs: [9, 0, 4]  },  // Am
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
    ],
    description: 'Natural minor oscillation — the spine of modern rock and singer-songwriter fare.',
    symmetryNote: 'Palindromic inner motion: VII–VI–VII mirrors itself around the midpoint.',
  },
  {
    id: 'pop-four-chords-minor',
    name: 'Minor i–iv–VII–III',
    category: 'pop',
    romanNumerals: 'i – iv – VII – III',
    chords: [
      { root: 9,  quality: 'minor', pcs: [9, 0, 4]  },  // Am
      { root: 2,  quality: 'minor', pcs: [2, 5, 9]  },  // Dm
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
    ],
    description: "Aeolian mode's most natural four-chord loop — powerful and melancholic.",
    symmetryNote: 'i and III are separated by a minor 3rd; iv and VII mirror that interval up a 4th.',
  },

  // ── Film / Ambient ─────────────────────────────────────────────────────────
  {
    id: 'film-chromatic-mediant',
    name: 'Chromatic Mediant Shift',
    category: 'film',
    romanNumerals: 'I – ♭III – ♭VI – I',
    chords: [
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
      { root: 3,  quality: 'major', pcs: [3, 7, 10] },  // Eb
      { root: 8,  quality: 'major', pcs: [8, 0, 3]  },  // Ab
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
    ],
    description: "Neo-Riemannian juxtapositions beloved in John Williams and Hans Zimmer scores.",
    symmetryNote: 'Roots C→E♭→A♭ are equally spaced by M3 — T4 rotational symmetry (order 3).',
  },
  {
    id: 'film-lydian-float',
    name: 'Lydian Float',
    category: 'film',
    romanNumerals: 'Imaj7 – II – Imaj7 – II',
    chords: [
      { root: 0,  quality: 'maj7',  pcs: [0, 4, 7, 11] },  // Cmaj7
      { root: 2,  quality: 'major', pcs: [2, 6, 9]     },  // D (♯IV note in Lydian)
      { root: 0,  quality: 'maj7',  pcs: [0, 4, 7, 11] },  // Cmaj7
      { root: 2,  quality: 'major', pcs: [2, 6, 9]     },  // D
    ],
    description: "The Lydian mode's dreamlike, floating quality — used in ambient and wonder cues.",
    symmetryNote: 'D major contains F#, the characteristic Lydian ♯4 of C — a single-note pivot.',
  },
  {
    id: 'film-plr-chain',
    name: 'Neo-Riemannian PLR Chain',
    category: 'film',
    romanNumerals: 'I – P(i) – L(vi) – R(♭VI)',
    chords: [
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C  (start)
      { root: 0,  quality: 'minor', pcs: [0, 3, 7]  },  // Cm (P: parallel)
      { root: 8,  quality: 'major', pcs: [8, 0, 3]  },  // Ab (L: leading-tone exchange)
      { root: 5,  quality: 'minor', pcs: [5, 8, 0]  },  // Fm (R: relative)
    ],
    description: 'A pure neo-Riemannian P–L–R transformation chain — minimal voice leading throughout.',
    symmetryNote: 'Each step moves exactly one voice by a semitone or whole tone — maximum parsimony.',
  },
  {
    id: 'film-shepard-wedge',
    name: 'Shepard-Tone Wedge (Perpetual Ascent)',
    category: 'film',
    romanNumerals: 'I – II – III – IV – I (cycle)',
    chords: [
      { root: 0,  quality: 'major', pcs: [0, 4, 7]  },  // C
      { root: 2,  quality: 'major', pcs: [2, 6, 9]  },  // D
      { root: 4,  quality: 'major', pcs: [4, 8, 11] },  // E
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
    ],
    description: 'Ascending whole-step major chords creating a Shepard-tone illusion of endless rise.',
    symmetryNote: 'Whole-tone root motion — equal division of the scale into steps of T2.',
  },
  {
    id: 'film-cinematic-minor',
    name: 'Cinematic Minor Loop',
    category: 'film',
    romanNumerals: 'i – ♭VII – ♭VI – ♭VII',
    chords: [
      { root: 9,  quality: 'minor', pcs: [9, 0, 4]  },  // Am
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
      { root: 5,  quality: 'major', pcs: [5, 9, 0]  },  // F
      { root: 7,  quality: 'major', pcs: [7, 11, 2] },  // G
    ],
    description: 'Brooding loop favored in trailer music and action cues — tense and cinematic.',
    symmetryNote: 'The G chord appears twice, framing F as an axis of bilateral symmetry.',
  },
  {
    id: 'film-impressionist-whole-tone',
    name: 'Whole-Tone Impressionist',
    category: 'film',
    romanNumerals: 'Caug – Daug – Eaug – Caug',
    chords: [
      { root: 0,  quality: 'augmented', pcs: [0, 4, 8]   },  // Caug
      { root: 2,  quality: 'augmented', pcs: [2, 6, 10]  },  // Daug
      { root: 4,  quality: 'augmented', pcs: [4, 8, 0]   },  // Eaug (=Caug)
      { root: 0,  quality: 'augmented', pcs: [0, 4, 8]   },  // Caug
    ],
    description: 'Debussy-inspired whole-tone augmented chords — shimmering, directionless tension.',
    symmetryNote: 'Each augmented triad has T4 symmetry; all three roots form the whole-tone scale.',
  },
];

// Transpose a set of pitch classes by semitones
export function transposeChord(pcs: number[], semitones: number): number[] {
  return pcs.map(pc => (pc + semitones + 12) % 12);
}

// Transpose a full template to a new key root (0=C ... 11=B)
export function transposeTemplate(
  template: ProgressionTemplate,
  toRoot: number,
): ProgressionTemplate {
  const semitones = toRoot; // template is in C (root=0)
  return {
    ...template,
    chords: template.chords.map(ch => ({
      ...ch,
      root: (ch.root + semitones) % 12,
      pcs: transposeChord(ch.pcs, semitones),
    })),
  };
}

export const CATEGORY_META: Record<
  ProgressionTemplate['category'],
  { label: string; color: string; border: string; badge: string }
> = {
  classical: {
    label: 'Classical',
    color: 'bg-amber-900/40',
    border: 'border-amber-700',
    badge: 'bg-amber-800 text-amber-200',
  },
  jazz: {
    label: 'Jazz',
    color: 'bg-blue-900/40',
    border: 'border-blue-700',
    badge: 'bg-blue-800 text-blue-200',
  },
  pop: {
    label: 'Pop',
    color: 'bg-pink-900/40',
    border: 'border-pink-700',
    badge: 'bg-pink-800 text-pink-200',
  },
  film: {
    label: 'Film / Ambient',
    color: 'bg-emerald-900/40',
    border: 'border-emerald-700',
    badge: 'bg-emerald-800 text-emerald-200',
  },
};

export const NOTE_NAMES_SHARP = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;
