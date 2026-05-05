import type { ReactNode } from 'react';
import type { SymmetryAnalysis, Chord } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { GROUP_DESCRIPTIONS } from '../data/group-descriptions';
import { forteNumber } from '../data/forte-numbers';
import { useResearchMode } from '../context/ResearchMode';
import Tooltip from './Tooltip';

interface MoleculeAnalog {
  molecule: string;
  formula: string;
  pointGroup: string;
  description: string;
}

const GROUP_TO_MOLECULE: Record<string, MoleculeAnalog> = {
  C1: { molecule: 'CHFClBr', formula: 'CHFClBr', pointGroup: 'C₁', description: 'Bromochlorofluoromethane — no symmetry at all' },
  Z2: { molecule: 'H₂O₂', formula: 'H₂O₂', pointGroup: 'C₂', description: 'Hydrogen peroxide — one C₂ rotation axis' },
  C2: { molecule: 'H₂O₂', formula: 'H₂O₂', pointGroup: 'C₂', description: 'Hydrogen peroxide — one C₂ rotation axis' },
  C3: { molecule: 'PPh₃', formula: 'P(C₆H₅)₃', pointGroup: 'C₃', description: 'Triphenylphosphine — propeller-like 3-fold axis' },
  C4: { molecule: '[4]Cumulene', formula: 'H₂C=C=C=CH₂', pointGroup: 'C₄', description: 'Butatriene — 4-fold rotation, no mirrors' },
  C6: { molecule: 'Coronene (twisted)', formula: 'C₂₄H₁₂', pointGroup: 'C₆', description: '6-fold rotation without vertical mirrors' },
  D2: { molecule: 'Biphenyl (90°)', formula: 'C₁₂H₁₀', pointGroup: 'D₂', description: 'Twisted biphenyl — three C₂ axes' },
  D3: { molecule: 'B(OH)₃', formula: 'B(OH)₃', pointGroup: 'C₃ₕ', description: 'Boric acid — trigonal planar with mirror' },
  D4: { molecule: 'XeF₄', formula: 'XeF₄', pointGroup: 'D₄ₕ', description: 'Xenon tetrafluoride — square planar' },
  D6: { molecule: 'Benzene', formula: 'C₆H₆', pointGroup: 'D₆ₕ', description: 'Benzene — the iconic 6-fold symmetric molecule' },
  D12: { molecule: 'Atom', formula: '(sphere)', pointGroup: 'K_h', description: 'Full spherical symmetry — like a lone atom' },
};

interface Props {
  analysis: SymmetryAnalysis | null;
  chord: Chord | null;
}

function PropertyBadge({ label, value }: { label: ReactNode; value: string | boolean }) {
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  const colorClass = typeof value === 'boolean'
    ? value ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
    : 'bg-blue-900 text-blue-300';

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`px-2 py-0.5 rounded text-xs font-mono ${colorClass}`}>
        {displayValue}
      </span>
    </div>
  );
}

export default function ClassificationPanel({ analysis, chord }: Props) {
  const { researchMode } = useResearchMode();

  if (!analysis) {
    return (
      <div className="bg-gray-800 rounded-lg p-4" role="region" aria-label="Classification results" aria-live="polite">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Classification</h2>
        <p className="text-gray-500 text-sm italic">Select at least 2 pitch classes to analyze</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4" role="region" aria-label="Classification results" aria-live="polite">
      <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Classification</h2>

      {chord && (
        <div className="mb-3 pb-3 border-b border-gray-700">
          <span className="text-lg font-bold text-white">
            {NOTE_NAMES[chord.root]} {chord.quality}
          </span>
        </div>
      )}

      {GROUP_DESCRIPTIONS[analysis.abstractGroup] && (
        <div className="mb-3 pb-3 border-b border-gray-700 space-y-1">
          <p className="text-sm text-gray-200">{GROUP_DESCRIPTIONS[analysis.abstractGroup]!.musical}</p>
          <p className="text-xs text-gray-400 italic">{GROUP_DESCRIPTIONS[analysis.abstractGroup]!.feel}</p>
        </div>
      )}

      <div className="space-y-1">
        <PropertyBadge label={<Tooltip text="The abstract algebraic group describing this chord's symmetry under the dihedral group D&#x2081;&#x2082;">Symmetry Group</Tooltip>} value={analysis.abstractGroup} />
        <PropertyBadge label={<Tooltip text="Whether the notes are as evenly spaced around the octave as possible">Maximally Even</Tooltip>} value={analysis.maximallyEven} />
        {researchMode && (
          <>
            {forteNumber(analysis.pitchClasses) && (
              <PropertyBadge label={<Tooltip text="Allen Forte's catalog number for this set class">Forte Number</Tooltip>} value={forteNumber(analysis.pitchClasses)!} />
            )}
            <PropertyBadge label={<Tooltip text="Classification label from molecular spectroscopy, adapted for pitch-class sets">Mulliken Label</Tooltip>} value={analysis.mullikenLabel} />
            <PropertyBadge label={<Tooltip text="Counts of each interval class (half-steps through tritones) in the set">Interval Vector</Tooltip>} value={`[${analysis.intervalVector.join(', ')}]`} />
            <PropertyBadge label={<Tooltip text="Number of D&#x2081;&#x2082; operations that map this chord to itself">Stabilizer Order</Tooltip>} value={String(analysis.stabilizerOrder)} />
            <PropertyBadge label="Distinct Transpositions" value={String(analysis.distinctTranspositions)} />
            <PropertyBadge label={<Tooltip text="Whether every generic interval comes in exactly two specific sizes">Myhill Property</Tooltip>} value={analysis.myhillProperty} />
            <PropertyBadge label="Palindromic" value={analysis.isRetrogradePalindrome} />
          </>
        )}
      </div>

      {researchMode && analysis.characterTableEntry && Object.keys(analysis.characterTableEntry).length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Character Table</h3>
          <div className="grid grid-cols-2 gap-1 text-xs font-mono">
            {Object.entries(analysis.characterTableEntry).map(([op, val]) => (
              <div key={op} className="flex justify-between bg-gray-900 px-2 py-1 rounded">
                <span className="text-gray-400">{op}</span>
                <span className={val === 1 ? 'text-green-400' : 'text-red-400'}>
                  {val === 1 ? '+1' : '-1'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {GROUP_TO_MOLECULE[analysis.abstractGroup] && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Molecular Analog</h3>
          <div className="bg-gray-900 rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-medium">
                {GROUP_TO_MOLECULE[analysis.abstractGroup]!.molecule}
              </span>
              <span className="text-xs font-mono text-indigo-400">
                {GROUP_TO_MOLECULE[analysis.abstractGroup]!.pointGroup}
              </span>
            </div>
            <p className="text-gray-400 text-xs">
              {GROUP_TO_MOLECULE[analysis.abstractGroup]!.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
