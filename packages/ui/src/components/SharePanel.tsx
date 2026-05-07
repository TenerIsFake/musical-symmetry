import { useState, useCallback, useRef, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

const API_BASE = import.meta.env.VITE_API_URL || 'https://symmetry.tendrid.us';
const isNative = typeof (window as any).Capacitor !== 'undefined';

type CardStyle =
  | 'orbit' | 'identity' | 'spectrum' | 'comparison' | 'keyboard' | 'molecule'
  | 'interval-dna' | 'tonnetz' | 'gradient' | 'minimal' | 'academic' | 'neon'
  | 'blueprint' | 'constellation' | 'waveform' | 'badge' | 'story' | 'banner'
  | 'quote' | 'timeline';

interface StyleInfo {
  id: CardStyle;
  name: string;
  description: string;
  icon: string;
}

const STYLES: StyleInfo[] = [
  { id: 'orbit', name: 'Orbit', description: 'Classic clock-face orbit diagram', icon: '\u25CE' },
  { id: 'identity', name: 'Identity', description: 'Bold chord identity card', icon: '\u2605' },
  { id: 'spectrum', name: 'Spectrum', description: 'Symmetry spectrum position', icon: '\u2194' },
  { id: 'comparison', name: 'Compare', description: 'Two chords side-by-side', icon: '\u21C6' },
  { id: 'keyboard', name: 'Keyboard', description: 'Piano keys highlighted', icon: '\u266C' },
  { id: 'molecule', name: 'Molecule', description: 'Molecular analog visual', icon: '\u2B21' },
  { id: 'interval-dna', name: 'DNA', description: 'Interval vector barcode', icon: '\u2502' },
  { id: 'tonnetz', name: 'Tonnetz', description: 'Tonnetz grid position', icon: '\u25B3' },
  { id: 'gradient', name: 'Gradient', description: 'Abstract gradient art', icon: '\u25D2' },
  { id: 'minimal', name: 'Minimal', description: 'Ultra-minimal typography', icon: '\u2014' },
  { id: 'academic', name: 'Academic', description: 'Formal citation style', icon: '\u00A7' },
  { id: 'neon', name: 'Neon', description: 'Synthwave aesthetic', icon: '\u2301' },
  { id: 'blueprint', name: 'Blueprint', description: 'Technical drawing', icon: '\u2316' },
  { id: 'constellation', name: 'Stars', description: 'Constellation metaphor', icon: '\u2726' },
  { id: 'waveform', name: 'Waveform', description: 'Audio visualization', icon: '\u223F' },
  { id: 'badge', name: 'Badge', description: 'Achievement emblem', icon: '\u2B50' },
  { id: 'story', name: 'Story', description: 'Instagram story (9:16)', icon: '\u25AF' },
  { id: 'banner', name: 'Banner', description: 'Twitter/X banner', icon: '\u25AC' },
  { id: 'quote', name: 'Quote', description: 'Pull-quote style', icon: '\u201C' },
  { id: 'timeline', name: 'Timeline', description: 'Analysis sparkline', icon: '\u2248' },
];

interface SharePanelProps {
  pcs: PitchClass[];
  comparePcs?: PitchClass[];
  chordName?: string;
  group?: string;
  onClose: () => void;
}

export default function SharePanel({ pcs, comparePcs, chordName, group, onClose }: SharePanelProps) {
  const [selectedStyle, setSelectedStyle] = useState<CardStyle>('orbit');
  const [copied, setCopied] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const buildUrl = useCallback((style: CardStyle) => {
    const params = new URLSearchParams();
    params.set('pcs', pcs.join(','));
    if (chordName) params.set('chordName', chordName);
    if (group) params.set('group', group);
    if (comparePcs && comparePcs.length > 0) params.set('comparePcs', comparePcs.join(','));
    return `${API_BASE}/api/og/${style}?${params.toString()}`;
  }, [pcs, comparePcs, chordName, group]);

  const shareUrl = buildUrl(selectedStyle);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  const downloadSvg = useCallback(async () => {
    try {
      const resp = await fetch(shareUrl);
      const svgText = await resp.text();
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `symmetry-${selectedStyle}-${pcs.join('')}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
  }, [shareUrl, selectedStyle, pcs]);

  const downloadPng = useCallback(async () => {
    try {
      const resp = await fetch(shareUrl);
      const svgText = await resp.text();
      const img = new Image();
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1200;
        canvas.height = img.naturalHeight || 630;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `symmetry-${selectedStyle}-${pcs.join('')}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
        URL.revokeObjectURL(svgUrl);
      };
      img.src = svgUrl;
    } catch (e) {
      console.error('PNG download failed:', e);
    }
  }, [shareUrl, selectedStyle, pcs]);

  const tweetUrl = useCallback(() => {
    const text = encodeURIComponent(`Check out the symmetry of ${chordName || `{${pcs.join(',')}}`}${group ? ` (${group})` : ''}`);
    const url = encodeURIComponent(shareUrl);
    return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
  }, [shareUrl, chordName, group, pcs]);

  const nativeShare = useCallback(async () => {
    const title = 'Chrometria';
    const text = `Check out the symmetry of ${chordName || `{${pcs.join(',')}}`}${group ? ` (${group})` : ''} on Chrometria!`;
    try {
      const modName = '@capac' + 'itor/share';
      const mod: any = await import(/* @vite-ignore */ modName);
      await mod.Share.share({ title, text, url: shareUrl });
    } catch (e) {
      console.error('Native share failed:', e);
    }
  }, [shareUrl, chordName, pcs, group]);

  const embedCode = `<img src="${shareUrl}" alt="Chrometria Card" width="1200" height="630"/>`;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Share card">
      <div
        className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto m-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Share Card</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            aria-label="Close share panel"
          >
            &times;
          </button>
        </div>

        {/* Style grid */}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2 mb-6">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStyle(s.id)}
              className={`flex flex-col items-center p-2 rounded-lg border text-xs transition-all ${
                selectedStyle === s.id
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200'
              }`}
              title={s.description}
            >
              <span className="text-lg mb-1">{s.icon}</span>
              <span className="truncate w-full text-center">{s.name}</span>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div ref={previewRef} className="mb-6 rounded-lg overflow-hidden border border-gray-700 bg-gray-950">
          <img
            src={shareUrl}
            alt={`${selectedStyle} card preview`}
            className="w-full h-auto"
            style={{ maxHeight: '400px', objectFit: 'contain' }}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => copyToClipboard(shareUrl, 'link')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
            aria-label="Copy share link to clipboard"
          >
            {copied === 'link' ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={downloadSvg}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-white transition-colors"
            aria-label="Download card as SVG"
          >
            Download SVG
          </button>
          <button
            onClick={downloadPng}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-white transition-colors"
            aria-label="Download card as PNG"
          >
            Download PNG
          </button>
          <a
            href={tweetUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm font-medium text-white transition-colors inline-flex items-center"
            aria-label="Share on Twitter"
          >
            Tweet
          </a>
          {isNative && (
            <button
              onClick={nativeShare}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
              aria-label="Share via native share sheet"
            >
              Share
            </button>
          )}
          <button
            onClick={() => copyToClipboard(embedCode, 'embed')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-white transition-colors"
            aria-label="Copy embed code to clipboard"
          >
            {copied === 'embed' ? 'Copied!' : 'Copy Embed'}
          </button>
        </div>

        {/* URL display */}
        <div className="mt-4 p-3 bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-400 font-mono break-all">{shareUrl}</p>
        </div>
      </div>
    </div>
  );
}
