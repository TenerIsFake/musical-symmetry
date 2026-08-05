import { useState, useEffect } from 'react';
import { API_BASE } from '../utils/apiBase';

interface SetItem {
  pitchClasses: number[];
  label: string | null;
  notes: string | null;
}

interface CollectionDetail {
  slug: string;
  name: string;
  description: string | null;
  publishedAt: string;
  items: SetItem[];
}

interface ProfileCollectionData {
  username: string;
  displayName: string | null;
  collection: CollectionDetail;
}

interface Props {
  username: string;
  slug: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function pitchClassesToNotes(pcs: number[]): string {
  return pcs.map(p => NOTE_NAMES[p] ?? String(p)).join(', ');
}

function SetCard({ item }: { item: SetItem }) {
  const pcsParam = item.pitchClasses.join(',');
  const href = `#classifier?pcs=${pcsParam}`;

  return (
    <a
      href={href}
      className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors"
    >
      <div className="flex flex-wrap gap-1.5 mb-2">
        {item.pitchClasses.map(p => (
          <span
            key={p}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-700 text-white text-xs font-bold"
          >
            {p}
          </span>
        ))}
      </div>
      <p className="text-gray-300 text-sm font-medium">
        {item.label || pitchClassesToNotes(item.pitchClasses)}
      </p>
      {item.notes && (
        <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.notes}</p>
      )}
    </a>
  );
}

export default function PublicProfilePage({ username, slug }: Props) {
  const [data, setData] = useState<ProfileCollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`${API_BASE}/api/public/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`)
      .then(res => {
        if (res.status === 404) { setNotFound(true); return null; }
        return res.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username, slug]);

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-500">Loading collection…</div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-300 mb-2">Collection not found</h1>
        <p className="text-gray-500">
          <a
            href={`#u/${username}`}
            className="text-indigo-400 hover:text-indigo-300"
          >
            View all collections by {username}
          </a>
        </p>
        <a href="#home" className="mt-4 inline-block text-gray-600 hover:text-gray-400 text-sm">
          Go to Chrometria
        </a>
      </div>
    );
  }

  const { collection } = data;
  const displayName = data.displayName || username;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <a href={`#u/${username}`} className="hover:text-gray-300 transition-colors">
          {displayName}
        </a>
        <span className="mx-2">/</span>
        <span className="text-gray-300">{collection.name}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{collection.name}</h1>
        {collection.description && (
          <p className="text-gray-400 mt-2">{collection.description}</p>
        )}
        <p className="text-gray-500 text-sm mt-2">
          {collection.items.length} set{collection.items.length !== 1 ? 's' : ''} &middot; published {new Date(collection.publishedAt).toLocaleDateString()}
        </p>
      </header>

      {collection.items.length === 0 ? (
        <p className="text-gray-500">No sets in this collection.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collection.items.map((item, idx) => (
            <SetCard key={idx} item={item} />
          ))}
        </div>
      )}

      <footer className="mt-12 pt-6 border-t border-gray-800 text-center">
        <a href="#home" className="text-gray-600 hover:text-gray-400 text-xs">
          Powered by Chrometria
        </a>
      </footer>
    </div>
  );
}
