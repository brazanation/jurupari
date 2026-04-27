import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createMemory,
  updateMemory,
  deleteMemory,
  getMemoryById,
  listByCategory,
  searchMemories,
} from '@jurupari/core';

/**
 * Creates a configured MCP server instance.
 *
 * accessLevel is resolved by the transport layer (stdio or SSE),
 * not by the tool caller. Tools no longer need a token argument.
 *
 *   0 = unauthenticated — read-only, level-0 data only
 *   1 = authenticated   — full read/write, level-0 and level-1 data
 */
export function createMcpServer(accessLevel: number): Server {
  const server = new Server(
    { name: 'jurupari', version: '0.0.1' },
    { capabilities: { tools: {} } },
  );

  const canWrite = accessLevel >= 1;

  const ok = (data: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  });
  const err = (msg: string) => ({
    content: [{ type: 'text' as const, text: `Error: ${msg}` }],
    isError: true as const,
  });
  const forbidden = () => err('write operations require authentication');

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'memory_search',
        description: `Semantic vector search. Returns level-0 data. ${
          canWrite ? 'Also returns level-1 data (authenticated session).' : ''
        }`,
        inputSchema: {
          type: 'object',
          properties: {
            query:    { type: 'string',  description: 'Natural language query' },
            category: { type: 'string',  description: 'Optional category filter' },
            limit:    { type: 'number',  description: 'Max results (default 10)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'memory_add',
        description: 'Store a new memory. Requires authenticated session.',
        inputSchema: {
          type: 'object',
          properties: {
            category:     { type: 'string' },
            title:        { type: 'string' },
            content:      { type: 'string' },
            metadata:     { type: 'object', description: 'Arbitrary key-value data (dates, numbers, identifiers…)' },
            access_level: { type: 'number', description: 'ONLY set this if the user explicitly says "level 1" or "access level 1". Default is 0. Never infer level from content sensitivity.' },
          },
          required: ['category', 'title', 'content'],
        },
      },
      {
        name: 'memory_update',
        description: 'Update an existing memory by ID. Requires authenticated session.',
        inputSchema: {
          type: 'object',
          properties: {
            id:           { type: 'string' },
            category:     { type: 'string' },
            title:        { type: 'string' },
            content:      { type: 'string' },
            metadata:     { type: 'object' },
            access_level: { type: 'number', description: 'ONLY set this if the user explicitly requests a level change.' },
          },
          required: ['id'],
        },
      },
      {
        name: 'memory_delete',
        description: 'Delete a memory by ID. Requires authenticated session.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
      {
        name: 'memory_get',
        description: 'Fetch a single memory by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
      {
        name: 'memory_list',
        description: 'List all memories in a category.',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string' },
          },
          required: ['category'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    const a = args as Record<string, unknown>;

    try {
      switch (name) {
        case 'memory_search':
          return ok(await searchMemories({
            query:          a.query as string,
            category:       a.category as string | undefined,
            limit:          a.limit as number | undefined,
            maxAccessLevel: accessLevel,
          }));

        case 'memory_add': {
          if (!canWrite) return forbidden();
          const level = (a.access_level as number) ?? 0;
          return ok(await createMemory({
            category:    a.category as string,
            title:       a.title as string,
            content:     a.content as string,
            metadata:    a.metadata as Record<string, unknown> | undefined,
            accessLevel: level,
          }));
        }

        case 'memory_update':
          if (!canWrite) return forbidden();
          return ok(await updateMemory(a.id as string, {
            category:    a.category as string | undefined,
            title:       a.title as string | undefined,
            content:     a.content as string | undefined,
            metadata:    a.metadata as Record<string, unknown> | undefined,
            accessLevel: a.access_level as number | undefined,
          }));

        case 'memory_delete':
          if (!canWrite) return forbidden();
          await deleteMemory(a.id as string);
          return ok({ deleted: a.id });

        case 'memory_get': {
          const mem = await getMemoryById(a.id as string);
          if (!mem) return err('not found');
          if (mem.accessLevel > accessLevel) return err('insufficient access level');
          return ok(mem);
        }

        case 'memory_list':
          return ok(await listByCategory(a.category as string, accessLevel));

        default:
          return err(`unknown tool: ${name}`);
      }
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
  });

  return server;
}
