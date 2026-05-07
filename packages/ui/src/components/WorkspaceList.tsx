import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';

type WorkspaceType = 'classifier' | 'analyzer' | 'progression';

interface WorkspaceSummary {
  id: string;
  name: string;
  type: WorkspaceType;
  created_at: string;
  updated_at: string;
}

interface WorkspaceData {
  id: string;
  name: string;
  type: WorkspaceType;
  data: Record<string, unknown>;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  onLoad: (workspace: WorkspaceData) => void;
  filterType?: WorkspaceType;
}

const TYPE_LABELS: Record<WorkspaceType, string> = {
  classifier: 'Classifier',
  analyzer: 'Analyzer',
  progression: 'Progression',
};

const TYPE_COLORS: Record<WorkspaceType, string> = {
  classifier: 'bg-blue-900 text-blue-300',
  analyzer: 'bg-purple-900 text-purple-300',
  progression: 'bg-green-900 text-green-300',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function WorkspaceList({ onLoad, filterType }: Props) {
  const { user } = useUser();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchWorkspaces = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/workspaces', { credentials: 'include' });
      if (res.ok) {
        const body = await res.json() as { workspaces: WorkspaceSummary[] };
        setWorkspaces(body.workspaces);
      }
    } catch {
      setError('Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  async function handleLoad(id: string) {
    try {
      const res = await fetch(`/api/workspaces/${id}`, { credentials: 'include' });
      if (!res.ok) { setError('Failed to load workspace.'); return; }
      const body = await res.json() as { workspace: WorkspaceData };
      onLoad(body.workspace);
    } catch {
      setError('Failed to load workspace.');
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setWorkspaces(prev => prev.filter(w => w.id !== id));
        setConfirmDelete(null);
      } else {
        setError('Failed to delete workspace.');
      }
    } catch {
      setError('Failed to delete workspace.');
    }
  }

  async function handleShare(id: string) {
    setSharing(id);
    try {
      const res = await fetch(`/api/workspaces/${id}/share`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const body = await res.json() as { shareToken: string; shareUrl: string };
        const fullUrl = `${window.location.origin}${body.shareUrl}`;
        setShareLinks(prev => ({ ...prev, [id]: fullUrl }));
        await navigator.clipboard.writeText(fullUrl).catch(() => undefined);
      } else {
        setError('Failed to generate share link.');
      }
    } catch {
      setError('Failed to generate share link.');
    } finally {
      setSharing(null);
    }
  }

  if (!user) return null;

  const visible = filterType ? workspaces.filter(w => w.type === filterType) : workspaces;

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-sm text-gray-500">Loading workspaces…</p>
      </div>
    );
  }

  if (visible.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Saved Workspaces</h2>

      {error && (
        <p className="text-xs text-red-400 mb-2">{error}</p>
      )}

      <div className="space-y-2">
        {visible.map(w => (
          <div key={w.id} className="group flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-750 transition">
            <button
              onClick={() => handleLoad(w.id)}
              className="flex-1 flex items-center gap-2 text-left min-w-0"
            >
              <span className={`shrink-0 px-1.5 py-0.5 text-xs rounded font-medium ${TYPE_COLORS[w.type]}`}>
                {TYPE_LABELS[w.type]}
              </span>
              <span className="text-sm text-gray-200 truncate">{w.name}</span>
              <span className="ml-auto shrink-0 text-xs text-gray-500">
                {formatDate(w.updated_at)}
              </span>
            </button>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {user.tier === 'research' && (
                <button
                  onClick={() => handleShare(w.id)}
                  disabled={sharing === w.id}
                  className="p-1 text-gray-500 hover:text-indigo-400 transition"
                  title={shareLinks[w.id] ? 'Link copied!' : 'Generate share link'}
                >
                  {shareLinks[w.id] ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-400">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
                    </svg>
                  )}
                </button>
              )}

              {confirmDelete === w.id ? (
                <>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="px-2 py-0.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-300"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(w.id)}
                  className="p-1 text-gray-500 hover:text-red-400 transition"
                  title="Delete workspace"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
