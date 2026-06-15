import { useEffect, useState } from 'react';
import { getJSON, postJSON } from '../api';
interface Draft { id: number; gear_name: string; context: string; source_url: string; confidence: string; }
export function ReviewSection() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const load = () => getJSON<Draft[]>('/api/review').then(setDrafts).catch(() => setDrafts([]));
  useEffect(() => { load(); }, []);
  const act = async (id: number, verb: string) => { await postJSON(`/api/review/${id}/${verb}`, {}); load(); };
  return (<div><h2>Review</h2>{drafts.length === 0 ? <p>Nothing pending.</p> : drafts.map(d => (
    <div key={d.id}>{d.gear_name} ({d.context}) — <a href={d.source_url}>src</a> [{d.confidence}]
      <button onClick={() => act(d.id, 'approve')}>Approve</button>
      <button onClick={() => act(d.id, 'reject')}>Reject</button></div>))}</div>);
}
