import { useEffect, useState } from 'react';
import { getJSON } from '../api';
interface Fx { id: number; name: string; category: string; fingerprint: string; tells: string; }
export function CatalogSection() {
  const [fx, setFx] = useState<Fx[]>([]);
  useEffect(() => { getJSON<Fx[]>('/api/fx').then(setFx); }, []);
  return (<div><h2>Catalog</h2>{fx.map(f => (
    <div key={f.id}><strong>{f.name}</strong> <em>{f.category}</em><p>{f.fingerprint}</p>
    <small>Tells: {f.tells}</small></div>))}</div>);
}
