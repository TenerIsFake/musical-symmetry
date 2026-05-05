import { randomBytes } from 'crypto';
import { getDb } from '../auth/db.js';

export interface Classroom {
  id: string;
  code: string;
  teacher_id: string;
  name: string;
  active: number;
  created_at: string;
}

export interface ClassroomMember {
  id: string;
  classroom_id: string;
  user_id: string;
  display_name: string;
  role: 'teacher' | 'student';
  joined_at: string;
}

export function initClassroomSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      teacher_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classroom_members (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      joined_at TEXT DEFAULT (datetime('now')),
      UNIQUE(classroom_id, user_id)
    );
  `);
}

function generateCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

export function createClassroom(teacherId: string, name: string): Classroom {
  const db = getDb();
  const id = generateId();
  const code = generateCode();
  db.prepare('INSERT INTO classrooms (id, code, teacher_id, name) VALUES (?, ?, ?, ?)').run(id, code, teacherId, name);
  return db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id) as Classroom;
}

export function getClassroomByCode(code: string): Classroom | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM classrooms WHERE code = ? AND active = 1').get(code) as Classroom | undefined;
}

export function getClassroomById(id: string): Classroom | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id) as Classroom | undefined;
}

export function joinClassroom(classroomId: string, userId: string, displayName: string): ClassroomMember {
  const db = getDb();
  const id = generateId();
  db.prepare(`
    INSERT INTO classroom_members (id, classroom_id, user_id, display_name, role)
    VALUES (?, ?, ?, ?, 'student')
    ON CONFLICT(classroom_id, user_id) DO UPDATE SET display_name = excluded.display_name
  `).run(id, classroomId, userId, displayName);
  return db.prepare('SELECT * FROM classroom_members WHERE classroom_id = ? AND user_id = ?')
    .get(classroomId, userId) as ClassroomMember;
}

export function getClassroomMembers(classroomId: string): ClassroomMember[] {
  const db = getDb();
  return db.prepare('SELECT * FROM classroom_members WHERE classroom_id = ? ORDER BY joined_at')
    .all(classroomId) as ClassroomMember[];
}

export function closeClassroom(classroomId: string, teacherId: string): boolean {
  const db = getDb();
  const result = db.prepare('UPDATE classrooms SET active = 0 WHERE id = ? AND teacher_id = ?')
    .run(classroomId, teacherId);
  return result.changes > 0;
}

export function getTeacherClassrooms(teacherId: string): Classroom[] {
  const db = getDb();
  return db.prepare('SELECT * FROM classrooms WHERE teacher_id = ? ORDER BY created_at DESC')
    .all(teacherId) as Classroom[];
}
