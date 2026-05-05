import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { getClassroomById, getClassroomMembers } from './db.js';

interface ClassroomClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  role: 'teacher' | 'student';
  classroomId: string;
  lastAnalysis?: unknown;
}

const rooms = new Map<string, Set<ClassroomClient>>();

export function initClassroomWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/classroom' });

  wss.on('connection', (ws) => {
    let client: ClassroomClient | null = null;

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
      }

      switch (msg.type) {
        case 'join': {
          const classroomId = msg.classroomId as string;
          const classroom = getClassroomById(classroomId);
          if (!classroom || !classroom.active) {
            ws.send(JSON.stringify({ type: 'error', message: 'Classroom not found' }));
            return;
          }

          // Verify the user is a member (was added via authenticated REST endpoint)
          const msgUserId = msg.userId as string;
          const members = getClassroomMembers(classroomId);
          const isTeacher = classroom.teacher_id === msgUserId;
          const isMember = members.some(m => m.user_id === msgUserId);
          if (!isTeacher && !isMember) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not a member of this classroom' }));
            return;
          }

          client = {
            ws,
            userId: msg.userId as string,
            displayName: msg.displayName as string,
            role: msg.role as 'teacher' | 'student',
            classroomId,
          };

          if (!rooms.has(classroomId)) {
            rooms.set(classroomId, new Set());
          }
          rooms.get(classroomId)!.add(client);

          broadcast(classroomId, {
            type: 'member-joined',
            displayName: client.displayName,
            role: client.role,
            memberCount: rooms.get(classroomId)!.size,
          });
          break;
        }

        case 'analysis': {
          if (!client) return;
          client.lastAnalysis = msg.data;
          broadcast(client.classroomId, {
            type: 'student-analysis',
            userId: client.userId,
            displayName: client.displayName,
            data: msg.data,
          });
          break;
        }

        case 'teacher-set-chord': {
          if (!client || client.role !== 'teacher') return;
          broadcast(client.classroomId, {
            type: 'set-chord',
            pitchClasses: msg.pitchClasses,
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      if (client) {
        const room = rooms.get(client.classroomId);
        if (room) {
          room.delete(client);
          broadcast(client.classroomId, {
            type: 'member-left',
            displayName: client.displayName,
            memberCount: room.size,
          });
          if (room.size === 0) rooms.delete(client.classroomId);
        }
      }
    });
  });
}

function broadcast(classroomId: string, data: unknown): void {
  const room = rooms.get(classroomId);
  if (!room) return;
  const msg = JSON.stringify(data);
  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}
