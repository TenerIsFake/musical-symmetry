import { useState, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import {
  PROGRESSION_TEMPLATES,
  CATEGORY_META,
  NOTE_NAMES_SHARP,
  transposeTemplate,
  type ProgressionTemplate,
} from '../data/progression-templates';

// ── Types ──────────────────────────────────────────────────────────────────

interface LoadedChord {
  pcs: number[];
  name: string;
}

interface ProgressionTemplatesProps {
  onLoad: (chords: LoadedChord[]) => void;
  onClose: () => void;
  /** How many templates the user has loaded this session (for free-tier gate). */
  sessionLoads: number;
  onSessionLoad: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const FREE_LOAD_LIMIT = 5;

const CATEGORIES = ['all', 'classical', 'jazz', 'pop', 'film'] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

// ── Quality label map ──────────────────────────────────────────────────────

function qualityLabel(quality: string): string {
  const map: Record<string, string> = {
    major: '',
    minor: 'm',
    maj7: 'maj7',
    min7: 'm7',
    dom7: '7',
    diminished: 'dim',
    augmented: 'aug',
    sus2: 'sus2',
    sus4: 'sus4',
  };
  return map[quality] ?? quality;
}

function chordName(root: number, quality: string): string {
  return `${NOTE_NAMES_SHARP[root]}${qualityLabel(quality)}`;
}

// ── Template Card ──────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: ProgressionTemplate;
  keyRoot: number;
  onLoad: () => void;
  canLoad: boolean;
  isPro: boolean;
}

function TemplateCard({ template, keyRoot, onLoad, canLoad, isPro }: TemplateCardProps) {
  const meta = CATEGORY_META[template.category];
  const transposed = keyRoot === 0 ? template : transposeTemplate(template, keyRoot);

  return (
    <div
      className={[
        'rounded-xl border p-4 flex flex-col gap-3 transition-all',
        meta.color,
        meta.border,
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold text-sm leading-tight truncate">{template.name}</h4>
          <p className="text-gray-400 text-xs mt-0.5 font-mono">{template.romanNumerals}</p>
        </div>
        <span className={['text-xs px-2 py-0.5 rounded font-medium flex-shrink-0', meta.badge].join(' ')}>
          {CATEGORY_META[template.category].label}
        </span>
      </div>

      {/* Chord pills */}
      <div className="flex flex-wrap gap-1">
        {transposed.chords.map((ch, i) => (
          <span
            key={i}
            className="bg-gray-900/60 text-gray-200 text-xs px-2 py-0.5 rounded font-mono"
          >
            {chordName(ch.root, ch.quality)}
          </span>
        ))}
      </div>

      {/* Description */}
      <p className="text-gray-400 text-xs leading-relaxed">{template.description}</p>

      {/* Symmetry note */}
      {template.symmetryNote && (
        <div className="bg-gray-900/40 rounded px-2 py-1.5 flex items-start gap-1.5">
          <span className="text-indigo-400 text-xs mt-0.5 flex-shrink-0">&#x2736;</span>
          <p className="text-indigo-300 text-xs leading-relaxed">{template.symmetryNote}</p>
        </div>
      )}

      {/* Load button */}
      {canLoad ? (
        <button
          onClick={onLoad}
          className="mt-auto w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded transition-colors"
        >
          Load Progression
        </button>
      ) : (
        <div className="mt-auto w-full py-1.5 bg-gray-700 text-gray-500 text-xs font-semibold rounded text-center cursor-not-allowed select-none">
          {isPro ? 'Load Progression' : 'Session limit reached (Free: 5 loads)'}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────

export default function ProgressionTemplates({
  onLoad,
  onClose,
  sessionLoads,
  onSessionLoad,
}: ProgressionTemplatesProps) {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';
  const isPro = tier === 'pro' || tier === 'research';

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [keyRoot, setKeyRoot] = useState<number>(0); // 0 = C
  const [search, setSearch] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const atFreeLimit = !isPro && sessionLoads >= FREE_LOAD_LIMIT;

  const filtered = useMemo(() => {
    let list = PROGRESSION_TEMPLATES;
    if (category !== 'all') list = list.filter(t => t.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.romanNumerals.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.includes(q),
      );
    }
    return list;
  }, [category, search]);

  const handleLoad = (template: ProgressionTemplate) => {
    if (atFreeLimit) return;
    const transposed = keyRoot === 0 ? template : transposeTemplate(template, keyRoot);
    const chords = transposed.chords.map(ch => ({
      pcs: ch.pcs,
      name: chordName(ch.root, ch.quality),
    }));
    onLoad(chords);
    onSessionLoad();
    setLoadedId(template.id);
    // Auto-close after a short moment
    setTimeout(onClose, 400);
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Chord Progression Templates</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {isPro
                ? 'Pro — unlimited loads'
                : `Free — ${Math.max(0, FREE_LOAD_LIMIT - sessionLoads)} load${FREE_LOAD_LIMIT - sessionLoads === 1 ? '' : 's'} remaining this session`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
          >
            &#x2715;
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-800 flex flex-wrap items-center gap-3 flex-shrink-0">
          {/* Category tabs */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={[
                  'px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors',
                  category === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700',
                ].join(' ')}
              >
                {cat === 'all' ? 'All' : CATEGORY_META[cat as ProgressionTemplate['category']].label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Key selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">Key:</label>
            <select
              value={keyRoot}
              onChange={e => setKeyRoot(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {NOTE_NAMES_SHARP.map((n, i) => (
                <option key={i} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-3 py-1 w-40 outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
          />
        </div>

        {/* Free tier notice */}
        {!isPro && (
          <div className="px-6 py-2 bg-yellow-900/30 border-b border-yellow-800/40 flex-shrink-0 flex items-center gap-2">
            <span className="text-yellow-400 text-xs">&#9733;</span>
            <p className="text-yellow-300 text-xs">
              Free tier: view all templates, load up to {FREE_LOAD_LIMIT} per session.{' '}
              <span className="text-yellow-200 font-semibold">Upgrade to Pro</span> for unlimited loads and post-load editing.
            </p>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-12">No templates match your search.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  keyRoot={keyRoot}
                  onLoad={() => handleLoad(template)}
                  canLoad={!atFreeLimit || loadedId === template.id}
                  isPro={isPro}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex-shrink-0 flex items-center justify-between">
          <p className="text-gray-600 text-xs">{PROGRESSION_TEMPLATES.length} templates across 4 categories</p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
