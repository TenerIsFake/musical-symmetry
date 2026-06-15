import { useEffect, useState } from 'react';
import { getJSON } from '../api';
interface Node { id: number; question: string; branches: { answer: string; next: number }[]; leaf_fx_type_ids: number[]; explanation: string; }
export function IdentifySection() {
  const [node, setNode] = useState<Node | null>(null);
  const [leafName, setLeafName] = useState<string>('');
  useEffect(() => { getJSON<{ root: Node }>('/api/identify/tree').then(r => setNode(r.root)); }, []);
  async function pick(next: number) {
    const n = await getJSON<Node>(`/api/identify/node/${next}`);
    setNode(n);
    if (n.leaf_fx_type_ids.length) {
      const fx = await getJSON<{ name: string }>(`/api/fx/${n.leaf_fx_type_ids[0]}`);
      setLeafName(fx.name);
    }
  }
  if (!node) return <p>Loading…</p>;
  if (node.leaf_fx_type_ids.length)
    return <div><h3>{leafName}</h3><p>{node.explanation}</p></div>;
  return (
    <div>
      <h3>{node.question}</h3>
      {node.branches.map(b => <button key={b.next} onClick={() => pick(b.next)}>{b.answer}</button>)}
    </div>
  );
}
