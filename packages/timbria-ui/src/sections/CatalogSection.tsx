import { useEffect, useState } from 'react';
import { getJSON } from '../api';
import { WikiLink } from '../components/WikiLink';
interface Fx { id: number; name: string; category: string; fingerprint: string; tells: string; }
export function CatalogSection() {
  const [fx, setFx] = useState<Fx[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { getJSON<Fx[]>('/api/fx').then(setFx); }, []);
  const shown = fx.filter((f) => `${f.name} ${f.category} ${f.fingerprint} ${f.tells}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="section">
      <h2>Catalog</h2>
      <input placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="atlas-grid" style={{ marginTop: '.75rem' }}>
        {shown.map((f) => (
          <article className="card" key={f.id}>
            <header><strong>{f.name}</strong> <span className="mfr">{f.category}</span></header>
            <p className="fingerprint">{f.fingerprint}</p>
            {f.tells && <p className="tells"><em>Tells:</em> {f.tells}</p>}
            <footer><span className="meta" /><WikiLink name={f.name} /></footer>
          </article>
        ))}
      </div>
    </div>
  );
}
