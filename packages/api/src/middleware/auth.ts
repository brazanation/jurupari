import type { Request, Response, NextFunction } from 'express';

const TOKEN = process.env.JURUPARI_TOKEN;

export function requireToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (header.slice(7) !== TOKEN) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

export function accessLevelFromRequest(req: Request): number {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return 0;
  return header.slice(7) === TOKEN ? 1 : 0;
}
