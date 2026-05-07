import { useState, useCallback, useRef, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { NOTE_NAMES } from '@musical-symmetry/core';
import { useClassifier } from '../hooks/useClassifier';
import { useChord } from '../hooks/useChord';
import { useUser } from '../context/UserContext';
import MicControls from '../components/MicControls';
import ClassificationPanel from '../components/ClassificationPanel';

const FREE_RECORD_LIMIT_MS = 15_000;

interface TimelineNote {
  pc: PitchClass;
  timestamp: number; // ms since recording start
}

interface RecordedSession {
  notes: TimelineNote[];
  durationMs: number;
  startedAt: number;
}

const GROUP_COLORS: Record<string, string> = {
  C1: '#6b7280', Z2: '#8b5cf6', C2: '#3b82f6', C3: '#06b6d4',
  C4: '#10b981', C6: '#22c55e', D2: '#eab308', D3: '#f97316',
  D4: '#ef4444', D6: '#dc2626', D12: '#ec4899',
};

const NOTE_COLORS: string[] = [
  '#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#a78bfa','#fb923c','#4ade80',
];

export default function LiveDetectionPage() {
  const { user } = useUser();
  const tier = user?.tier ?? 'free';

  const [livePCs, setLivePCs] = useState<PitchClass[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSession, setRecordedSession] = useState<RecordedSession | null>(null);
  const [timelineNotes, setTimelineNotes] = useState<TimelineNote[]>([]);
  const recordStartRef = useRef<number | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analysis = useClassifier(livePCs);
  const chord = useChord(livePCs);

  // Handle a new pitch class detected from the mic
  const handleDetect = useCallback((pc: PitchClass) => {
    setLivePCs(prev => {
      if (prev.includes(pc)) return prev;
      return [...prev, pc].sort((a, b) => a - b);
    });

    if (isRecording && recordStartRef.current !== null) {
      const ts = Date.now() - recordStartRef.current;
      setTimelineNotes(prev => [...prev, { pc, timestamp: ts }]);
    }
  }, [isRecording]);

  // Classify button from accumulator
  const handleClassify = useCallback((pcs: PitchClass[]) => {
    setLivePCs(pcs);
  }, []);

  // Recording controls
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setTimelineNotes([]);
    setRecordedSession(null);
    setElapsedMs(0);
    recordStartRef.current = Date.now();

    elapsedIntervalRef.current = setInterval(() => {
      if (recordStartRef.current !== null) {
        setElapsedMs(Date.now() - recordStartRef.current);
      }
    }, 200);

    if (tier === 'free') {
      recordTimerRef.current = setTimeout(() => {
        stopRecordingInternal();
      }, FREE_RECORD_LIMIT_MS);
    }
  }, [tier]);

  const stopRecordingInternal = useCallback(() => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    const duration = recordStartRef.current !== null ? Date.now() - recordStartRef.current : 0;
    const startedAt = recordStartRef.current ?? Date.now();
    recordStartRef.current = null;

    setIsRecording(false);
    setTimelineNotes(prev => {
      setRecordedSession({ notes: prev, durationMs: duration, startedAt });
      return prev;
    });
  }, []);

  const stopRecording = useCallback(() => {
    stopRecordingInternal();
  }, [stopRecordingInternal]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  // Export analysis of recorded session
  const exportSession = useCallback(() => {
    if (!recordedSession) return;
    const data = {
      exportedAt: new Date().toISOString(),
      durationMs: recordedSession.durationMs,
      notes: recordedSession.notes.map(n => ({
        pitchClass: n.pc,
        noteName: NOTE_NAMES[n.pc],
        timestampMs: n.timestamp,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-session-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recordedSession]);

  // Format elapsed time as mm:ss.s
  const formatTime = (ms: number) => {
    const total = Math.floor(ms / 100) / 10;
    const m = Math.floor(total / 60);
    const s = (total % 60).toFixed(1);
    return `${m}:${s.padStart(4, '0')}`;
  };

  // Timeline display: last 10 seconds scrolling, notes as circles
  const timelineWindowMs = 10_000;
  const nowMs = isRecording && recordStartRef.current !== null
    ? Date.now() - recordStartRef.current
    : recordedSession?.durationMs ?? 0;
  const visibleNotes = timelineNotes.filter(n => n.timestamp >= nowMs - timelineWindowMs);

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Live Detection</h2>
          <p className="text-xs text-gray-400">Sing or play — notes accumulate in real time</p>
        </div>
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <span className="flex items-center gap-1.5 text-red-400 text-sm font-mono">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                REC {formatTime(elapsedMs)}
                {tier === 'free' && (
                  <span className="text-xs text-gray-500">/ {formatTime(FREE_RECORD_LIMIT_MS)}</span>
                )}
              </span>
              <button
                onClick={stopRecording}
                className="px-3 py-1.5 rounded bg-red-800 hover:bg-red-700 text-sm font-medium text-white transition-colors"
              >
                Stop Recording
              </button>
            </>
          ) : (
            <button
              onClick={startRecording}
              className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-sm font-medium text-white transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-red-300" />
              Record
              {tier === 'free' && <span className="text-xs text-red-300">(15s)</span>}
            </button>
          )}
          {tier === 'research' && recordedSession && (
            <button
              onClick={exportSession}
              className="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-sm font-medium text-white transition-colors"
            >
              Export
            </button>
          )}
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: mic controls */}
        <div className="space-y-4">
          <MicControls
            onDetect={handleDetect}
            showAccumulator
            onClassify={handleClassify}
          />

          {/* Current note set */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">Active Set</h3>
              <button
                onClick={() => setLivePCs([])}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>
            {livePCs.length === 0 ? (
              <p className="text-gray-600 text-sm italic">No notes yet — start listening above</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {livePCs.map(pc => (
                  <span
                    key={pc}
                    className="px-3 py-1 rounded-full text-sm font-mono font-bold"
                    style={{ background: NOTE_COLORS[pc] + '33', color: NOTE_COLORS[pc], border: `1px solid ${NOTE_COLORS[pc]}55` }}
                  >
                    {NOTE_NAMES[pc]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: classification panel */}
        <div>
          <ClassificationPanel analysis={analysis} chord={chord} />
        </div>
      </div>

      {/* Timeline piano-roll */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase">Note Timeline</h3>
          <span className="text-xs text-gray-500">
            {isRecording ? 'Recording...' : recordedSession ? `${recordedSession.notes.length} notes captured` : 'Start recording to capture notes'}
          </span>
        </div>

        {/* Piano-roll scrolling display */}
        <div className="relative bg-gray-900 rounded overflow-hidden" style={{ height: '120px' }}>
          {/* Horizontal pitch-class lanes */}
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="absolute w-full border-b border-gray-800"
              style={{ top: `${(i / 12) * 100}%`, height: `${100 / 12}%` }}
            >
              <span className="absolute left-1 text-gray-700 font-mono" style={{ fontSize: '8px', lineHeight: `${120 / 12}px` }}>
                {NOTE_NAMES[i as PitchClass]}
              </span>
            </div>
          ))}

          {/* Note dots */}
          {visibleNotes.map((n, idx) => {
            const xPct = ((n.timestamp - (nowMs - timelineWindowMs)) / timelineWindowMs) * 100;
            const yPct = (n.pc / 12) * 100 + (100 / 12 / 2);
            return (
              <div
                key={idx}
                className="absolute w-2 h-2 rounded-full -translate-x-1 -translate-y-1 transition-all"
                style={{
                  left: `${Math.max(0, Math.min(100, xPct))}%`,
                  top: `${yPct}%`,
                  background: NOTE_COLORS[n.pc],
                  boxShadow: `0 0 4px ${NOTE_COLORS[n.pc]}`,
                }}
                title={`${NOTE_NAMES[n.pc]} @ ${(n.timestamp / 1000).toFixed(1)}s`}
              />
            );
          })}

          {/* Current time indicator */}
          {isRecording && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-60"
              style={{ right: '0%' }}
            />
          )}

          {timelineNotes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-gray-700 text-sm italic">Timeline appears here during recording</span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-2">
          {[...new Set(timelineNotes.map(n => n.pc))].sort((a, b) => a - b).map(pc => (
            <span key={pc} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: NOTE_COLORS[pc] }} />
              {NOTE_NAMES[pc as PitchClass]}
            </span>
          ))}
        </div>
      </div>

      {/* Symmetry group summary for recorded session */}
      {recordedSession && recordedSession.notes.length >= 2 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Session Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-gray-900 rounded p-3">
              <div className="text-xl font-bold text-indigo-400">
                {new Set(recordedSession.notes.map(n => n.pc)).size}
              </div>
              <div className="text-xs text-gray-500">Unique Notes</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-xl font-bold text-green-400">
                {recordedSession.notes.length}
              </div>
              <div className="text-xs text-gray-500">Total Events</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div className="text-xl font-bold text-yellow-400">
                {(recordedSession.durationMs / 1000).toFixed(1)}s
              </div>
              <div className="text-xs text-gray-500">Duration</div>
            </div>
            <div className="bg-gray-900 rounded p-3">
              <div
                className="text-xl font-bold"
                style={{ color: GROUP_COLORS[analysis?.abstractGroup ?? 'C1'] ?? '#6b7280' }}
              >
                {analysis?.abstractGroup ?? '—'}
              </div>
              <div className="text-xs text-gray-500">Symmetry Group</div>
            </div>
          </div>
          {tier === 'free' && (
            <p className="mt-3 text-xs text-gray-500 text-center">
              Free tier: 15-second sessions. Upgrade to Pro for unlimited recording.
            </p>
          )}
          {tier !== 'research' && (
            <p className="mt-1 text-xs text-gray-500 text-center">
              Research tier required to export session data.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
