# jurupari

Personal knowledge base or second brain with semantic search. PostgreSQL + pgvector + MCP + HTTP API.

Why? We are done with markdown, they are nice, until you have millions of them.

## The name
Jurupari is an indigenous Amazonian legislator and spirit who established social laws, rituals, and sacred traditions for tribes.

![jurupari-logo](/docs/jurupari-logo.png)

## Workflwo
The workflow is simple, you deploy it in the place is better for you, like AWS, Railway... and plug the MCP to your Claude, GPT, Claude Code, OpenClaw, Hermes...

![jurupari-workflow](/docs/flow.png)

## Local dev

```bash
cp .env.example .env          # fill DATABASE_URL, OPENAI_API_KEY, JURUPARI_TOKEN
docker compose up -d          # starts postgres with pgvector
pnpm install
pnpm db:push                  # push schema (dev) — use db:migrate in prod
pnpm dev:api                  # HTTP API on :3000
pnpm --filter @jurupari/mcp build && node packages/mcp/dist/index.js  # MCP server
```

## MCP config

### Remote SSE — Claude.ai web, any client without local access

```json
{
  "mcpServers": {
    "jurupari": {
      "type": "sse",
      "url": "https://your-railway-app.railway.app/mcp/sse?token=your-secret-token"
    }
  }
}
```

No token → level-0 read-only. With valid token → full access (level-1).

### Local stdio — Claude Desktop, Claude Code, Cursor (lower latency, always full access)

```json
{
  "mcpServers": {
    "jurupari": {
      "command": "node",
      "args": ["/absolute/path/to/jurupari/packages/mcp/dist/stdio.js"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "OPENAI_API_KEY": "sk-...",
        "JURUPARI_TOKEN": "your-secret-token"
      }
    }
  }
}
```

Pola can use either: HTTP REST directly (`/memories`), or the SSE MCP endpoint.

## Access levels

| Level | Read requires    | Write requires    | Use case                        |
|-------|-----------------|-------------------|---------------------------------|
| 0     | nothing extra   | token             | general notes, non-sensitive    |
| 1     | token           | token             | personal data, process numbers  |
| 2     | (future)        | (future)          | reserved for strictest data     |

## HTTP API

```
GET    /health
POST   /memories/search   body: { query, category?, limit? }
GET    /memories?category=legal
GET    /memories/:id
POST   /memories          Authorization: Bearer <token>
PATCH  /memories/:id      Authorization: Bearer <token>
DELETE /memories/:id      Authorization: Bearer <token>
```

## Deploy to Railway

1. Push repo to GitHub
2. New Railway project → connect repo
3. Add env vars: DATABASE_URL (Railway Postgres addon), OPENAI_API_KEY, JURUPARI_TOKEN
4. Railway reads `railway.toml` automatically
