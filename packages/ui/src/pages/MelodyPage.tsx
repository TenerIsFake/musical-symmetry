import { useState, useCallback, useRef, useEffect } from 'react';
import { NOTE_NAMES, toCSEG, analyzeContour, contourInversion, contourRetrograde, contourRetrogradeInversion, contourSimilarity, contourClass } from '@musical-symmetry/core';
import type { ContourAnalysis, CSEG } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import PianoRollInput from '../components/PianoRollInput';
import ContourDiagram from '../components/ContourDiagram';
import MicControls from '../components/MicControls';
import type { PitchClass } from '@musical-symmetry/core';

interface Note {
  pc: number;
  octave: number;
}

const TIER_LIMITS = { free: 12, pro: 64, research: 256 } as const;

export default function MelodyPage() {
  const { user } = useUser();
  const tier = (user?.tier ?? 'free') as keyof typeof TIER_LIMITS;
  const maxNotes = TIER_LIMITS[tier];

  const [notes, setNotes] = useState<Note[]>([]);
  const [compareNotes, setCompareNotes] = useState<Note[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [micMode, setMicMode] = useState(false);
  const [micNotes, setMicNotes] = useState<Note[]>([]);
  const lastOctaveRef = useRef(4);

  const pitches = notes.map(n => n.octave * 12 + n.pc);
  const analysis: ContourAnalysis | null = pitches.length >= 2 ? analyzeContour(pitches) : null;
  const classLabel = pitches.length >= 2 ? contourClass(toCSEG(pitches)) : null;

  const comparePitches = compareNotes.map(n => n.octave * 12 + n.pc);
  const compareAnalysis: ContourAnalysis | null = comparePitches.length >= 2 ? analyzeContour(comparePitches) : null;

  const similarity = analysis && compareAnalysis && analysis.cseg.length === compareAnalysis.cseg.length
    ? contourSimilarity(analysis.cseg, compareAnalysis.cseg)
    : null;

  const handleMicDetect = useCallback((pc: PitchClass) => {
    if (!micMode) return;
    const note: Note = { pc, octave: lastOctaveRef.current };
    setMicNotes(prev => {
      if (prev.length >= maxNotes) return prev;
      if (prev.length > 0) {
        const last = prev[prev.length - 1]!;
        if (last.pc === pc) return prev;
      }
      return [...prev, note];
    });
    setNotes(prev => {
      const n: Note = { pc, octave: lastOctaveRef.current };
      if (prev.length >= maxNotes) return prev;
      return [...prev, n];
    });
  }, [micMode, maxNotes]);

  const transformedCSEGs = analysis ? {
    inversion: contourInversion(analysis.cseg),
    retrograde: contourRetrograde(analysis.cseg),
    retrogradeInversion: contourRetrogradeInversion(analysis.cseg),
  } : null;

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-gray-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Melody Input</h2>
          <div className="flex gap-2">
            {tier !== 'free' && (
              <button
                onClick={() => setMicMode(!micMode)}
                className={`px-3 py-1.5 rounded text-sm font-medium ${
                  micMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {micMode ? '● Recording' : '🎤 Mic'}
              </button>
            )}
            <button
              onClick={() => setShowCompare(!showCompare)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                showCompare ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Compare
            </button>
          </div>
        </div>

        {micMode && tier !== 'free' && (
          <div className="mb-3">
            <MicControls onDetect={handleMicDetect} />
          </div>
        )}

        <PianoRollInput notes={notes} onNotesChange={setNotes} maxNotes={maxNotes} />

        {notes.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Sequence: {notes.map(n => `${NOTE_NAMES[n.pc as PitchClass]}${n.octave}`).join(' → ')}
          </p>
        )}
      </div>

      {/* Analysis Section */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
            <h3 className="text-md font-semibold text-white">Contour Analysis</h3>

            <ContourDiagram cseg={analysis.cseg} label="CSEG Contour" />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-900 rounded p-2">
                <span className="text-gray-400">Class:</span>{' '}
                <span className="text-indigo-300 font-mono">{classLabel}</span>
              </div>
              <div className="bg-gray-900 rounded p-2">
                <span className="text-gray-400">Depth:</span>{' '}
                <span className="text-white">{analysis.depth}</span>
              </div>
              <div className="bg-gray-900 rounded p-2">
                <span className="text-gray-400">Palindrome:</span>{' '}
                <span className={analysis.isPalindrome ? 'text-green-400' : 'text-gray-500'}>
                  {analysis.isPalindrome ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="bg-gray-900 rounded p-2">
                <span className="text-gray-400">Inv. Symmetric:</span>{' '}
                <span className={analysis.isInversionallySymmetric ? 'text-green-400' : 'text-gray-500'}>
                  {analysis.isInversionallySymmetric ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            <div className="bg-gray-900 rounded p-2">
              <span className="text-gray-400 text-xs">CSEG:</span>{' '}
              <span className="text-white font-mono text-sm">⟨{analysis.cseg.join(' ')}⟩</span>
            </div>

            <div className="bg-gray-900 rounded p-2">
              <span className="text-gray-400 text-xs">CAS:</span>{' '}
              <span className="text-white font-mono text-sm">{analysis.cas.join(' ')}</span>
            </div>
          </div>

          {/* Transformations */}
          <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
            <h3 className="text-md font-semibold text-white">Related Contours</h3>
            {transformedCSEGs && (
              <>
                <ContourDiagram cseg={transformedCSEGs.inversion} label="Inversion (I)" height={100} />
                <ContourDiagram cseg={transformedCSEGs.retrograde} label="Retrograde (R)" height={100} />
                <ContourDiagram cseg={transformedCSEGs.retrogradeInversion} label="Retrograde-Inversion (RI)" height={100} />
              </>
            )}
          </div>
        </div>
      )}

      {/* COM Matrix */}
      {analysis && analysis.cseg.length <= 12 && (
        <div className="bg-gray-800/50 rounded-xl p-4">
          <h3 className="text-md font-semibold text-white mb-3">Comparison Matrix (COM)</h3>
          <div className="overflow-x-auto">
            <table className="text-xs font-mono">
              <thead>
                <tr>
                  <th className="px-1 text-gray-500"></th>
                  {analysis.cseg.map((_, j) => (
                    <th key={j} className="px-1.5 py-0.5 text-gray-400">{j}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.comMatrix.map((row, i) => (
                  <tr key={i}>
                    <td className="px-1 text-gray-400">{i}</td>
                    {row.map((cell, j) => (
                      <td key={j} className={`px-1.5 py-0.5 text-center ${
                        cell === '+' ? 'text-green-400' : cell === '-' ? 'text-red-400' : 'text-gray-600'
                      }`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compare Panel */}
      {showCompare && (
        <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
          <h3 className="text-md font-semibold text-white">Compare Melodies</h3>
          <p className="text-xs text-gray-400">Enter a second melody to compute contour similarity (CSIM).</p>
          <PianoRollInput notes={compareNotes} onNotesChange={setCompareNotes} maxNotes={maxNotes} />

          {compareAnalysis && (
            <ContourDiagram cseg={compareAnalysis.cseg} label="Melody B Contour" />
          )}

          {similarity !== null && (
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm">Contour Similarity (CSIM)</p>
              <p className="text-3xl font-bold text-white mt-1">
                {(similarity * 100).toFixed(1)}%
              </p>
              <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${similarity * 100}%`,
                    backgroundColor: similarity > 0.8 ? '#22c55e' : similarity > 0.5 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
            </div>
          )}

          {analysis && compareAnalysis && analysis.cseg.length !== compareAnalysis.cseg.length && (
            <p className="text-xs text-amber-400">
              CSIM requires same-length melodies. Current: {analysis.cseg.length} vs {compareAnalysis.cseg.length} notes.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!analysis && (
        <div className="text-center py-12">
          <p className="text-gray-400">Place at least 2 notes on the piano roll to see contour analysis.</p>
          {tier === 'free' && (
            <p className="text-gray-500 text-sm mt-2">
              Free tier: up to {TIER_LIMITS.free} notes. Upgrade for mic input and longer sequences.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
