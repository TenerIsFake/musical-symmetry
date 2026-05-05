import { useState, useEffect } from 'react';

interface Sample {
  file: string;
  name: string;
  artist: string;
  description: string;
}

const SAMPLES: Sample[] = [
  { file: 'zappa-zomby-woof.mid', name: 'Zomby Woof', artist: 'Frank Zappa', description: 'Chromatic chaos meets structured polyrhythm' },
  { file: 'zappa-dog-breath.mid', name: 'Dog Breath Variations', artist: 'Frank Zappa', description: 'Unpredictable symmetry shifts in every bar' },
  { file: 'zappa-twenty-small-cigars.mid', name: 'Twenty Small Cigars', artist: 'Frank Zappa', description: 'Delicate jazz voicings with hidden symmetry' },
  { file: 'doors-riders-on-the-storm.mid', name: 'Riders on the Storm', artist: 'The Doors', description: 'Hypnotic Manzarek keyboard \u2014 sustained Z\u2082 symmetry' },
  { file: 'debussy-syrinx.mid', name: 'Syrinx', artist: 'Debussy', description: 'Solo flute \u2014 pure melodic contour, minimal harmony' },
  { file: 'ravel-bolero-ostinato.mid', name: 'Bol\u00e9ro (Ostinato)', artist: 'Ravel', description: 'Repetitive pattern \u2014 watch symmetry evolve with orchestration' },
  { file: 'freedom-rider.mid', name: 'Freedom Rider', artist: 'Original', description: 'Original composition \u2014 Traffic-inspired groove' },
  { file: 'stadium-rave.mid', name: 'Stadium Rave', artist: 'Original', description: 'EDM structure \u2014 high symmetry repetition' },
];

interface SampleSongsProps {
  onSelect: (file: File) => void;
  isLoading: boolean;
}

export default function SampleSongs({ onSelect, isLoading }: SampleSongsProps) {
  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  const handleClick = async (sample: Sample) => {
    if (isLoading) return;
    setLoadingFile(sample.file);
    try {
      const res = await fetch(`/samples/${sample.file}`);
      if (!res.ok) throw new Error(`Failed to fetch ${sample.file}`);
      const blob = await res.blob();
      const file = new File([blob], sample.file, { type: 'audio/midi' });
      onSelect(file);
    } catch {
      setLoadingFile(null);
    }
  };

  // Clear loading indicator when parent is no longer loading
  useEffect(() => {
    if (!isLoading && loadingFile) {
      setLoadingFile(null);
    }
  }, [isLoading, loadingFile]);

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">
        Sample Songs
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SAMPLES.map((sample) => {
          const isCurrent = loadingFile === sample.file && isLoading;
          return (
            <button
              key={sample.file}
              onClick={() => handleClick(sample)}
              disabled={isLoading}
              className={`
                text-left rounded-lg p-3 transition-colors
                ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-700'}
                ${isCurrent ? 'bg-gray-700 ring-1 ring-blue-500' : 'bg-gray-800'}
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-200 truncate">
                  {sample.name}
                </span>
                {isCurrent && (
                  <svg
                    className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
              </div>
              <div className="text-xs text-gray-400 mb-1">{sample.artist}</div>
              <div className="text-xs text-gray-500 line-clamp-2">{sample.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
