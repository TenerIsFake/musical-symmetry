import { useState } from 'react';
import { apiUrl } from '../utils/apiBase';

/**
 * In-app account deletion.
 *
 * Apple Guideline 5.1.1(v) requires that a user be able to start deleting
 * their account inside the app. Until 2026-09-21 this product's only route was
 * an email to support, which satisfies Google Play's Data Safety rules but not
 * Apple's — and is a poor answer to a GDPR erasure request in any case.
 *
 * The design is deliberately obstructive. The first click only opens a
 * confirmation; the destructive call needs the user to retype their own email
 * address. That is not ceremony: this is irreversible and cross-device, and a
 * stray tap on a phone should not be sufficient.
 */
export default function DeleteAccount({
  email,
  onDeleted,
}: {
  email: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/auth/account'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: typed.trim() }),
      });
      if (!res.ok) {
        // Never report success on a refusal — the account is still there and
        // the user needs to know why.
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Deletion failed (${res.status}). Your account is unchanged.`);
        return;
      }
      onDeleted();
    } catch {
      setError('Could not reach the server. Your account is unchanged.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded border border-red-500/60 text-red-300 hover:bg-red-500/10"
      >
        Delete my account
      </button>
    );
  }

  return (
    <div className="border border-red-500/60 rounded p-4 bg-red-950/20">
      <h4 className="font-semibold text-red-200 mb-2">Delete your account</h4>
      <p className="text-sm text-gray-300 mb-2">
        This is <strong>permanent and cannot be undone</strong>. We will remove your
        account, saved collections and workspaces, quiz and practice progress,
        classrooms and assignments you created, and any sketches — on every device.
      </p>
      <p className="text-sm text-gray-400 mb-3">
        An active subscription is cancelled as part of this.
      </p>

      <label htmlFor="confirm-email" className="block text-sm text-gray-300 mb-1">
        Type your email address to confirm
      </label>
      <input
        id="confirm-email"
        type="email"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={email}
        className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-100 mb-3"
      />

      {error && (
        <p role="alert" className="text-sm text-red-300 mb-3">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={remove}
          disabled={!matches || busy}
          className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? 'Deleting…' : 'Permanently delete'}
        </button>
        <button
          onClick={() => { setOpen(false); setTyped(''); setError(null); }}
          disabled={busy}
          className="px-4 py-2 rounded border border-gray-600 text-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
