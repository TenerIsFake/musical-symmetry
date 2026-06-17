import { useState } from 'react';

interface Label { label: string; confidence: number; }
interface Result { domain: string; instruments: Label[]; effects: Label[]; mood: Label[]; fxTypeIds: number[]; }

function Group({ title, items }: { title: string; items: Label[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4>{title}</h4>
      <ul>{items.map((l) => <li key={l.label}>{l.label} — {(l.confidence * 100).toFixed(0)}%</li>)}</ul>
    </div>
  );
}

export function IdentifyByEar() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canRecord = typeof window !== 'undefined' && typeof (window as any).MediaRecorder !== 'undefined';
  const [recording, setRecording] = useState(false);

  async function identify() {
    if (!file) { setError('Choose or record a clip first.'); return; }
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('clip', file);
      const res = await fetch('/api/identify/by-ear', { method: 'POST', body: fd });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      setResult(await res.json());
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function record() {
    if (!canRecord) return;
    setError('');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      setFile(new File([blob], 'recording.webm', { type: blob.type }));
      setRecording(false);
    };
    rec.start();
    setRecording(true);
    setTimeout(() => rec.stop(), 5000);
  }

  return (
    <div className="identify-by-ear">
      <h3>Identify by Ear</h3>
      <label>Upload a clip
        <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <button onClick={record} disabled={!canRecord || recording}>{recording ? 'Recording…' : 'Record 5s'}</button>
      <button onClick={identify} disabled={busy}>{busy ? 'Listening…' : 'Identify'}</button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div>
          <Group title="Instruments" items={result.instruments} />
          <Group title="Effects" items={result.effects} />
          <Group title="Mood (beta)" items={result.mood} />
        </div>
      )}
    </div>
  );
}
