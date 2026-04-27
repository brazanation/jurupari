import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '@jurupari/mcp';

const TOKEN = process.env.JURUPARI_TOKEN;

function resolveAccessLevel(token?: string): number {
  if (!token || !TOKEN) return 0;
  return token === TOKEN ? 1 : 0;
}

export function createMcpRouter(): Router {
  const router = Router();
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  router.all('/', async (req, res) => {
    // Keep Railway's proxy from killing idle SSE streams.
    // Pings fire every 15 s; the interval clears itself once the response ends.
    if (req.method === 'GET') {
      const ping = setInterval(() => {
        if (res.writableEnded) { clearInterval(ping); return; }
        res.write(': ping\n\n');
      }, 15_000);
      res.on('close', () => clearInterval(ping));
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId) {
      const transport = sessions.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: 'session not found or expired' });
        return;
      }
      await transport.handleRequest(req, res, req.body);
      return;
    }

    const token = (req.query.token as string | undefined)
      ?? (req.headers['authorization'] as string | undefined)?.replace('Bearer ', '');
    const accessLevel = resolveAccessLevel(token);

    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { sessions.set(id, transport); },
      onsessionclosed: (id) => { sessions.delete(id); },
    });

    const server = createMcpServer(accessLevel);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return router;
}
