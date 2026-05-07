import { Router } from 'express';
import { randomBytes } from 'crypto';
import { requireAuth } from '../auth/middleware.js';
import { requireTier } from '../auth/middleware.js';
import { getDb } from '../auth/db.js';
import '../auth/types.js';

export const workspacesRouter = Router();

type WorkspaceType = 'classifier' | 'analyzer' | 'progression';

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  type: WorkspaceType;
  data: string;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  type: WorkspaceType;
  created_at: string;
  updated_at: string;
}

const TIER_WORKSPACE_LIMITS: Record<string, number> = {
  free: 3,
  pro: -1,
  research: -1,
};

function initWorkspacesSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('classifier', 'analyzer', 'progression')),
      data TEXT NOT NULL,
      share_token TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
    CREATE INDEX IF NOT EXISTS idx_workspaces_share ON workspaces(share_token);
  `);
}

initWorkspacesSchema();

// GET /api/workspaces — list user's saved workspaces
workspacesRouter.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const workspaces = db.prepare(`
    SELECT id, name, type, created_at, updated_at
    FROM workspaces
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(req.user!.id) as WorkspaceSummary[];
  res.json({ workspaces });
});

// POST /api/workspaces — save a new workspace
workspacesRouter.post('/', requireAuth, (req, res) => {
  const { name, type, data } = req.body as {
    name: unknown;
    type: unknown;
    data: unknown;
  };

  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    res.status(400).json({ error: 'name is required (max 100 chars)' });
    return;
  }

  const validTypes: WorkspaceType[] = ['classifier', 'analyzer', 'progression'];
  if (!type || !validTypes.includes(type as WorkspaceType)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    res.status(400).json({ error: 'data must be a JSON object' });
    return;
  }

  const db = getDb();
  const tier = req.user!.tier;
  const limit = TIER_WORKSPACE_LIMITS[tier] ?? 3;

  if (limit !== -1) {
    const countRow = db.prepare('SELECT COUNT(*) as c FROM workspaces WHERE user_id = ?').get(req.user!.id) as { c: number };
    if (countRow.c >= limit) {
      res.status(403).json({
        error: `Workspace limit reached (${limit} on ${tier} plan). Upgrade for unlimited saves.`,
        upgrade: 'https://symmetry.tendrid.us/pricing',
        limit,
      });
      return;
    }
  }

  const id = randomBytes(16).toString('hex');
  const dataJson = JSON.stringify(data);

  db.prepare(`
    INSERT INTO workspaces (id, user_id, name, type, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user!.id, name.trim(), type as WorkspaceType, dataJson);

  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as Workspace;
  res.status(201).json({ workspace: { ...workspace, data: JSON.parse(workspace.data) } });
});

// GET /api/workspaces/shared/:token — public, read-only shared workspace
workspacesRouter.get('/shared/:token', (req, res) => {
  const db = getDb();
  const workspace = db.prepare('SELECT * FROM workspaces WHERE share_token = ?').get(req.params.token) as Workspace | undefined;
  if (!workspace) {
    res.status(404).json({ error: 'Shared workspace not found' });
    return;
  }
  res.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      data: JSON.parse(workspace.data),
      created_at: workspace.created_at,
      updated_at: workspace.updated_at,
    },
  });
});

// GET /api/workspaces/:id — get a single workspace with full data
workspacesRouter.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as Workspace | undefined;
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json({ workspace: { ...workspace, data: JSON.parse(workspace.data) } });
});

// PUT /api/workspaces/:id — update workspace name or data
workspacesRouter.put('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM workspaces WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as Workspace | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const { name, data } = req.body as { name?: unknown; data?: unknown };

  let newName = existing.name;
  let newData = existing.data;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      res.status(400).json({ error: 'name must be a non-empty string (max 100 chars)' });
      return;
    }
    newName = name.trim();
  }

  if (data !== undefined) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      res.status(400).json({ error: 'data must be a JSON object' });
      return;
    }
    newData = JSON.stringify(data);
  }

  db.prepare(`
    UPDATE workspaces
    SET name = ?, data = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(newName, newData, req.params.id, req.user!.id);

  const updated = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id) as Workspace;
  res.json({ workspace: { ...updated, data: JSON.parse(updated.data) } });
});

// DELETE /api/workspaces/:id — delete a workspace
workspacesRouter.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM workspaces WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json({ deleted: true });
});

// POST /api/workspaces/:id/share — generate a share link (research tier only)
workspacesRouter.post('/:id/share', requireAuth, requireTier('research'), (req, res) => {
  const db = getDb();
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as Workspace | undefined;
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const token = randomBytes(24).toString('hex');
  db.prepare('UPDATE workspaces SET share_token = ? WHERE id = ?').run(token, req.params.id);

  res.json({
    shareToken: token,
    shareUrl: `/api/workspaces/shared/${token}`,
  });
});
