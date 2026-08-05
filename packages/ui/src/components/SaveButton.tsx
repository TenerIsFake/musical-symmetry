import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { API_BASE } from '../utils/apiBase';
import { isNativePlatform } from '../utils/platform';

type WorkspaceType = 'classifier' | 'analyzer' | 'progression';

interface Props {
  type: WorkspaceType;
  data: Record<string, unknown>;
  defaultName?: string;
}

const FREE_LIMIT = 3;

export default function SaveButton({ type, data, defaultName = '' }: Props) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error' | 'limit'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function openModal() {
    setName(defaultName);
    setStatus('idle');
    setErrorMsg('');
    setOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch(`${API_BASE}/api/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), type, data }),
      });
      if (res.ok) {
        setStatus('saved');
        setTimeout(() => { setStatus('idle'); setOpen(false); }, 1500);
      } else {
        const body = await res.json() as { error?: string; limit?: number };
        if (res.status === 403 && body.limit !== undefined) {
          setStatus('limit');
          setErrorMsg(body.error ?? 'Workspace limit reached.');
        } else {
          setStatus('error');
          setErrorMsg(body.error ?? 'Failed to save workspace.');
        }
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={user ? openModal : () => alert('Please sign in to save workspaces.')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded transition"
        title="Save workspace"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
        </svg>
        Save
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-5 w-80">
            <h3 className="text-sm font-semibold text-white mb-3">Save Workspace</h3>

            {status === 'limit' ? (
              <div className="text-center py-2">
                <p className="text-sm text-yellow-400 mb-2">{errorMsg}</p>
                <p className="text-xs text-gray-400 mb-4">
                  Free accounts can save up to {FREE_LIMIT} workspaces. Upgrade for unlimited saves.
                </p>
                {/* Play policy: no external purchase links inside the native app */}
                {isNativePlatform ? (
                  <p className="text-xs text-gray-400 mb-2">
                    Unlimited saves are available with a subscription on the web at symmetry.tendrid.us.
                  </p>
                ) : (
                  <a
                    href="https://symmetry.tendrid.us/pricing"
                    className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded"
                  >
                    Upgrade to Pro
                  </a>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="block mt-2 text-xs text-gray-500 hover:text-gray-300 mx-auto"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <label className="block text-xs text-gray-400 mb-1">Workspace name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="My workspace..."
                  className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded text-white mb-3 focus:outline-none focus:border-indigo-500"
                  maxLength={100}
                />

                {status === 'saved' && (
                  <p className="text-xs text-green-400 mb-2">Workspace saved!</p>
                )}
                {status === 'error' && (
                  <p className="text-xs text-red-400 mb-2">{errorMsg}</p>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !name.trim() || status === 'saved'}
                    className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition"
                  >
                    {saving ? 'Saving…' : status === 'saved' ? 'Saved!' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
