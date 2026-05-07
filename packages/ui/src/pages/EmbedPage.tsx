import { useState, useEffect } from 'react';
import { classify, identifyChord } from '@musical-symmetry/core';
import type { PitchClass } from '@musical-symmetry/core';
import PianoKeyboard from '../components/PianoKeyboard';
import ClassificationPanel from '../components/ClassificationPanel';
import OrbitDiagram from '../components/OrbitDiagram';

function parseURLParams() {
  const hash = window.location.hash;
  const queryStart = hash.indexOf('?');
  const params = new URLSearchParams(queryStart >= 0 ? hash.slice(queryStart + 1) : '');

  const pcsParam = params.get('pcs');
  const pcs: PitchClass[] = pcsParam
    ? ([...new Set(
        pcsParam.split(',').map(Number).filter(n => n >= 0 && n <= 11)
      )].sort((a, b) => a - b) as PitchClass[])
    : [];

  const themeParam = params.get('theme');
  const theme: 'dark' | 'light' = themeParam === 'light' ? 'light' : 'dark';

  const sizeParam = params.get('size');
  const size: 'compact' | 'full' = sizeParam === 'full' ? 'full' : 'compact';

  return { pcs, theme, size };
}

export default function EmbedPage() {
  const { pcs: initialPCs, theme, size } = parseURLParams();
  const [selectedPCs, setSelectedPCs] = useState<PitchClass[]>(initialPCs);

  useEffect(() => {
    const { pcs } = parseURLParams();
    setSelectedPCs(pcs);
  }, []);

  function togglePC(pc: PitchClass) {
    setSelectedPCs(prev =>
      prev.includes(pc) ? prev.filter(p => p !== pc) : [...prev, pc].sort((a, b) => a - b) as PitchClass[]
    );
  }

  const analysis = selectedPCs.length > 0 ? classify(selectedPCs) : null;
  const chord = selectedPCs.length > 0 ? identifyChord(selectedPCs) : null;

  const deepLink = `https://symmetry.tendrid.us/#classifier?pcs=${selectedPCs.join(',')}`;

  const isCompact = size === 'compact';
  const isDark = theme === 'dark';

  const rootClass = isDark
    ? 'bg-gray-900 text-white'
    : 'bg-white text-gray-900';

  const footerTextClass = isDark ? 'text-gray-500' : 'text-gray-400';
  const footerLinkClass = isDark
    ? 'text-indigo-400 hover:text-indigo-300'
    : 'text-indigo-600 hover:text-indigo-500';
  const openButtonClass = isDark
    ? 'bg-indigo-700 hover:bg-indigo-600 text-white'
    : 'bg-indigo-600 hover:bg-indigo-500 text-white';

  return (
    <div className={`min-h-screen ${rootClass} flex flex-col`}>
      <div className={`flex-1 flex flex-col gap-${isCompact ? '3' : '5'} ${isCompact ? 'p-3' : 'p-5'}`}>
        <PianoKeyboard selectedPCs={selectedPCs} onToggle={togglePC} />

        <div className={`grid ${isCompact ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-5'}`}>
          <OrbitDiagram
            selectedPCs={selectedPCs}
            analysis={analysis}
            onTogglePC={togglePC}
          />
          <ClassificationPanel analysis={analysis} chord={chord} />
        </div>
      </div>

      <footer className={`flex items-center justify-between ${isCompact ? 'px-3 py-2' : 'px-5 py-3'} border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <span className={`text-xs ${footerTextClass}`}>
          Powered by{' '}
          <a
            href="https://symmetry.tendrid.us"
            target="_blank"
            rel="noopener noreferrer"
            className={`font-semibold ${footerLinkClass}`}
          >
            Chrometria
          </a>
        </span>
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${openButtonClass}`}
        >
          Open in Chrometria
        </a>
      </footer>
    </div>
  );
}
