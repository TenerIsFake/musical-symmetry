// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IdentifyByEar } from './IdentifyByEar.js';

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      domain: 'isolated',
      instruments: [{ label: 'Electric guitar', confidence: 0.88 }],
      effects: [{ label: 'Reverb', confidence: 0.92 }],
      mood: [{ label: 'dreamy', confidence: 0.7 }],
      fxTypeIds: [1, 2],
    }),
  })) as any;
});

describe('IdentifyByEar', () => {
  it('uploads a file and renders detections', async () => {
    render(<IdentifyByEar />);
    const file = new File([new Uint8Array([1, 2, 3])], 'riff.wav', { type: 'audio/wav' });
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /identify/i }));
    await waitFor(() => expect(screen.getByText(/Electric guitar/)).toBeTruthy());
    expect(screen.getByText(/Reverb/)).toBeTruthy();
    expect(screen.getByText(/dreamy/)).toBeTruthy();
  });

  it('disables the record button when MediaRecorder is unavailable (jsdom)', () => {
    render(<IdentifyByEar />);
    const btn = screen.getByRole('button', { name: /record/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
