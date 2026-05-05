export interface GroupDescription {
  plain: string;
  musical: string;
  feel: string;
}

export const GROUP_DESCRIPTIONS: Record<string, GroupDescription> = {
  C1: {
    plain: 'No symmetry — this set has a unique identity.',
    musical: 'Points strongly toward one key. Most triads and common chords live here.',
    feel: 'Grounded, directional, wants to go somewhere specific.',
  },
  Z2: {
    plain: 'One axis of symmetry — like a butterfly wing.',
    musical: 'Has one transpositional or inversional twin. Often contains a tritone or is a 7th chord.',
    feel: 'Slightly ambiguous — could resolve two ways.',
  },
  C2: {
    plain: 'Two-fold rotational symmetry.',
    musical: 'Transposing by a specific interval maps this set onto itself. Hexatonic collections live here.',
    feel: 'Floating between two tonal centers.',
  },
  C3: {
    plain: 'Three-fold rotational symmetry — like a propeller.',
    musical: 'Transposing by major thirds maps this onto itself. Related to the augmented triad.',
    feel: 'Drifting, dreamy, no single root.',
  },
  C4: {
    plain: 'Four-fold rotational symmetry.',
    musical: 'Transposing by minor thirds maps this onto itself. Related to the diminished chord.',
    feel: 'Tense but balanced — wants to resolve but has multiple escape routes.',
  },
  C6: {
    plain: 'Six-fold rotational symmetry.',
    musical: 'Transposing by whole steps maps this onto itself. The whole-tone scale lives here.',
    feel: 'Weightless, impressionistic, no gravity.',
  },
  D2: {
    plain: 'Two rotational + two reflective symmetries.',
    musical: 'The tritone interval — splits the octave exactly in half. Maximum tension in minimal form.',
    feel: 'Restless, demanding resolution.',
  },
  D3: {
    plain: 'Full triangular symmetry — three rotations + three reflections.',
    musical: 'The augmented triad. Every note is equally spaced. Any note could be the root.',
    feel: 'Suspended, ethereal — Debussy, Coltrane.',
  },
  D4: {
    plain: 'Full square symmetry — four rotations + four reflections.',
    musical: 'The diminished 7th chord. Four notes equally spaced. The most symmetric 4-note chord possible.',
    feel: 'Maximum tension, maximum ambiguity — a crossroads that leads everywhere.',
  },
  D6: {
    plain: 'Full hexagonal symmetry — like a snowflake.',
    musical: 'The whole-tone scale (6 notes equally spaced). No leading tones, no pull.',
    feel: 'Suspended animation — time stops.',
  },
  D12: {
    plain: 'Full circular symmetry — the complete set.',
    musical: 'All 12 pitch classes — total chromaticism. Nothing is excluded, so nothing is special.',
    feel: 'Everything and nothing — white noise of pitch.',
  },
};
