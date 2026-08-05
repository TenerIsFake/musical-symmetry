import { useState, useRef, useEffect, useCallback } from 'react';
import type { SymmetryAnalysis, PitchClass } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import {
  toLilypond,
  toLatexTable,
  toBibtex,
  downloadAsFile,
  generateLaTeX,
} from '../utils/export-academic';
import { toMusicXML } from '../utils/musicxml-writer';
import { isNativePlatform } from '../utils/platform';

interface Props {
  analysis: SymmetryAnalysis | null;
  pcs: PitchClass[];
}

type ToastMsg = string | null;

export default function ExportMenu({ analysis, pcs }: Props) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ToastMsg>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isResearch = user?.tier === 'research';
  const isPro = user?.tier === 'pro' || user?.tier === 'research';

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function guard(fn: () => void) {
    if (!isResearch) {
      setOpen(false);
      setShowUpgrade(true);
      return;
    }
    fn();
    setOpen(false);
  }

  function guardPro(fn: () => void) {
    if (!isPro) {
      setOpen(false);
      setShowUpgrade(true);
      return;
    }
    fn();
    setOpen(false);
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied!`);
    } catch {
      // Fallback for browsers that block clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(`${label} copied!`);
    }
  }

  const getLilypond = () =>
    toLilypond(pcs, { title: `Pitch-Class Set {${pcs.join(',')}}` });

  const getLatex = () =>
    analysis
      ? toLatexTable(analysis)
      : '';

  const setLabel = pcs.join('');

  function getMusicXML(): string {
    const title = `Pitch-Class Set {${pcs.join(',')}}`;
    // Map pitch classes to MIDI notes in octave 4 (middle C = 60)
    const notes = pcs.map(pc => ({ pitch: 60 + pc, duration: 1, rest: false }));
    return toMusicXML({
      title,
      tempo: 120,
      timeSignature: [4, 4],
      parts: [{ name: 'Pitch-Class Set', notes }],
    });
  }

  const actions: Array<{ label: string; onClick: () => void }> = [
    {
      label: 'Download MusicXML',
      onClick: () =>
        guardPro(() =>
          downloadAsFile(
            getMusicXML(),
            `set-${setLabel}.musicxml`,
            'application/vnd.recordare.musicxml+xml',
          ),
        ),
    },
    {
      label: 'Copy as Lilypond',
      onClick: () => guard(() => copyToClipboard(getLilypond(), 'Lilypond')),
    },
    {
      label: 'Download .ly file',
      onClick: () =>
        guard(() =>
          downloadAsFile(getLilypond(), `set-${setLabel}.ly`, 'text/x-lilypond'),
        ),
    },
    {
      label: 'Copy as LaTeX table',
      onClick: () =>
        guard(() =>
          copyToClipboard(
            analysis ? getLatex() : '% No analysis available',
            'LaTeX',
          ),
        ),
    },
    {
      label: 'Download .tex file',
      onClick: () =>
        guard(() =>
          downloadAsFile(
            analysis ? getLatex() : '% No analysis available',
            `set-${setLabel}.tex`,
            'application/x-latex',
          ),
        ),
    },
    {
      label: 'Copy BibTeX citation',
      onClick: () => guard(() => copyToClipboard(toBibtex(), 'BibTeX')),
    },
    {
      label: 'Copy LaTeX Theorem',
      onClick: () => guard(() => copyToClipboard(
        analysis ? generateLaTeX(analysis) : '% No analysis available',
        'LaTeX Theorem',
      )),
    },
  ];

  const disabled = pcs.length === 0;

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          title={disabled ? 'Select at least one pitch class to export' : 'Export'}
          aria-haspopup="true"
          aria-expanded={open}
        >
          Export <span aria-hidden="true">&#9662;</span>
        </button>

        {open && (
          <div
            className="absolute bottom-full mb-2 left-0 z-50 min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
            role="menu"
          >
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                role="menuitem"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-indigo-600 text-white text-sm rounded-full shadow-lg pointer-events-none animate-fade-in"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}

      {/* Upgrade prompt modal */}
      {showUpgrade && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowUpgrade(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Upgrade required"
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm mx-4 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-3xl mb-3">&#128196;</div>
            <h3 className="text-lg font-bold text-white mb-2">
              Research Tier Required
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              Academic export (Lilypond, LaTeX, BibTeX) is available on the{' '}
              <strong className="text-indigo-300">Research</strong> tier ($15/mo).
              Upgrade to unlock publication-ready output.
            </p>
            <div className="flex gap-3 justify-center">
              {/* Play policy: no external purchase links inside the native app */}
              {isNativePlatform ? (
                <p className="text-sm text-gray-400 self-center">
                  Available with a Research subscription on the web at symmetry.tendrid.us.
                </p>
              ) : (
                <a
                  href="https://symmetry.tendrid.us/pricing"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Upgrade to Research
                </a>
              )}
              <button
                onClick={() => setShowUpgrade(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
