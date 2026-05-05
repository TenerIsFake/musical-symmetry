import { useState } from 'react';

interface Props {
  file: File;
  sliceMode: string;
  minNotes: number;
}

export default function PdfExportButton({ file, sliceMode, minNotes }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sliceMode', sliceMode);
      formData.append('minNotes', String(minNotes));

      const res = await fetch('/api/report', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = 'Failed to generate report';
        try {
          const err = await res.json();
          errorMsg = err.error || errorMsg;
        } catch {}
        alert(errorMsg);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace(/\.[^.]+$/, '')}-analysis.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white text-sm rounded transition"
    >
      {loading ? 'Generating...' : 'Download PDF Report'}
    </button>
  );
}
