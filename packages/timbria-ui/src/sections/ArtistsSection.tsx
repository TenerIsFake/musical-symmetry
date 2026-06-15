import { useState } from 'react';
import { getJSON, postJSON } from '../api';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { WikiLink } from '../components/WikiLink';
interface Line { id: number; gear_name: string; context: string; source_url: string; confidence: string; status: string; }
export function ArtistsSection() {
  const [name, setName] = useState(''); const [prof, setProf] = useState<{ artist: { name: string }; gear: Line[] } | null>(null);
  const [err, setErr] = useState('');
  async function search() {
    setErr('');
    try { setProf(await getJSON(`/api/artists/${encodeURIComponent(name)}`)); }
    catch { setProf(null); setErr('No sourced gear found yet for that artist.'); }
  }
  return (<div className="section"><h2>Artists</h2>
    <input placeholder="Artist name" value={name} onChange={e => setName(e.target.value)} />
    <button onClick={search}>Search</button>
    {err && <p>{err}</p>}
    {err && <button onClick={async () => { await postJSON(`/api/artists/${encodeURIComponent(name)}/lookup`, {}); search(); }}>Look it up</button>}
    {prof && prof.gear.map(g => (<div key={g.id} style={{ padding: '.3rem 0', borderBottom: '1px solid var(--line)' }}>
      <strong>{g.gear_name}</strong> <em>{g.context}</em> — <ConfidenceBadge confidence={g.confidence} status={g.status} />
      {' '}<a href={g.source_url} target="_blank" rel="noreferrer">source</a>
      {' '}<WikiLink name={g.gear_name} /></div>))}
  </div>);
}
