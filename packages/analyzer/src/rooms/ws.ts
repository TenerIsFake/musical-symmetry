import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

interface Participant {
  ws: WebSocket;
  name: string;
  tier: string;
}

interface Room {
  id: string;
  hostId: string;
  participants: Map<string, Participant>;
  pinnedPcs: number[] | null;
  createdAt: number;
  lastActivity: number;
}

const rooms = new Map<string, Room>();

const ROOM_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_PARTICIPANTS = 20;

export function initRoomsWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws/rooms' });

  wss.on('connection', (ws) => {
    let roomId: string | null = null;
    let participantId: string | null = null;

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
          const rid = msg.roomId as string;
          const name = (msg.name as string) || 'Anonymous';
          const tier = (msg.tier as string) || 'free';

          if (!rid) {
            ws.send(JSON.stringify({ type: 'error', message: 'roomId required' }));
            return;
          }

          let room = rooms.get(rid);
          if (!room) {
            // Create room on first join — this participant becomes the host
            const pid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            room = {
              id: rid,
              hostId: pid,
              participants: new Map(),
              pinnedPcs: null,
              createdAt: Date.now(),
              lastActivity: Date.now(),
            };
            rooms.set(rid, room);
            roomId = rid;
            participantId = pid;
            room.participants.set(pid, { ws, name, tier });
          } else {
            if (room.participants.size >= MAX_PARTICIPANTS) {
              ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
              return;
            }
            const pid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            roomId = rid;
            participantId = pid;
            room.participants.set(pid, { ws, name, tier });
            room.lastActivity = Date.now();
          }

          // Broadcast participant-joined to others
          broadcastToOthers(room, participantId, { type: 'participant-joined', name });

          // Send current state to joining participant
          ws.send(JSON.stringify({
            type: 'state',
            pinnedPcs: room.pinnedPcs,
            participants: serializeParticipants(room),
            isHost: participantId === room.hostId,
            participantId,
          }));
          break;
        }

        case 'set-pcs': {
          if (!roomId || !participantId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          const participant = room.participants.get(participantId);
          if (!participant) return;

          // Free tier: view only, cannot submit
          if (participant.tier === 'free') {
            ws.send(JSON.stringify({ type: 'error', message: 'Upgrade to Pro to submit pitch classes' }));
            return;
          }

          const pcs = msg.pcs as number[];
          room.lastActivity = Date.now();

          broadcastToRoom(room, {
            type: 'participant-pcs',
            participantId,
            name: participant.name,
            pcs,
          });
          break;
        }

        case 'pin': {
          if (!roomId || !participantId) return;
          const room = rooms.get(roomId);
          if (!room) return;

          // Only host can pin
          if (participantId !== room.hostId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only the host can pin a set' }));
            return;
          }

          room.pinnedPcs = msg.pcs as number[];
          room.lastActivity = Date.now();

          broadcastToRoom(room, {
            type: 'state',
            pinnedPcs: room.pinnedPcs,
            participants: serializeParticipants(room),
          });
          break;
        }

        case 'leave': {
          handleLeave(ws, roomId, participantId);
          roomId = null;
          participantId = null;
          break;
        }
      }
    });

    ws.on('close', () => {
      handleLeave(ws, roomId, participantId);
    });
  });

  // Prune expired rooms every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
      if (now - room.lastActivity > ROOM_TTL_MS) {
        // Close all connections
        for (const participant of room.participants.values()) {
          try { participant.ws.close(); } catch {}
        }
        rooms.delete(id);
      }
    }
  }, 5 * 60 * 1000);
}

function handleLeave(ws: WebSocket, roomId: string | null, participantId: string | null): void {
  if (!roomId || !participantId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const participant = room.participants.get(participantId);
  if (!participant) return;

  const name = participant.name;
  room.participants.delete(participantId);

  if (room.participants.size === 0) {
    rooms.delete(roomId);
    return;
  }

  // If host left, assign new host
  if (participantId === room.hostId) {
    room.hostId = room.participants.keys().next().value as string;
  }

  broadcastToRoom(room, { type: 'participant-left', name });
}

function broadcastToRoom(room: Room, data: unknown): void {
  const msg = JSON.stringify(data);
  for (const participant of room.participants.values()) {
    if (participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(msg);
    }
  }
}

function broadcastToOthers(room: Room, senderId: string, data: unknown): void {
  const msg = JSON.stringify(data);
  for (const [id, participant] of room.participants) {
    if (id !== senderId && participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(msg);
    }
  }
}

function serializeParticipants(room: Room): { id: string; name: string; tier: string; isHost: boolean }[] {
  return Array.from(room.participants.entries()).map(([id, p]) => ({
    id,
    name: p.name,
    tier: p.tier,
    isHost: id === room.hostId,
  }));
}

// Exported for use in routes
export function getRoomMeta(roomId: string): { roomId: string; participantCount: number; hostName: string; createdAt: number } | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const host = room.participants.get(room.hostId);
  return {
    roomId: room.id,
    participantCount: room.participants.size,
    hostName: host?.name || 'Unknown',
    createdAt: room.createdAt,
  };
}
