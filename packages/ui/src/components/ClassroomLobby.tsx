import { useState } from 'react';
import { API_BASE } from '../utils/apiBase';

interface Props {
  onJoin: (classroomId: string, role: 'teacher' | 'student', displayName: string) => void;
}

export default function ClassroomLobby({ onJoin }: Props) {
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!roomName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/classroom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: roomName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error);
        return;
      }
      const { classroom } = await res.json();
      onJoin(classroom.id, 'teacher', 'Teacher');
    } catch { setError('Failed to create classroom'); }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !displayName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/classroom/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: joinCode.trim(), displayName: displayName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error);
        return;
      }
      const { classroom } = await res.json();
      onJoin(classroom.id, 'student', displayName.trim());
    } catch { setError('Failed to join classroom'); }
  }

  if (mode === 'choice') {
    return (
      <div className="max-w-md mx-auto mt-20 space-y-4 text-center">
        <h1 className="text-2xl font-bold">Classroom Mode</h1>
        <p className="text-gray-400">Analyze chords together in real time</p>
        <div className="flex gap-4 justify-center">
          <button onClick={() => setMode('create')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium">
            Create Classroom
          </button>
          <button onClick={() => setMode('join')} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium">
            Join Classroom
          </button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="max-w-md mx-auto mt-20 space-y-4">
        <h2 className="text-xl font-bold">Create Classroom</h2>
        <input
          value={roomName}
          onChange={e => setRoomName(e.target.value)}
          placeholder="Classroom name..."
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
        />
        <button onClick={handleCreate} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white">
          Create
        </button>
        <button onClick={() => setMode('choice')} className="w-full text-sm text-gray-400 hover:text-gray-300">
          Back
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-4">
      <h2 className="text-xl font-bold">Join Classroom</h2>
      <input
        value={joinCode}
        onChange={e => setJoinCode(e.target.value.toUpperCase())}
        placeholder="Room code (e.g. A1B2C3)"
        maxLength={6}
        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white font-mono text-center text-lg tracking-widest"
      />
      <input
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        placeholder="Your name"
        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
      />
      <button onClick={handleJoin} className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white">
        Join
      </button>
      <button onClick={() => setMode('choice')} className="w-full text-sm text-gray-400 hover:text-gray-300">
        Back
      </button>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
