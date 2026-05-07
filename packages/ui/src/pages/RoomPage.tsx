import { useState, useEffect, useCallback } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { classify } from '@musical-symmetry/core';
import { useUser } from '../context/UserContext';
import { useRoom } from '../hooks/useRoom';
import PianoKeyboard from '../components/PianoKeyboard';
import ClassificationPanel from '../components/ClassificationPanel';
import OrbitDiagram from '../components/OrbitDiagram';

interface RoomPageProps {
  roomId: string;
}

export default function RoomPage({ roomId }: RoomPageProps) {
  const { user, loading } = useUser();
  const name = user?.email?.split('@')[0] || 'Guest';
  const tier = user?.tier || 'free';
  const canSubmit = !!user && user.tier !== 'free';

  const { participants, pinnedPcs, submitPcs, pinPcs, isHost, isConnected, participantId } =
    useRoom(roomId, { name, tier });

  const [localPcs, setLocalPcs] = useState<PitchClass[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Analysis of pinned set
  const pinnedAnalysis = pinnedPcs && pinnedPcs.length > 0
    ? classify(pinnedPcs as PitchClass[])
    : null;

  const shareUrl = `${window.location.origin}${window.location.pathname}#room/${roomId}`;

  const handleToggle = useCallback((pc: PitchClass) => {
    setLocalPcs(prev =>
      prev.includes(pc) ? prev.filter(p => p !== pc) : [...prev, pc].sort((a, b) => a - b)
    );
    setSubmitted(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    submitPcs(localPcs);
    setSubmitted(true);
  }, [canSubmit, localPcs, submitPcs]);

  const handlePin = useCallback((pcs: number[]) => {
    pinPcs(pcs);
  }, [pinPcs]);

  const copyShareUrl = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  }, [shareUrl]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Room Info Bar */}
      <div className="bg-gray-800 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-sm text-gray-300 font-mono">Room: {roomId}</span>
        </div>
        <span className="text-sm text-gray-400">
          {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </span>
        {isHost && (
          <span className="px-2 py-0.5 bg-indigo-700 text-xs rounded text-white font-medium">Host</span>
        )}
        <button
          onClick={copyShareUrl}
          className="ml-auto px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
          title="Copy shareable link"
        >
          Copy Invite Link
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Shared pinned analysis */}
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Shared Analysis
            </h2>
            {pinnedPcs && pinnedPcs.length > 0 ? (
              <>
                <PianoKeyboard
                  selectedPCs={pinnedPcs as PitchClass[]}
                  onToggle={() => {}}
                />
                <div className="mt-4">
                  <OrbitDiagram
                    selectedPCs={pinnedPcs as PitchClass[]}
                    analysis={pinnedAnalysis}
                    onTogglePC={() => {}}
                  />
                </div>
                <div className="mt-4">
                  <ClassificationPanel analysis={pinnedAnalysis} chord={null} />
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                {isHost
                  ? 'Pin a participant\'s submission to display it here'
                  : 'Waiting for host to pin a set…'}
              </div>
            )}
          </div>
        </div>

        {/* Right: Participants + Submission */}
        <div className="space-y-4">
          {/* Participant List */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Participants
            </h2>
            {participants.length === 0 ? (
              <p className="text-gray-500 text-sm">No one else here yet.</p>
            ) : (
              <ul className="space-y-2">
                {participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-gray-200">
                      {p.name}
                      {p.isHost && (
                        <span className="ml-1.5 text-xs text-indigo-400">(host)</span>
                      )}
                      {p.id === participantId && (
                        <span className="ml-1.5 text-xs text-gray-500">(you)</span>
                      )}
                    </span>
                    {p.pcs && p.pcs.length > 0 && (
                      <span className="text-xs text-gray-400 font-mono">
                        {'{' + p.pcs.join(',') + '}'}
                      </span>
                    )}
                    {isHost && p.pcs && p.pcs.length > 0 && p.id !== participantId && (
                      <button
                        onClick={() => handlePin(p.pcs!)}
                        className="px-2 py-0.5 bg-indigo-700 hover:bg-indigo-600 rounded text-xs text-white transition-colors"
                      >
                        Pin
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Submission Panel */}
          {canSubmit ? (
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Your Submission
              </h2>
              <PianoKeyboard
                selectedPCs={localPcs}
                onToggle={handleToggle}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={localPcs.length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-medium text-white transition-colors"
                >
                  {submitted ? 'Submitted' : 'Submit to Room'}
                </button>
                <button
                  onClick={() => { setLocalPcs([]); setSubmitted(false); }}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
                >
                  Clear
                </button>
                {isHost && localPcs.length > 0 && (
                  <button
                    onClick={() => handlePin(localPcs)}
                    className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 rounded text-sm text-white transition-colors"
                  >
                    Pin My Set
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Submission
              </h2>
              <p className="text-sm text-gray-400 mb-3">
                Free tier users can view shared analyses but cannot submit pitch classes.
              </p>
              <a
                href="#dashboard"
                className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium text-white transition-colors"
              >
                Upgrade to Pro
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
