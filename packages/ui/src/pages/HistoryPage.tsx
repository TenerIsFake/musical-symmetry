import { useState, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { useHistory } from '../hooks/useHistory';
import { API_BASE } from '../utils/apiBase';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function parsePcs(raw: string): number[] {
  try { return JSON.parse(raw); } catch { return []; }
}

const NOTE_NAMES: Record<number, string> = {
  0:'C', 1:'C#', 2:'D', 3:'Eb', 4:'E', 5:'F',
  6:'F#', 7:'G', 8:'Ab', 9:'A', 10:'Bb', 11:'B',
};

function PcsDisplay({ raw }: { raw: string }) {
  const pcs = parsePcs(raw);
  const label = pcs.map(n => NOTE_NAMES[n] ?? n).join(', ');
  return <span>{label}</span>;
}

interface TagEditorProps {
  current: string;
  onSave: (tags: string) => void;
}

function TagEditor({ current, onSave }: TagEditorProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-gray-500 hover:text-gray-300"
        title="Edit tags"
      >
        {current ? current : '+ tags'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <input
        className="text-xs bg-gray-700 rounded px-2 py-1 text-gray-200 border border-gray-600 focus:outline-none focus:border-indigo-500"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="tag1, tag2"
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(val); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
      />
      <button
        onClick={() => { onSave(val); setEditing(false); }}
        className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-500"
      >
        Save
      </button>
    </div>
  );
}

export default function HistoryPage() {
  const { user, loading: userLoading } = useUser();
  const [search, setSearch] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [activeSearch, setActiveSearch] = useState('');

  const { entries, loading, error, refresh, toggleBookmark, deleteEntry, updateTags } = useHistory(
    !!user,
    {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      search: activeSearch || undefined,
      bookmarkedOnly,
    }
  );

  const handleSearch = useCallback(() => {
    setActiveSearch(search);
    setPage(0);
  }, [search]);

  const handleCsvExport = useCallback(() => {
    window.open(`${API_BASE}/api/history/export.csv`, '_blank');
  }, []);

  const handleRestoreEntry = useCallback((pitchClassesRaw: string) => {
    const pcs = parsePcs(pitchClassesRaw);
    if (pcs.length > 0) {
      window.location.hash = `#classifier?pcs=${pcs.join(',')}`;
    }
  }, []);

  if (userLoading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Sign in to view your analysis history.</p>
        <a href="#dashboard" className="text-indigo-400 hover:text-indigo-300 underline">
          Go to Dashboard
        </a>
      </div>
    );
  }

  const allTags = Array.from(
    new Set(
      entries.flatMap(e => e.tags ? e.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
    )
  );

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-gray-800 rounded-lg p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48 flex gap-2">
          <input
            type="text"
            placeholder="Search forte, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 bg-indigo-600 rounded text-sm text-white hover:bg-indigo-500 transition-colors"
          >
            Search
          </button>
        </div>

        <button
          onClick={() => { setBookmarkedOnly(!bookmarkedOnly); setPage(0); }}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            bookmarkedOnly ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {bookmarkedOnly ? '★ Bookmarked' : '☆ All'}
        </button>

        {user.tier === 'research' && (
          <button
            onClick={handleCsvExport}
            className="px-3 py-1.5 bg-purple-700 rounded text-sm text-white hover:bg-purple-600 transition-colors"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => { setSearch(tag); setActiveSearch(tag); setPage(0); }}
              className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full text-xs hover:bg-gray-600 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Free-tier notice */}
      {user.tier === 'free' && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-400">
          Free tier shows the last 7 days of history plus all bookmarked entries.{' '}
          <a href="#dashboard" className="text-indigo-400 hover:text-indigo-300 underline">Upgrade to Pro</a>{' '}
          for full history access.
        </div>
      )}

      {/* Entry list */}
      {loading && (
        <div className="text-center py-8 text-gray-500">Loading history...</div>
      )}

      {error && (
        <div className="text-center py-8 text-red-400">{error}</div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {activeSearch || bookmarkedOnly
            ? 'No entries match your filter.'
            : 'No analysis history yet. Use the Classifier to get started.'}
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="bg-gray-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleRestoreEntry(entry.pitch_classes)}
                    className="text-sm font-semibold text-white hover:text-indigo-300 transition-colors text-left"
                    title="Re-open in classifier"
                  >
                    <PcsDisplay raw={entry.pitch_classes} />
                  </button>
                  {entry.forte && (
                    <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded">
                      {entry.forte}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 capitalize">{entry.type}</span>
                </div>

                {entry.interval_vector && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    IV: {(() => {
                      try {
                        const iv = JSON.parse(entry.interval_vector);
                        return Array.isArray(iv) ? `<${iv.join('')}>` : entry.interval_vector;
                      } catch { return entry.interval_vector; }
                    })()}
                  </div>
                )}

                <div className="mt-1">
                  <TagEditor
                    current={entry.tags}
                    onSave={tags => updateTags(entry.id, tags)}
                  />
                </div>

                <div className="text-xs text-gray-600 mt-1">{formatDate(entry.created_at)}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleBookmark(entry.id)}
                  className={`text-lg transition-colors ${
                    entry.bookmarked ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-600 hover:text-yellow-400'
                  }`}
                  title={entry.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                >
                  {entry.bookmarked ? '★' : '☆'}
                </button>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-sm"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && entries.length > 0 && (
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-gray-700 rounded text-sm text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={entries.length < PAGE_SIZE}
            className="px-4 py-2 bg-gray-700 rounded text-sm text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
