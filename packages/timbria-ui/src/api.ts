const base = '';
export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(base + path, { credentials: 'include' });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}
export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(base + path, { method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}
