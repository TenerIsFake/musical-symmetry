import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArtistsSection } from '../sections/ArtistsSection';
vi.mock('../api', () => ({ getJSON: vi.fn(async (p: string) => {
  if (p === '/api/artists/Test') return { artist: { name: 'Test' }, gear: [
    { id: 1, gear_name: 'EMT 140', context: 'vocal chain', source_url: 'https://s', confidence: 'high', status: 'approved' },
    { id: 2, gear_name: 'Juno-106', context: 'synth', source_url: 'https://s2', confidence: 'low', status: 'draft' }]};
  throw new Error('x'); }), postJSON: vi.fn() }));
describe('ArtistsSection', () => {
  it('shows gear with an unverified badge on drafts', async () => {
    render(<ArtistsSection />);
    fireEvent.change(screen.getByPlaceholderText(/artist/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/search/i));
    await waitFor(() => expect(screen.getByText('EMT 140')).toBeInTheDocument());
    expect(screen.getByText(/unverified/i)).toBeInTheDocument();
  });
});
