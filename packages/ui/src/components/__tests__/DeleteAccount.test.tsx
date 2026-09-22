/**
 * The in-app half of Apple Guideline 5.1.1(v). Deletion must be startable
 * inside the app, and until 2026-09-21 this product's only route was an email
 * to support — fine for Google Play's Data Safety rules, not for Apple's.
 *
 * Deletion is irreversible, so the behaviour under test is mostly about
 * refusing to do it: the destructive call must not be reachable by a stray
 * tap, and must not fire until the user has typed their own address.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import DeleteAccount from '../DeleteAccount';

const EMAIL = 'real@example.com';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
});
afterEach(() => { vi.unstubAllGlobals(); });

function open(onDeleted = () => {}) {
  const view = render(<DeleteAccount email={EMAIL} onDeleted={onDeleted} />);
  fireEvent.click(view.getByRole('button', { name: /delete (my )?account/i }));
  return view;
}

describe('DeleteAccount', () => {
  it('does not call the API from the first click — it opens a confirmation instead', () => {
    open();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('tells the user what will be removed before they confirm', () => {
    const { getByText } = open();
    // naming the consequences is the point of the step; a bare "are you sure?"
    // is not informed consent. Scoped to the emphasised phrase because the
    // parent paragraph matches the same text and an unscoped query is ambiguous.
    expect(getByText(/permanent and cannot be undone/i, { selector: 'strong' }))
      .toBeInTheDocument();
    expect(getByText(/subscription is cancelled/i)).toBeInTheDocument();
  });

  it('keeps confirmation disabled until the typed email matches exactly', () => {
    const { getByLabelText, getByRole } = open();
    const confirmBtn = getByRole('button', { name: /permanently delete/i });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(getByLabelText(/type your email/i), { target: { value: 'wrong@example.com' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(getByLabelText(/type your email/i), { target: { value: EMAIL } });
    expect(confirmBtn).toBeEnabled();
  });

  it('sends DELETE with the confirmation and reports success', async () => {
    const onDeleted = vi.fn();
    const { getByLabelText, getByRole } = open(onDeleted);
    fireEvent.change(getByLabelText(/type your email/i), { target: { value: EMAIL } });
    fireEvent.click(getByRole('button', { name: /permanently delete/i }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/account$/);
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ confirm: EMAIL });
    expect(init.credentials).toBe('include');
  });

  it('surfaces a server refusal instead of pretending the account is gone', async () => {
    (fetch as any).mockResolvedValue({
      ok: false, status: 400,
      json: async () => ({ error: 'Type your account email address exactly to confirm deletion.' }),
    });
    const onDeleted = vi.fn();
    const { getByLabelText, getByRole, findByRole } = open(onDeleted);
    fireEvent.change(getByLabelText(/type your email/i), { target: { value: EMAIL } });
    fireEvent.click(getByRole('button', { name: /permanently delete/i }));

    expect(await findByRole('alert')).toHaveTextContent(/exactly/i);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
