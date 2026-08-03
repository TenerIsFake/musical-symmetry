import { useState, useEffect, useCallback, useRef } from 'react';
import { wsUrl } from '../utils/apiBase';

export interface RoomParticipant {
  id: string;
  name: string;
  tier: string;
  isHost: boolean;
  pcs?: number[];
}

interface UseRoomOptions {
  name: string;
  tier: string;
}

interface UseRoomResult {
  participants: RoomParticipant[];
  pinnedPcs: number[] | null;
  submitPcs: (pcs: number[]) => void;
  pinPcs: (pcs: number[]) => void;
  isHost: boolean;
  isConnected: boolean;
  participantId: string | null;
}

const getWsUrl = wsUrl;

export function useRoom(roomId: string | null, options: UseRoomOptions): UseRoomResult {
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [pinnedPcs, setPinnedPcs] = useState<number[] | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Track per-participant pcs locally
  const participantPcsRef = useRef<Map<string, number[]>>(new Map());

  useEffect(() => {
    if (!roomId) return;

    const url = getWsUrl('/ws/rooms');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'join', roomId, name: options.name, tier: options.tier }));
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'state': {
          setPinnedPcs((msg.pinnedPcs as number[] | null) ?? null);
          const parts = (msg.participants as RoomParticipant[]) || [];
          // Restore pcs from ref
          setParticipants(parts.map(p => ({
            ...p,
            pcs: participantPcsRef.current.get(p.id),
          })));
          if (msg.isHost !== undefined) setIsHost(msg.isHost as boolean);
          if (msg.participantId) setParticipantId(msg.participantId as string);
          break;
        }

        case 'participant-pcs': {
          const pid = msg.participantId as string;
          const pcs = msg.pcs as number[];
          participantPcsRef.current.set(pid, pcs);
          setParticipants(prev =>
            prev.map(p => p.id === pid ? { ...p, pcs } : p)
          );
          break;
        }

        case 'participant-joined': {
          // A new state broadcast typically follows; just re-trigger if needed
          break;
        }

        case 'participant-left': {
          // State will be refreshed on next state broadcast; remove by name as fallback
          const name = msg.name as string;
          setParticipants(prev => prev.filter(p => p.name !== name));
          break;
        }
      }
    };

    return () => {
      ws.send(JSON.stringify({ type: 'leave' }));
      ws.close();
      participantPcsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const submitPcs = useCallback((pcs: number[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set-pcs', pcs }));
    }
  }, []);

  const pinPcs = useCallback((pcs: number[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'pin', pcs }));
    }
  }, []);

  return { participants, pinnedPcs, submitPcs, pinPcs, isHost, isConnected, participantId };
}
