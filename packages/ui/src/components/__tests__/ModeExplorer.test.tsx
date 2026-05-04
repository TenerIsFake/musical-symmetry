import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ModeExplorer from '../ModeExplorer';
import type { PitchClass } from '@musical-symmetry/core';

describe('ModeExplorer', () => {
  it('shows placeholder for non-7-note sets', () => {
    const { getByText } = render(
      <ModeExplorer selectedPCs={[0, 4, 7] as PitchClass[]} onSelectMode={() => {}} />
    );
    expect(getByText(/Select exactly 7/)).toBeInTheDocument();
  });

  it('renders modes for C major scale', () => {
    const cMajor = [0, 2, 4, 5, 7, 9, 11] as PitchClass[];
    const { getByText } = render(
      <ModeExplorer selectedPCs={cMajor} onSelectMode={() => {}} />
    );
    expect(getByText(/Ionian/)).toBeInTheDocument();
  });
});
