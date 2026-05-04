import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TonnetzViz from '../TonnetzViz';
import type { PitchClass, Chord } from '@musical-symmetry/core';

describe('TonnetzViz', () => {
  it('renders SVG element', () => {
    const { container } = render(<TonnetzViz chord={null} targetChord={null} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with a chord without crashing', () => {
    const chord: Chord = { root: 0 as PitchClass, quality: 'major', pitchClasses: [0, 4, 7] as PitchClass[] };
    const { container } = render(<TonnetzViz chord={chord} targetChord={null} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
