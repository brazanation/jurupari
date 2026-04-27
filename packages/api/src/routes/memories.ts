import { Router } from 'express';
import { z } from 'zod';
import {
  createMemory,
  updateMemory,
  deleteMemory,
  getMemoryById,
  listByCategory,
  searchMemories,
} from '@jurupari/core';
import { requireToken, accessLevelFromRequest } from '../middleware/auth.js';

export const memoriesRouter: Router = Router();

const CreateSchema = z.object({
  category:    z.string(),
  title:       z.string(),
  content:     z.string(),
  metadata:    z.record(z.unknown()).optional(),
  accessLevel: z.number().int().min(0).max(2).optional(),
});

const UpdateSchema = z.object({
  category:    z.string().optional(),
  title:       z.string().optional(),
  content:     z.string().optional(),
  metadata:    z.record(z.unknown()).optional(),
  accessLevel: z.number().int().min(0).max(2).optional(),
});

const SearchSchema = z.object({
  query:    z.string(),
  category: z.string().optional(),
  limit:    z.number().int().min(1).max(50).optional(),
});

// POST /memories/search — level-0 open; token unlocks level-1+
memoriesRouter.post('/search', async (req, res) => {
  const parsed = SearchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  const al = accessLevelFromRequest(req);
  res.json(await searchMemories({ ...parsed.data, maxAccessLevel: al }));
});

// GET /memories?category=X
memoriesRouter.get('/', async (req, res) => {
  const category = req.query.category as string;
  if (!category) { res.status(400).json({ error: 'category query param required' }); return; }
  res.json(await listByCategory(category, accessLevelFromRequest(req)));
});

// GET /memories/:id
memoriesRouter.get('/:id', async (req, res) => {
  const mem = await getMemoryById(req.params.id);
  if (!mem) { res.status(404).json({ error: 'Not found' }); return; }
  if (mem.accessLevel > accessLevelFromRequest(req)) { res.status(403).json({ error: 'Forbidden' }); return; }
  res.json(mem);
});

// POST /memories
memoriesRouter.post('/', requireToken, async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  res.status(201).json(await createMemory(parsed.data));
});

// PATCH /memories/:id
memoriesRouter.patch('/:id', requireToken, async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
  res.json(await updateMemory(req.params.id, parsed.data));
});

// DELETE /memories/:id
memoriesRouter.delete('/:id', requireToken, async (_req, res) => {
  await deleteMemory(_req.params.id);
  res.status(204).send();
});
