import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ProgressionPanel from '../ProgressionPanel';
import type { PitchClass, Chord } from '@musical-symmetry/core';

describe('ProgressionPanel', () => {
  it('shows placeholder when no chord', () => {
    const { getByText } = render(<ProgressionPanel chord={null} />);
    expect(getByText(/Select a major or minor/)).toBeInTheDocument();
  });

  it('renders suggestions for C major', () => {
    const chord: Chord = { root: 0 as PitchClass, quality: 'major', pitchClasses: [0, 4, 7] as PitchClass[] };
    const { getByText } = render(<ProgressionPanel chord={chord} />);
    expect(getByText('P')).toBeInTheDocument();
    expect(getByText('L')).toBeInTheDocument();
    expect(getByText('R')).toBeInTheDocument();
  });
});
