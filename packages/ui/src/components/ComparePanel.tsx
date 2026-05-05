import { useState, useMemo } from 'react';
import type { PitchClass, SymmetryAnalysis } from '@musical-symmetry/core';
import { classify, NOTE_NAMES, generalizedVoiceLeading, identifyChord } from '@musical-symmetry/core';
import { GROUP_DESCRIPTIONS } from '../data/group-descriptions';
import { useResearchMode } from '../context/ResearchMode';

interface Props {
  currentPCs: PitchClass[];
  currentAnalysis: SymmetryAnalysis | null;
}

const COMPARE_PRESETS: { name: string; pcs: PitchClass[] }[] = [
  { name: 'C major', pcs: [0, 4, 7] },
  { name: 'C minor', pcs: [0, 3, 7] },
  { name: 'A minor', pcs: [9, 0, 4] },
  { name: 'G major', pcs: [7, 11, 2] },
  { name: 'F major', pcs: [5, 9, 0] },
  { name: 'Dim7', pcs: [0, 3, 6, 9] },
  { name: 'Aug', pcs: [0, 4, 8] },
  { name: 'Dom7', pcs: [0, 4, 7, 10] },
  { name: 'Whole-tone', pcs: [0, 2, 4, 6, 8, 10] },
  { name: 'Chromatic cluster', pcs: [0, 1, 2, 3, 4, 5] },
];

function SetDisplay({ pcs, analysis, label }: { pcs: PitchClass[]; analysis: SymmetryAnalysis; label: string }) {
  const { researchMode } = useResearchMode();
  const chord = useMemo(() => pcs.length === 3 ? identifyChord(pcs) : null, [pcs]);
  const desc = GROUP_DESCRIPTIONS[analysis.abstractGroup];

  return (
    <div className="flex-1 bg-gray-900 rounded p-3">
      <div className="text-xs text-gray-500 uppercase mb-1">{label}</div>
      <div className="text-sm font-mono text-white mb-1">
        {pcs.map(pc => NOTE_NAMES[pc]).join(', ')}
      </div>
      {chord && (
        <div className="text-base font-bold text-white mb-2">
          {NOTE_NAMES[chord.root]} {chord.quality}
        </div>
      )}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Group</span>
          <span className="text-blue-300 font-mono">{analysis.abstractGroup}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Stabilizer</span>
          <span className="text-blue-300 font-mono">{analysis.stabilizerOrder}</span>
        </div>
        {researchMode && (
          <>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Mulliken</span>
              <span className="text-blue-300 font-mono">{analysis.mullikenLabel}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">IV</span>
              <span className="text-blue-300 font-mono">[{analysis.intervalVector.join(',')}]</span>
            </div>
          </>
        )}
      </div>
      {desc && (
        <p className="text-xs text-gray-400 mt-2 italic">{desc.feel}</p>
      )}
    </div>
  );
}

export default function ComparePanel({ currentPCs, currentAnalysis }: Props) {
  const [comparePCs, setComparePCs] = useState<PitchClass[] | null>(null);

  const compareAnalysis = useMemo(() => {
    if (!comparePCs || comparePCs.length < 2) return null;
    return classify(comparePCs);
  }, [comparePCs]);

  const vlDistance = useMemo(() => {
    if (!currentPCs.length || !comparePCs?.length) return null;
    if (currentPCs.length > 8 || comparePCs.length > 8) return null;
    return generalizedVoiceLeading(currentPCs, comparePCs);
  }, [currentPCs, comparePCs]);

  if (!currentAnalysis || currentPCs.length < 2) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Compare</h2>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {COMPARE_PRESETS.map(preset => (
          <button
            key={preset.name}
            onClick={() => setComparePCs(preset.pcs as PitchClass[])}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              comparePCs && [...preset.pcs].sort((a, b) => a - b).join(',') === [...comparePCs].sort((a, b) => a - b).join(',')
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {preset.name}
          </button>
        ))}
        {comparePCs && (
          <button
            onClick={() => setComparePCs(null)}
            className="px-2 py-0.5 rounded text-xs font-medium bg-gray-600 text-gray-300 hover:bg-gray-500"
          >
            Clear
          </button>
        )}
      </div>

      {comparePCs && compareAnalysis && (
        <>
          <div className="flex gap-3 mb-3">
            <SetDisplay pcs={currentPCs} analysis={currentAnalysis} label="Current" />
            <SetDisplay pcs={comparePCs} analysis={compareAnalysis} label="Compare" />
          </div>

          <div className="bg-gray-900 rounded p-3 text-center">
            <div className="text-xs text-gray-500 uppercase mb-1">Voice-Leading Distance</div>
            <div className="text-2xl font-bold text-white">
              {vlDistance !== null ? vlDistance : '—'}
              <span className="text-sm text-gray-400 ml-1">semitones</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {vlDistance === 0 && 'Identical sets'}
              {vlDistance === 1 && 'One semitone move — maximally parsimonious (PLR-type)'}
              {vlDistance === 2 && 'Two semitones — very smooth transition'}
              {vlDistance !== null && vlDistance >= 3 && vlDistance <= 4 && 'Moderate motion — noticeable harmonic shift'}
              {vlDistance !== null && vlDistance > 4 && 'Large leap — dramatic harmonic change'}
            </div>

            {currentAnalysis.abstractGroup !== compareAnalysis.abstractGroup && (
              <div className="mt-2 text-xs">
                <span className="text-purple-400">
                  {currentAnalysis.abstractGroup} → {compareAnalysis.abstractGroup}
                </span>
                {' '}
                <span className="text-gray-500">
                  (symmetry {currentAnalysis.stabilizerOrder < compareAnalysis.stabilizerOrder ? 'increases' : 'decreases'})
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
