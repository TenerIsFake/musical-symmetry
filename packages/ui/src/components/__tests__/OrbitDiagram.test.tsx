import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import OrbitDiagram from '../OrbitDiagram';
import { classify } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';

describe('OrbitDiagram', () => {
  it('renders SVG with 12 nodes', () => {
    const { container } = render(
      <OrbitDiagram selectedPCs={[]} analysis={null} />
    );
    const circles = container.querySelectorAll('circle');
    // 1 outer ring + 12 pc nodes = 13
    expect(circles.length).toBe(13);
  });

  it('highlights selected PCs with polygon', () => {
    const pcs = [0, 4, 7] as PitchClass[];
    const analysis = classify(pcs);
    const { container } = render(
      <OrbitDiagram selectedPCs={pcs} analysis={analysis} />
    );
    const polygon = container.querySelector('polygon');
    expect(polygon).toBeInTheDocument();
  });
});
