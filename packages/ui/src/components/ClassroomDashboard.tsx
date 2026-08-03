import { useEffect, useState } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { classify, NOTE_NAMES } from '@musical-symmetry/core';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsUrl as buildWsUrl } from '../utils/apiBase';

interface StudentEntry {
  userId: string;
  displayName: string;
  pitchClasses: PitchClass[];
  group: string;
}

interface Props {
  classroomId: string;
  role: 'teacher' | 'student';
  userId: string;
  displayName: string;
}

export default function ClassroomDashboard({ classroomId, role, userId, displayName }: Props) {
  const wsUrl = buildWsUrl('/ws/classroom');
  const { connected, lastMessage, send } = useWebSocket(wsUrl);
  const [students, setStudents] = useState<Map<string, StudentEntry>>(new Map());
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (connected) {
      send({ type: 'join', classroomId, userId, displayName, role });
    }
  }, [connected, classroomId, userId, displayName, role, send]);

  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== 'object') return;
    const msg = lastMessage as Record<string, unknown>;

    switch (msg.type) {
      case 'student-analysis': {
        const data = msg.data as { pitchClasses: PitchClass[]; group: string };
        setStudents(prev => {
          const next = new Map(prev);
          next.set(msg.userId as string, {
            userId: msg.userId as string,
            displayName: msg.displayName as string,
            pitchClasses: data.pitchClasses,
            group: data.group,
          });
          return next;
        });
        break;
      }
      case 'member-joined':
      case 'member-left':
        setMemberCount(msg.memberCount as number);
        break;
    }
  }, [lastMessage]);

  if (!connected) {
    return <div className="text-center text-gray-400 mt-10">Connecting to classroom...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Classroom</h1>
          <p className="text-sm text-gray-400">{memberCount} members connected</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-300">Live</span>
        </div>
      </div>

      {role === 'teacher' && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Student Analyses</h2>
          {students.size === 0 ? (
            <p className="text-gray-500 text-sm italic">Waiting for students to analyze chords...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[...students.values()].map(s => (
                <div key={s.userId} className="bg-gray-900 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{s.displayName}</span>
                    <span className="text-xs text-indigo-400">{s.group}</span>
                  </div>
                  <div className="flex gap-1">
                    {s.pitchClasses.map(pc => (
                      <span key={pc} className="px-1.5 py-0.5 bg-green-900 text-green-300 text-xs rounded">
                        {NOTE_NAMES[pc]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
