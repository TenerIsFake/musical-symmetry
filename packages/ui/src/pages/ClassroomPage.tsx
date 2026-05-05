import { useState } from 'react';
import ClassroomLobby from '../components/ClassroomLobby';
import ClassroomDashboard from '../components/ClassroomDashboard';

export default function ClassroomPage() {
  const [session, setSession] = useState<{
    classroomId: string;
    role: 'teacher' | 'student';
    displayName: string;
  } | null>(null);

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
      userId="current-user"
      displayName={session.displayName}
    />
  );
}
