import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import {
  createClassroom, getClassroomByCode, joinClassroom,
  getClassroomMembers, closeClassroom, getTeacherClassrooms,
  initClassroomSchema,
} from './db.js';
import '../auth/types.js';

export const classroomRouter = Router();

initClassroomSchema();

classroomRouter.use(requireAuth);

classroomRouter.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.length > 100) {
    res.status(400).json({ error: 'Name is required (max 100 chars)' });
    return;
  }
  const user = req.user!;
  if (user.tier !== 'pro' && user.tier !== 'research') {
    res.status(403).json({ error: 'Classroom mode requires Pro or Research tier' });
    return;
  }
  const classroom = createClassroom(user.id, name.trim());
  res.status(201).json({ classroom });
});

classroomRouter.post('/join', (req, res) => {
  const { code, displayName } = req.body;
  if (!code || !displayName) {
    res.status(400).json({ error: 'code and displayName are required' });
    return;
  }
  const classroom = getClassroomByCode(code.toUpperCase());
  if (!classroom) {
    res.status(404).json({ error: 'Classroom not found or inactive' });
    return;
  }
  const member = joinClassroom(classroom.id, req.user!.id, displayName);
  res.json({ classroom, member });
});

classroomRouter.get('/:id/members', (req, res) => {
  const members = getClassroomMembers(req.params.id);
  res.json({ members });
});

classroomRouter.post('/:id/close', (req, res) => {
  const closed = closeClassroom(req.params.id, req.user!.id);
  res.json({ closed });
});

classroomRouter.get('/mine', (req, res) => {
  const classrooms = getTeacherClassrooms(req.user!.id);
  res.json({ classrooms });
});
