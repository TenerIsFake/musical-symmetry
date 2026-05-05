import { useState, useEffect, useCallback } from 'react';

interface TourStep {
  target: string;
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    target: 'piano',
    title: 'Piano Keyboard',
    description: 'Click any key to select a note. Try clicking C, E, and G for a C major chord.',
  },
  {
    target: 'classification',
    title: 'Classification Panel',
    description: 'See the symmetry group and properties of your chord.',
  },
  {
    target: 'orbit',
    title: 'Orbit Diagram',
    description: "This diagram shows your chord's shape in pitch-class space.",
  },
  {
    target: 'presets',
    title: 'Presets',
    description: 'Try these presets to explore different chord types.',
  },
  {
    target: 'share',
    title: 'Share Button',
    description: 'Share your discovery with 20 beautiful card styles.',
  },
];

function getTooltipPosition(rect: DOMRect) {
  const padding = 12;
  const tooltipWidth = 320;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Default: below the element
  let top = rect.bottom + padding;
  let left = rect.left + rect.width / 2 - tooltipWidth / 2;

  // Clamp horizontal
  if (left < padding) left = padding;
  if (left + tooltipWidth > viewportW - padding) left = viewportW - padding - tooltipWidth;

  // If not enough room below, place above
  if (top + 200 > viewportH) {
    top = rect.top - padding - 180;
  }

  return { top, left };
}

export default function GuidedTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    const target = STEPS[step]?.target;
    if (!target) return;
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    // Small delay to let layout settle after scroll
    const timer = setTimeout(updateRect, 100);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  const finish = useCallback(() => {
    localStorage.setItem('tour-completed', 'true');
    onComplete();
  }, [onComplete]);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, finish]);

  const current = STEPS[step];
  if (!current) return null;

  const cutoutPad = 8;
  const tooltipPos = targetRect ? getTooltipPosition(targetRect) : { top: window.innerHeight / 2 - 90, left: window.innerWidth / 2 - 160 };

  return (
    <div className="fixed inset-0 z-[9999]" aria-modal="true" role="dialog">
      {/* Overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - cutoutPad}
                y={targetRect.top - cutoutPad}
                width={targetRect.width + cutoutPad * 2}
                height={targetRect.height + cutoutPad * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.5)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Highlight ring */}
      {targetRect && (
        <div
          className="absolute border-2 border-indigo-400 rounded-lg pointer-events-none"
          style={{
            top: targetRect.top - cutoutPad,
            left: targetRect.left - cutoutPad,
            width: targetRect.width + cutoutPad * 2,
            height: targetRect.height + cutoutPad * 2,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute bg-indigo-900 border border-indigo-500 rounded-lg p-4 shadow-xl z-10"
        style={{ top: tooltipPos.top, left: tooltipPos.left, width: 320 }}
      >
        <p className="text-xs text-indigo-300 font-medium mb-1">
          Step {step + 1} of {STEPS.length}
        </p>
        <h3 className="text-white font-semibold mb-1">{current.title}</h3>
        <p className="text-gray-300 text-sm mb-4">{current.description}</p>
        <div className="flex items-center justify-between">
          <button
            onClick={finish}
            className="px-3 py-1.5 bg-gray-700 rounded text-sm text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Skip Tour
          </button>
          <button
            onClick={next}
            className="px-4 py-1.5 bg-indigo-600 rounded text-sm text-white font-medium hover:bg-indigo-500 transition-colors"
          >
            {step >= STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
