import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server.js';

// stdio = trusted local process (Claude Desktop, Claude Code, Cursor).
// Token is already in env; no per-call auth needed. Full access.
const server = createMcpServer(1);
const transport = new StdioServerTransport();
await server.connect(transport);
