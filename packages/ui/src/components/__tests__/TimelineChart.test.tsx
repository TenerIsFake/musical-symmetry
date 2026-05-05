import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TimelineChart from '../TimelineChart';

describe('TimelineChart', () => {
  it('renders SVG', () => {
    const slices = [
      { startBeat: 0, endBeat: 1, abstractGroup: 'C1', mullikenLabel: 'A1u', stabilizerOrder: 1, chordName: 'C major' },
      { startBeat: 1, endBeat: 2, abstractGroup: 'C1', mullikenLabel: 'A1u', stabilizerOrder: 1, chordName: null },
    ];
    const { container } = render(
      <TimelineChart slices={slices} onSelectSlice={() => {}} selectedIndex={null} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
