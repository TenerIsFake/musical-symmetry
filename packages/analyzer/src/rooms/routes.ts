import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getRoomMeta } from './ws.js';

export const roomsRouter = Router();

function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// POST / — create a room (auth required)
roomsRouter.post('/', requireAuth, (req, res) => {
  const roomId = generateRoomId();
  // Room is created lazily on first WS join; we just hand back the ID here
  res.json({ roomId });
});

// GET /:roomId — public room metadata
roomsRouter.get('/:roomId', (req, res) => {
  const { roomId } = req.params;
  const meta = getRoomMeta(roomId);
  if (!meta) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json(meta);
});
