import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDb } from '../auth/db.js';
import '../auth/types.js';
import {
  getPublicCollections,
  getPublicCollection,
  publishCollection,
  unpublishCollection,
  makeUniqueSlug,
  countPublishedCollections,
} from './db.js';

export const publicProfilesRouter = Router();

const PRO_PUBLISH_LIMIT = 10;

// POST /api/public/collections/:id/publish — publish a collection
// Registered before /:username to avoid wildcard capture of "collections"
publicProfilesRouter.post('/collections/:id/publish', requireAuth, (req, res) => {
  const user = req.user!;
  const collectionId = req.params.id;

  // Only pro/research can publish
  if (user.tier !== 'pro' && user.tier !== 'research') {
    res.status(403).json({ error: 'Publishing requires Pro or Research tier' });
    return;
  }

  // Enforce pro limit (max 10 published)
  if (user.tier === 'pro') {
    const currentCount = countPublishedCollections(user.id);
    if (currentCount >= PRO_PUBLISH_LIMIT) {
      res.status(403).json({
        error: `Pro tier allows up to ${PRO_PUBLISH_LIMIT} published collections. Upgrade to Research for unlimited.`,
      });
      return;
    }
  }

  // Determine slug
  let slug: string;
  if (req.body?.slug && typeof req.body.slug === 'string') {
    slug = req.body.slug
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) {
      res.status(400).json({ error: 'Invalid slug' });
      return;
    }
  } else {
    const db = getDb();
    const row = db.prepare('SELECT name FROM collections WHERE id = ? AND user_id = ?')
      .get(collectionId, user.id) as { name: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }
    slug = makeUniqueSlug(user.id, row.name);
  }

  const ok = publishCollection(collectionId, user.id, slug);
  if (!ok) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }
  res.json({ published: true, slug });
});

// DELETE /api/public/collections/:id/publish — unpublish a collection
publicProfilesRouter.delete('/collections/:id/publish', requireAuth, (req, res) => {
  const ok = unpublishCollection(req.params.id, req.user!.id);
  if (!ok) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }
  res.json({ published: false });
});

// GET /api/public/:username — list all published collections for a user
publicProfilesRouter.get('/:username', (req, res) => {
  const result = getPublicCollections(req.params.username);
  if (!result) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(result);
});

// GET /api/public/:username/:slug — single published collection with items
publicProfilesRouter.get('/:username/:slug', (req, res) => {
  const result = getPublicCollection(req.params.username, req.params.slug);
  if (!result) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }
  res.json(result);
});
