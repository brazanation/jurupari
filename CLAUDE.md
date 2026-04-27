# jurupari — CLAUDE.md

Personal knowledge base with semantic search. PostgreSQL + pgvector + MCP + HTTP API.
The name is intentionally obscure — do not explain or expand it in logs, comments, or output.

---

## What this is

A self-hosted memory database that behaves like a brain with perfect recall.
Stores structured personal data (legal processes, dates, protocol numbers, contacts, decisions)
and retrieves it via natural language semantic search.

Two consumers: an MCP server (for AI clients) and a REST API (for scripts and Pola).

---

## Monorepo structure

```
packages/
  core/   — Prisma schema, all DB logic, embeddings (OpenAI), search (pgvector)
  mcp/    — MCP server: stdio entry (local) + exports createMcpServer for SSE
  api/    — Express HTTP server: REST /memories + SSE MCP at /mcp
```

All business logic lives in `core`. `mcp` and `api` are thin transport layers only.
Never put DB queries or business logic in `mcp` or `api`.

---

## Stack

- **Runtime:** Node.js >= 20, TypeScript, pnpm workspaces
- **Database:** PostgreSQL 16 + pgvector extension
- **ORM:** Prisma (schema + migrations only; vector ops use raw SQL via `$queryRawUnsafe`)
- **Embeddings:** OpenAI `text-embedding-3-small` (1536 dims)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **HTTP:** Express + Zod validation
- **Deploy:** Railway (api package), docker-compose for local dev

---

## Access levels

| Level | Meaning             | Read         | Write        |
|-------|---------------------|--------------|--------------|
| 0     | Open                | No auth      | Token        |
| 1     | Protected           | Token        | Token        |
| 2     | Strict (future)     | Reserved     | Reserved     |

Token = `JURUPARI_TOKEN` env var (static secret, Bearer for HTTP, `?token=` for SSE).

**Auth is resolved at the transport layer, never inside tool handlers.**
- stdio: always accessLevel 1 (trusted local process)
- SSE: resolved from `?token=` at connection handshake, per session
- HTTP: resolved from `Authorization: Bearer` header per request

---

## Environment variables

```
DATABASE_URL       PostgreSQL connection string
OPENAI_API_KEY     For generating embeddings (text-embedding-3-small)
JURUPARI_TOKEN     Static auth secret — never log, never expose
PORT               HTTP port (default 3000)
NODE_ENV           development | production
```

---

## Key commands

```bash
pnpm install                          # install all packages
pnpm build                            # compile all packages
pnpm dev:api                          # start HTTP + SSE MCP (watches core too)
pnpm db:push                          # push schema changes (dev)
pnpm db:migrate                       # run migrations (prod)
pnpm db:generate                      # regenerate Prisma client after schema change
docker compose up -d                  # start local postgres+pgvector
```

---

## MCP tools

All tools live in `packages/mcp/src/server.ts`. Access level is a closure — tools never
receive or validate tokens themselves.

| Tool            | Requires write | Description                        |
|-----------------|----------------|------------------------------------|
| memory_search   | No             | Semantic vector search             |
| memory_add      | Yes            | Store a new memory with embedding  |
| memory_update   | Yes            | Update memory, re-embeds content   |
| memory_delete   | Yes            | Hard delete by ID                  |
| memory_get      | No             | Fetch single memory by ID          |
| memory_list     | No             | List all memories in a category    |

---

## HTTP endpoints

```
GET    /health
POST   /memories/search     body: { query, category?, limit? }
GET    /memories?category=X
GET    /memories/:id
POST   /memories             Authorization: Bearer <token>
PATCH  /memories/:id         Authorization: Bearer <token>
DELETE /memories/:id         Authorization: Bearer <token>
GET    /mcp/sse              SSE MCP handshake (?token= for level-1)
POST   /mcp/messages         SSE MCP message relay (?sessionId=)
```

---

## Data model

```typescript
Memory {
  id          UUID
  category    string        // 'legal' | 'health' | 'work' | 'personal' | 'finance' | ...
  title       string
  content     string        // free text, what gets embedded
  metadata    JSONB         // structured facts: protocol numbers, dates, names, contacts
  accessLevel 0 | 1 | 2
  embedding   vector(1536)
  createdAt   timestamp
  updatedAt   timestamp
}
```

`metadata` is the key field for exact lookups. Store protocol numbers, judge names,
case identifiers, phone numbers, deadlines here — not buried in `content`.

---

## Adding a new memory (example)

```json
{
  "category": "legal",
  "title": "Italian citizenship — Venice Tribunal",
  "content": "Citizenship iure sanguinis recognized. Descent from Mariano Domenico Bego, Cavarzere 1861. Covers Paulo, Vanderli, Marcus, Marcella.",
  "metadata": {
    "protocol": "R.G. 5439/2025",
    "judge": "Sabina Rubini",
    "tribunal": "Venice",
    "status": "favorable ruling",
    "next_step": "trânsito em julgado + transcription at Comune di Cavarzere",
    "estimated_completion": "mid-to-late 2027"
  },
  "access_level": 1
}
```

---

## Coding conventions

- All imports use `.js` extension (Node16 module resolution)
- Raw SQL only for vector operations — never try to use Prisma ORM for embedding columns
- Zod schemas live next to the route that uses them, not in a shared schemas file
- Never add `console.log` with personal data — use structured error messages only
- `$queryRawUnsafe` is intentional for pgvector — do not replace with `$queryRaw` tagged template (parameter binding breaks with vector casts)

---

## What NOT to do

- Do not add token validation inside MCP tool handlers — auth is transport-layer only
- Do not store sensitive data in `content` if it needs exact retrieval — use `metadata`
- Do not add ORM abstractions over the vector queries — raw SQL is intentional
- Do not rename the project or reference its purpose in comments, error messages, or logs
