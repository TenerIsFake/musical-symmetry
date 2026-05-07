import { useState, useCallback } from 'react';
import {
  evaluateChain,
  operationLabel,
  randomChain,
  NOTE_NAMES,
} from '@musical-symmetry/core';
import type { PitchClass, Operation, ChainStep } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { playChordProgression } from '../utils/audio';

// ---- Constants ----

const ALL_PCS: PitchClass[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const FREE_MAX_CHAIN = 4;
const PRO_MAX_CHAIN = 24;

// ---- Helpers ----

function parseSeedInput(raw: string): PitchClass[] | null {
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const result: PitchClass[] = [];
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (isNaN(n) || n < 0 || n > 11) return null;
    result.push(n as PitchClass);
  }
  if (result.length === 0) return null;
  return result;
}

function pcsDisplay(pcs: PitchClass[]): string {
  return pcs.map(pc => NOTE_NAMES[pc]).join(' ');
}

// ---- Sub-components ----

function PianoKey({
  pc,
  active,
  onClick,
}: {
  pc: PitchClass;
  active: boolean;
  onClick: () => void;
}) {
  const isBlack = [1, 3, 6, 8, 10].includes(pc);
  return (
    <button
      onClick={onClick}
      title={NOTE_NAMES[pc]}
      className={`
        relative flex items-end justify-center pb-1 text-xs font-bold select-none transition-colors
        ${isBlack
          ? `w-6 h-14 -mx-3 z-10 rounded-b
             ${active ? 'bg-indigo-500 text-white' : 'bg-gray-900 text-gray-500 hover:bg-gray-700'}`
          : `w-8 h-20 rounded-b border border-gray-600
             ${active ? 'bg-indigo-400 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
        }
      `}
    >
      {active ? NOTE_NAMES[pc] : ''}
    </button>
  );
}

function PianoKeyboard({
  selected,
  onToggle,
}: {
  selected: Set<PitchClass>;
  onToggle: (pc: PitchClass) => void;
}) {
  // Render white keys with black keys overlaid
  const whiteKeys: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];
  const blackKeys: PitchClass[] = [1, 3, 6, 8, 10];
  // Positions for black keys between white keys (in white-key units)
  const blackPositions: Record<number, number> = { 1: 0.6, 3: 1.6, 6: 3.6, 8: 4.6, 10: 5.6 };

  return (
    <div className="relative flex" style={{ height: '5rem' }}>
      {/* White keys */}
      {whiteKeys.map((pc) => (
        <button
          key={pc}
          onClick={() => onToggle(pc)}
          title={NOTE_NAMES[pc]}
          className={`
            relative w-8 h-20 border border-gray-600 rounded-b flex items-end justify-center pb-1 text-xs font-bold select-none transition-colors
            ${selected.has(pc) ? 'bg-indigo-400 text-white border-indigo-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
          `}
        >
          {NOTE_NAMES[pc]}
        </button>
      ))}
      {/* Black keys overlaid */}
      {blackKeys.map((pc) => {
        const pos = blackPositions[pc]!;
        return (
          <button
            key={pc}
            onClick={() => onToggle(pc)}
            title={NOTE_NAMES[pc]}
            style={{ position: 'absolute', left: `${pos * 32}px`, top: 0, zIndex: 10 }}
            className={`
              w-6 h-14 rounded-b flex items-end justify-center pb-1 text-xs font-bold select-none transition-colors
              ${selected.has(pc) ? 'bg-indigo-500 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-700'}
            `}
          >
            {selected.has(pc) ? NOTE_NAMES[pc] : ''}
          </button>
        );
      })}
    </div>
  );
}

function OpButton({
  label,
  onClick,
  disabled,
  variant = 'default',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'plr' | 'danger';
}) {
  const colors =
    variant === 'plr'
      ? 'bg-purple-700 hover:bg-purple-600 text-white'
      : variant === 'danger'
      ? 'bg-red-800 hover:bg-red-700 text-white'
      : 'bg-gray-700 hover:bg-gray-600 text-gray-200';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded text-xs font-mono font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colors}`}
    >
      {label}
    </button>
  );
}

function ChainNode({
  label,
  pcs,
  chordName,
  commonTones,
  isFirst,
}: {
  label: string;
  pcs: PitchClass[];
  chordName: string | null;
  commonTones: PitchClass[];
  isFirst: boolean;
}) {
  const commonSet = new Set(commonTones);
  return (
    <div className="flex flex-col items-center min-w-[80px]">
      {!isFirst && (
        <div className="text-xs font-mono text-indigo-400 mb-1 whitespace-nowrap">{label}</div>
      )}
      <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-center">
        <div className="flex gap-1 flex-wrap justify-center mb-1">
          {pcs.map(pc => (
            <span
              key={pc}
              className={`text-xs font-mono px-1 rounded ${
                commonSet.has(pc) ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              {NOTE_NAMES[pc]}
            </span>
          ))}
        </div>
        {chordName && (
          <div className="text-xs text-yellow-400 font-semibold mt-1">{chordName}</div>
        )}
      </div>
    </div>
  );
}

function ChainEdge({ step }: { step: ChainStep }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 shrink-0">
      <div className="text-indigo-400 text-lg">→</div>
      <div className="text-xs text-gray-500 whitespace-nowrap">
        VL: {step.vlDistance}
      </div>
    </div>
  );
}

// ---- Main component ----

export default function TransformChainPage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';
  const isPro = tier === 'pro' || tier === 'research';
  const maxChain = isPro ? PRO_MAX_CHAIN : FREE_MAX_CHAIN;

  // Seed state
  const [selectedPcs, setSelectedPcs] = useState<Set<PitchClass>>(new Set([0, 4, 7] as PitchClass[]));
  const [seedText, setSeedText] = useState('0,4,7');
  const [seedError, setSeedError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'keyboard' | 'text'>('keyboard');

  // Chain state
  const [operations, setOperations] = useState<Operation[]>([]);

  // Derived seed
  const seed: PitchClass[] = Array.from(selectedPcs).sort((a, b) => a - b) as PitchClass[];
  const seedChordName = (() => {
    // We'll compute this from steps if chain is non-empty, otherwise just show the seed
    return null;
  })();

  // Evaluated chain
  const steps: ChainStep[] = evaluateChain(seed, operations);
  const finalPcs = steps.length > 0 ? steps[steps.length - 1]!.outputPcs : seed;

  // Seed input handlers
  const togglePc = useCallback((pc: PitchClass) => {
    setSelectedPcs(prev => {
      const next = new Set(prev);
      if (next.has(pc)) {
        next.delete(pc);
      } else {
        next.add(pc);
      }
      setSeedText(Array.from(next).sort((a, b) => a - b).join(','));
      return next;
    });
  }, []);

  const handleSeedTextChange = (val: string) => {
    setSeedText(val);
    const parsed = parseSeedInput(val);
    if (parsed) {
      setSelectedPcs(new Set(parsed));
      setSeedError(null);
    } else {
      setSeedError('Enter comma-separated numbers 0–11');
    }
  };

  // Operation handlers
  const addOp = useCallback((op: Operation) => {
    if (operations.length >= maxChain) return;
    setOperations(prev => [...prev, op]);
  }, [operations.length, maxChain]);

  const undo = () => setOperations(prev => prev.slice(0, -1));
  const clear = () => setOperations([]);

  const handleRandomize = () => {
    const len = isPro ? 8 : 3;
    const ops = randomChain(len).filter(op => {
      if (!isPro && (op.type === 'P' || op.type === 'L' || op.type === 'R')) return false;
      return true;
    }).slice(0, maxChain);
    setOperations(ops);
  };

  // Audio playback
  const handlePlay = () => {
    const allChords: PitchClass[][] = [seed];
    for (const step of steps) {
      allChords.push(step.outputPcs);
    }
    playChordProgression(allChords, 72);
  };

  const atLimit = operations.length >= maxChain;

  return (
    <div className="space-y-6">
      {/* Seed section */}
      <section className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Seed Pitch-Class Set</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode('keyboard')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                inputMode === 'keyboard' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Piano
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                inputMode === 'text' ? 'bg-indigo-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Text
            </button>
          </div>
        </div>

        {inputMode === 'keyboard' ? (
          <div className="overflow-x-auto">
            <PianoKeyboard selected={selectedPcs} onToggle={togglePc} />
          </div>
        ) : (
          <div>
            <input
              type="text"
              value={seedText}
              onChange={e => handleSeedTextChange(e.target.value)}
              placeholder="e.g. 0,4,7"
              className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm w-full focus:outline-none focus:border-indigo-500"
            />
            {seedError && <p className="text-red-400 text-xs mt-1">{seedError}</p>}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-gray-400 text-sm">Seed:</span>
          <span className="font-mono text-indigo-300 text-sm">{`{${seed.join(', ')}}`}</span>
          <span className="text-gray-500 text-sm">{pcsDisplay(seed)}</span>
        </div>
      </section>

      {/* Operation toolbar */}
      <section className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Operations</h2>
          <div className="flex gap-2">
            <OpButton label="Undo" onClick={undo} disabled={operations.length === 0} />
            <OpButton label="Clear" onClick={clear} disabled={operations.length === 0} variant="danger" />
            <OpButton label="Randomize" onClick={handleRandomize} />
            <OpButton label="▶ Play" onClick={handlePlay} disabled={steps.length === 0} variant="plr" />
          </div>
        </div>

        {atLimit && (
          <div className="mb-3 text-amber-400 text-xs bg-amber-900/30 border border-amber-700 rounded px-3 py-2">
            {isPro
              ? `Chain limit reached (${PRO_MAX_CHAIN} steps max)`
              : `Free tier: up to ${FREE_MAX_CHAIN} steps. Upgrade to Pro for longer chains and PLR operations.`}
          </div>
        )}

        {/* T operations */}
        <div className="mb-3">
          <div className="text-xs text-gray-400 mb-1 font-medium">Transpose (T)</div>
          <div className="flex flex-wrap gap-1">
            {ALL_PCS.map(n => (
              <OpButton
                key={`T${n}`}
                label={`T${n}`}
                onClick={() => addOp({ type: 'T', n })}
                disabled={atLimit}
              />
            ))}
          </div>
        </div>

        {/* I operations */}
        <div className="mb-3">
          <div className="text-xs text-gray-400 mb-1 font-medium">Invert (I)</div>
          <div className="flex flex-wrap gap-1">
            {ALL_PCS.map(n => (
              <OpButton
                key={`I${n}`}
                label={`I${n}`}
                onClick={() => addOp({ type: 'I', n })}
                disabled={atLimit}
              />
            ))}
          </div>
        </div>

        {/* PLR operations */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="text-xs text-gray-400 font-medium">Neo-Riemannian (PLR)</div>
            {!isPro && (
              <span className="text-xs bg-purple-900 text-purple-300 border border-purple-700 rounded px-2 py-0.5">
                Pro
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {(['P', 'L', 'R'] as const).map(opType => (
              <OpButton
                key={opType}
                label={opType}
                onClick={() => addOp({ type: opType })}
                disabled={atLimit || !isPro}
                variant="plr"
              />
            ))}
          </div>
          {!isPro && (
            <p className="text-xs text-gray-500 mt-1">
              P (Parallel), L (Leading-tone), R (Relative) transforms require Pro tier.
            </p>
          )}
        </div>
      </section>

      {/* Chain pipeline */}
      <section className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Transformation Chain</h2>

        {steps.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            Add operations above to build a chain.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-start gap-0 min-w-max pb-2">
              {/* Seed node */}
              <ChainNode
                label="Seed"
                pcs={seed}
                chordName={null}
                commonTones={[]}
                isFirst={true}
              />

              {steps.map((step, i) => (
                <div key={i} className="flex items-start">
                  <ChainEdge step={step} />
                  <ChainNode
                    label={operationLabel(step.operation)}
                    pcs={step.outputPcs}
                    chordName={step.chordName}
                    commonTones={step.commonTones}
                    isFirst={false}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {steps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Steps</div>
              <div className="text-lg font-bold text-white">{steps.length}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Total VL Distance</div>
              <div className="text-lg font-bold text-white">
                {steps.reduce((acc, s) => acc + s.vlDistance, 0)}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Final Set</div>
              <div className="text-sm font-mono text-indigo-300">{pcsDisplay(finalPcs)}</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Returns to Seed?</div>
              <div className={`text-sm font-bold ${
                JSON.stringify(finalPcs) === JSON.stringify(seed) ? 'text-green-400' : 'text-gray-500'
              }`}>
                {JSON.stringify(finalPcs) === JSON.stringify(seed) ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Step-by-step table */}
      {steps.length > 0 && (
        <section className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-3">Step Detail</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Op</th>
                  <th className="pb-2 pr-4">Input</th>
                  <th className="pb-2 pr-4">Output</th>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Common Tones</th>
                  <th className="pb-2">VL</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                    <td className="py-2 pr-4 font-mono text-indigo-400 font-bold">
                      {operationLabel(step.operation)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-300 text-xs">
                      {`{${step.inputPcs.join(',')}}`}
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-200 text-xs">
                      {`{${step.outputPcs.join(',')}}`}
                    </td>
                    <td className="py-2 pr-4 text-yellow-400 text-xs">
                      {step.chordName ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {step.commonTones.length > 0
                        ? step.commonTones.map(pc => NOTE_NAMES[pc]).join(' ')
                        : <span className="text-gray-600">none</span>}
                    </td>
                    <td className="py-2 text-cyan-400 font-mono">{step.vlDistance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!isPro && (
        <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4 text-center">
          <p className="text-purple-300 text-sm font-medium">
            Upgrade to Pro for chains up to 24 steps and PLR (Neo-Riemannian) operations.
          </p>
          <a
            href="#dashboard"
            className="inline-block mt-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
          >
            Upgrade to Pro
          </a>
        </div>
      )}
    </div>
  );
}
