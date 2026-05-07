import { useState, useEffect } from 'react';

interface CollectionSummary {
  slug: string;
  name: string;
  description: string | null;
  itemCount: number;
  publishedAt: string;
}

interface ProfileData {
  username: string;
  displayName: string | null;
  collections: CollectionSummary[];
}

interface Props {
  username: string;
}

export default function PublicProfileIndexPage({ username }: Props) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/public/${encodeURIComponent(username)}`)
      .then(res => {
        if (res.status === 404) { setNotFound(true); return null; }
        return res.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-500">Loading profile…</div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-300 mb-2">Profile not found</h1>
        <p className="text-gray-500">No published collections for <span className="text-gray-300">{username}</span>.</p>
        <a href="#home" className="mt-6 inline-block text-indigo-400 hover:text-indigo-300 text-sm">
          Go to Chrometria
        </a>
      </div>
    );
  }

  const displayName = data.displayName || username;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{displayName}</h1>
        <p className="text-gray-400 mt-1 text-sm">
          {data.collections.length} published collection{data.collections.length !== 1 ? 's' : ''}
        </p>
      </header>

      {data.collections.length === 0 ? (
        <p className="text-gray-500">No published collections yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.collections.map(c => (
            <a
              key={c.slug}
              href={`#u/${username}/${c.slug}`}
              className="block bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors"
            >
              <h2 className="text-white font-semibold text-base mb-1">{c.name}</h2>
              {c.description && (
                <p className="text-gray-400 text-sm mb-2 line-clamp-2">{c.description}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-indigo-400 text-xs font-medium">
                  {c.itemCount} set{c.itemCount !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-500 text-xs">
                  {new Date(c.publishedAt).toLocaleDateString()}
                </span>
              </div>
            </a>
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
