import { useState, useCallback } from 'react';

interface Props {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export default function FileUpload({ onUpload, isLoading }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  }, [onUpload]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        dragOver ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-600 hover:border-gray-500'
      }`}
    >
      {isLoading ? (
        <p className="text-gray-400 animate-pulse">Analyzing...</p>
      ) : (
        <>
          <p className="text-gray-300 mb-2">Drop a MIDI or MusicXML file here</p>
          <p className="text-gray-500 text-sm mb-4">or click to browse</p>
          <input
            type="file"
            accept=".mid,.midi,.xml,.musicxml"
            onChange={handleChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 rounded cursor-pointer text-sm font-medium"
          >
            Choose File
          </label>
        </>
      )}
    </div>
  );
}
