import { useState } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

interface Props {
  onSetPCs: (pcs: PitchClass[]) => void;
}

const NAME_TO_PC: Record<string, PitchClass> = {
  c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5,
  'f#': 6, gb: 6, g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11,
};

function parseInput(input: string): PitchClass[] | null {
  const trimmed = input.trim().toLowerCase();

  const setMatch = trimmed.match(/[{\[]([\d,\s]+)[}\]]/);
  if (setMatch) {
    const nums = setMatch[1]!.split(',').map(s => parseInt(s.trim()));
    if (nums.every(n => n >= 0 && n <= 11)) {
      return nums as PitchClass[];
    }
  }

  const parts = trimmed.split(/[\s,]+/).filter(Boolean);
  if (parts.length > 0 && parts.every(p => p in NAME_TO_PC)) {
    return parts.map(p => NAME_TO_PC[p]!);
  }

  return null;
}

export default function TextInput({ onSetPCs }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    const result = parseInput(value);
    if (result) {
      onSetPCs(result);
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Text Input</h2>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="C E G  or  {0,4,7}"
          className={`flex-1 px-3 py-1.5 rounded bg-gray-900 border text-sm font-mono
            ${error ? 'border-red-500' : 'border-gray-600'} focus:outline-none focus:border-indigo-500`}
        />
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 text-sm font-medium"
        >
          Set
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1">Invalid input. Use note names or pc-set notation.</p>}
    </div>
  );
}
