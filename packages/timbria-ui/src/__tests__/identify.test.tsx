import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IdentifySection } from '../sections/IdentifySection';

vi.mock('../api', () => ({
  getJSON: vi.fn(async (path: string) => {
    if (path === '/api/identify/tree') return { root: { id: 1, question: 'Space or tonal?', branches: [{ answer: 'space', next: 2 }], leaf_fx_type_ids: [], explanation: '' } };
    if (path === '/api/identify/node/2') return { id: 2, question: '', branches: [], leaf_fx_type_ids: [10], explanation: 'Plate reverb.' };
    if (path === '/api/fx/10') return { id: 10, name: 'Plate Reverb', fingerprint: 'bright decay' };
    throw new Error('unexpected ' + path);
  }),
}));

describe('IdentifySection', () => {
  it('walks from question to leaf explanation', async () => {
    render(<IdentifySection />);
    await screen.findByText(/Space or tonal/);
    fireEvent.click(screen.getByText('space'));
    await waitFor(() => expect(screen.getByText(/Plate reverb\./)).toBeInTheDocument());
  });
});
