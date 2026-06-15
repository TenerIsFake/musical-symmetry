import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArtistsSection } from '../sections/ArtistsSection';
const post = vi.fn(async () => ({ status: 'drafted', inserted: 1 }));
let calls = 0;
vi.mock('../api', () => ({
  postJSON: (...a: any[]) => post(...a),
  getJSON: vi.fn(async (p: string) => {
    if (p.includes('/api/artists/')) { calls++; if (calls === 1) throw new Error('404');
      return { artist: { name: 'New' }, gear: [{ id: 1, gear_name: 'EMT 140', context: 'vox', source_url: 'https://s', confidence: 'high', status: 'draft' }] }; }
    throw new Error('x'); }),
}));
describe('look it up', () => {
  it('shows the button for unknown artist and re-fetches after lookup', async () => {
    render(<ArtistsSection />);
    fireEvent.change(screen.getByPlaceholderText(/artist/i), { target: { value: 'New' } });
    fireEvent.click(screen.getByText(/search/i));
    await screen.findByText(/no sourced gear/i);
    fireEvent.click(screen.getByText(/look it up/i));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/artists/New/lookup', {}));
    await waitFor(() => expect(screen.getByText('EMT 140')).toBeInTheDocument());
  });
});
