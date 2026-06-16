import { useEffect, useMemo, useState } from 'react';
import { getJSON } from '../api';
import { WikiLink } from '../components/WikiLink';

interface Fx { id: number; name: string; category: string; fingerprint: string; tells: string; era: string; typical_use: string; }
interface Gear { id: number; name: string; fx_type_id: number; manufacturer: string; kind: string; }
interface Sound { id: number; name: string; description: string; chain: number[]; }

const EFFECT_CATS = ['reverb', 'dynamics', 'distortion', 'delay', 'modulation', 'eq', 'pitch'];
const EQUIP_KINDS = ['amp', 'mic', 'hardware', 'plugin'];
const INSTRUMENT_KINDS = ['instrument', 'synth'];
type Tab = 'fx' | 'equipment' | 'instruments' | 'sounds';

function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it); else m.set(k, [it]);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function AtlasSection() {
  const [fx, setFx] = useState<Fx[]>([]);
  const [gear, setGear] = useState<Gear[]>([]);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [tab, setTab] = useState<Tab>('fx');

  useEffect(() => {
    getJSON<Fx[]>('/api/fx').then(setFx).catch(() => setFx([]));
    getJSON<Gear[]>('/api/gear').then(setGear).catch(() => setGear([]));
    getJSON<Sound[]>('/api/sounds').then(setSounds).catch(() => setSounds([]));
  }, []);

  const fxById = useMemo(() => new Map(fx.map((f) => [f.id, f])), [fx]);
  const fxGroups = useMemo(() => groupBy(fx.filter((f) => EFFECT_CATS.includes(f.category)), (f) => f.category), [fx]);
  const equipGroups = useMemo(() => groupBy(gear.filter((g) => EQUIP_KINDS.includes(g.kind)), (g) => g.kind), [gear]);
  const instGroups = useMemo(() => groupBy(gear.filter((g) => INSTRUMENT_KINDS.includes(g.kind)), (g) => g.kind), [gear]);

  const gearGroups = tab === 'equipment' ? equipGroups : instGroups;

  return (
    <div className="atlas">
      <h2>Atlas</h2>
      <p className="atlas-sub">Browse Timbria's sound vocabulary — each entry links into your offline Wikipedia.</p>
      <div className="atlas-tabs">
        <button className={tab === 'fx' ? 'active' : ''} onClick={() => setTab('fx')}>FX &amp; Processing</button>
        <button className={tab === 'equipment' ? 'active' : ''} onClick={() => setTab('equipment')}>Equipment</button>
        <button className={tab === 'instruments' ? 'active' : ''} onClick={() => setTab('instruments')}>Instruments</button>
        <button className={tab === 'sounds' ? 'active' : ''} onClick={() => setTab('sounds')}>Sounds</button>
      </div>

      {tab === 'fx' && fxGroups.map(([cat, items]) => (
        <section key={cat} className="atlas-group">
          <h3 className="group-header">{cat} <span className="count">{items.length}</span></h3>
          <div className="atlas-grid">
            {items.map((f) => (
              <article className="card" key={f.id}>
                <header><strong>{f.name}</strong></header>
                <p className="fingerprint">{f.fingerprint}</p>
                {f.tells && <p className="tells"><em>Tells:</em> {f.tells}</p>}
                <footer><span className="meta">{[f.era, f.typical_use].filter(Boolean).join(' · ')}</span><WikiLink name={f.name} /></footer>
              </article>
            ))}
          </div>
        </section>
      ))}

      {(tab === 'equipment' || tab === 'instruments') && gearGroups.map(([kind, items]) => (
        <section key={kind} className="atlas-group">
          <h3 className="group-header">{kind} <span className="count">{items.length}</span></h3>
          <div className="atlas-grid">
            {items.map((g) => {
              const f = fxById.get(g.fx_type_id);
              return (
                <article className="card" key={g.id}>
                  <header><strong>{g.name}</strong> {g.manufacturer && <span className="mfr">{g.manufacturer}</span>}</header>
                  {f && <p className="implements">{f.name} <span className="cat">· {f.category}</span></p>}
                  {f?.fingerprint && <p className="tells">{f.fingerprint}</p>}
                  <footer><span className="meta">{g.kind}</span><WikiLink name={g.name} /></footer>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {tab === 'sounds' && (
        <section className="atlas-group">
          <h3 className="group-header">iconic sounds & song breakdowns <span className="count">{sounds.length}</span></h3>
          <div className="atlas-grid">
            {sounds.map((s) => (
              <article className="card" key={s.id}>
                <header><strong>{s.name}</strong></header>
                {s.description && <p className="fingerprint">{s.description}</p>}
                {s.chain?.length > 0 && (
                  <p className="chain">
                    {s.chain.map((id, i) => (
                      <span key={i}>
                        {i > 0 && <span className="arrow"> → </span>}
                        <span className="chain-link">{fxById.get(id)?.name ?? '?'}</span>
                      </span>
                    ))}
                  </p>
                )}
                <footer><span className="meta" /><WikiLink name={s.name} /></footer>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
