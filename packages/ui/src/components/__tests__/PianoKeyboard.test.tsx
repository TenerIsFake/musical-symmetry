import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PianoKeyboard from '../PianoKeyboard';
import type { PitchClass } from '@musical-symmetry/core';

describe('PianoKeyboard', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <PianoKeyboard selectedPCs={[]} onToggle={() => {}} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('calls onToggle when a key is clicked', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <PianoKeyboard selectedPCs={[]} onToggle={onToggle} />
    );
    const rects = container.querySelectorAll('rect');
    fireEvent.click(rects[0]!);
    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it('highlights selected pitch classes', () => {
    const { container } = render(
      <PianoKeyboard selectedPCs={[0, 4, 7] as PitchClass[]} onToggle={() => {}} />
    );
    const rects = container.querySelectorAll('rect');
    expect(rects[0]!.getAttribute('class')).toContain('green');
  });
});
