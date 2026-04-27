import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { memoriesRouter } from './routes/memories.js';
import { createMcpRouter } from './mcp-router.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => res.send('jurupari.org by pvgomes.com - 2026'));
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'jurupari' }));
app.use('/memories', memoriesRouter);
app.use('/mcp', createMcpRouter());

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`jurupari listening on :${port}`);
  console.log(`  REST  → http://localhost:${port}/memories`);
  console.log(`  MCP   → http://localhost:${port}/mcp`);
});
