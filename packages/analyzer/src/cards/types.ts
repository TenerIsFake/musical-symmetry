export interface CardParams {
  pcs: number[];
  comparePcs?: number[];
  title?: string;
  subtitle?: string;
  group?: string;
  chordName?: string;
  forteNumber?: string;
  vlDistance?: number;
  genre?: string;
  stabilizerOrder?: number;
  mullikenLabel?: string;
  intervalVector?: [number, number, number, number, number, number];
  description?: string;
}

export type CardStyle =
  | 'orbit'           // 1. Classic orbit diagram
  | 'identity'        // 2. Bold chord identity card
  | 'spectrum'        // 3. Symmetry spectrum position
  | 'comparison'      // 4. Two chords side-by-side
  | 'keyboard'        // 5. Piano keys highlighted
  | 'molecule'        // 6. Molecular analog visual
  | 'interval-dna'    // 7. Interval vector as DNA barcode
  | 'tonnetz'         // 8. Tonnetz grid position
  | 'gradient'        // 9. Abstract gradient based on IV
  | 'minimal'         // 10. Ultra-minimal typography
  | 'academic'        // 11. Formal academic citation style
  | 'neon'            // 12. Synthwave/neon aesthetic
  | 'blueprint'       // 13. Technical blueprint style
  | 'constellation'   // 14. Stars/constellation metaphor
  | 'waveform'        // 15. Audio waveform visualization
  | 'badge'           // 16. Achievement badge/emblem
  | 'story'           // 17. Instagram story format (9:16)
  | 'banner'          // 18. Twitter/X banner format
  | 'quote'           // 19. Pull-quote with chord context
  | 'timeline';       // 20. Mini analysis timeline
