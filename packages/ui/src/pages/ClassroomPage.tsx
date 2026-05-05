import { useState, useEffect } from 'react';
import ClassroomLobby from '../components/ClassroomLobby';
import ClassroomDashboard from '../components/ClassroomDashboard';

export default function ClassroomPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<{
    classroomId: string;
    role: 'teacher' | 'student';
    displayName: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.id) setUserId(data.id); })
      .catch(() => {});
  }, []);

  if (!session) {
    return (
      <ClassroomLobby
        onJoin={(classroomId, role, displayName) =>
          setSession({ classroomId, role, displayName })
        }
      />
    );
  }

  return (
    <ClassroomDashboard
      classroomId={session.classroomId}
      role={session.role}
      userId={userId || 'anonymous'}
      displayName={session.displayName}
    />
  );
}
