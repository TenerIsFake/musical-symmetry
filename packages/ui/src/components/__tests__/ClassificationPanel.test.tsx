import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ClassificationPanel from '../ClassificationPanel';
import { classify } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';
import { ResearchModeProvider } from '../../context/ResearchMode';

function renderWithContext(ui: React.ReactElement) {
  return render(<ResearchModeProvider>{ui}</ResearchModeProvider>);
}

describe('ClassificationPanel', () => {
  it('shows placeholder when analysis is null', () => {
    const { getByText } = renderWithContext(
      <ClassificationPanel analysis={null} chord={null} />
    );
    expect(getByText(/Select at least 2/)).toBeInTheDocument();
  });

  it('displays analysis results', () => {
    const analysis = classify([0, 4, 7] as PitchClass[]);
    const { getByText } = renderWithContext(
      <ClassificationPanel analysis={analysis} chord={null} />
    );
    expect(getByText('Symmetry Group')).toBeInTheDocument();
    expect(getByText('Maximally Even')).toBeInTheDocument();
  });

  it('displays chord name when provided', () => {
    const analysis = classify([0, 4, 7] as PitchClass[]);
    const chord = { root: 0 as PitchClass, quality: 'major' as const, pitchClasses: [0, 4, 7] as PitchClass[] };
    const { getByText } = renderWithContext(
      <ClassificationPanel analysis={analysis} chord={chord} />
    );
    expect(getByText(/C major/)).toBeInTheDocument();
  });
});
