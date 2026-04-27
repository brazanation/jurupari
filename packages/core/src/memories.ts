import { prisma } from './client.js';
import { generateEmbedding } from './embeddings.js';
import type {
  Memory,
  MemoryWithSimilarity,
  CreateMemoryInput,
  UpdateMemoryInput,
  SearchInput,
} from './types.js';

type RawMemory = {
  id: string;
  category: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  accessLevel: number;
  createdAt: Date;
  updatedAt: Date;
};

type RawMemoryWithSim = RawMemory & { similarity: number };

function toMemory(r: RawMemory): Memory {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    content: r.content,
    metadata: r.metadata as Record<string, unknown>,
    accessLevel: Number(r.accessLevel),
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  };
}

export async function createMemory(input: CreateMemoryInput): Promise<Memory> {
  const embedding = await generateEmbedding(`${input.title} ${input.content}`);
  const vec = `[${embedding.join(',')}]`;

  const [row] = await prisma.$queryRawUnsafe<RawMemory[]>(
    `INSERT INTO memories (category, title, content, metadata, access_level, embedding, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6::vector, NOW(), NOW())
     RETURNING id, category, title, content, metadata,
               access_level AS "accessLevel",
               created_at   AS "createdAt",
               updated_at   AS "updatedAt"`,
    input.category,
    input.title,
    input.content,
    JSON.stringify(input.metadata ?? {}),
    input.accessLevel ?? 0,
    vec,
  );

  return toMemory(row);
}

export async function updateMemory(id: string, input: UpdateMemoryInput): Promise<Memory> {
  const current = await getMemoryById(id);
  if (!current) throw new Error(`Memory ${id} not found`);

  const merged = { ...current, ...input };
  const embedding = await generateEmbedding(`${merged.title} ${merged.content}`);
  const vec = `[${embedding.join(',')}]`;

  const [row] = await prisma.$queryRawUnsafe<RawMemory[]>(
    `UPDATE memories
     SET category     = $2,
         title        = $3,
         content      = $4,
         metadata     = $5::jsonb,
         access_level = $6,
         embedding    = $7::vector,
         updated_at   = NOW()
     WHERE id = $1
     RETURNING id, category, title, content, metadata,
               access_level AS "accessLevel",
               created_at   AS "createdAt",
               updated_at   AS "updatedAt"`,
    id,
    merged.category,
    merged.title,
    merged.content,
    JSON.stringify(merged.metadata ?? {}),
    merged.accessLevel ?? 0,
    vec,
  );

  return toMemory(row);
}

export async function deleteMemory(id: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM memories WHERE id = $1`, id);
}

export async function getMemoryById(id: string): Promise<Memory | null> {
  const rows = await prisma.$queryRawUnsafe<RawMemory[]>(
    `SELECT id, category, title, content, metadata,
            access_level AS "accessLevel",
            created_at   AS "createdAt",
            updated_at   AS "updatedAt"
     FROM memories WHERE id = $1`,
    id,
  );
  return rows[0] ? toMemory(rows[0]) : null;
}

export async function listByCategory(
  category: string,
  maxAccessLevel = 0,
): Promise<Memory[]> {
  const rows = await prisma.$queryRawUnsafe<RawMemory[]>(
    `SELECT id, category, title, content, metadata,
            access_level AS "accessLevel",
            created_at   AS "createdAt",
            updated_at   AS "updatedAt"
     FROM memories
     WHERE category = $1 AND access_level <= $2
     ORDER BY created_at DESC`,
    category,
    maxAccessLevel,
  );
  return rows.map(toMemory);
}

export async function searchMemories(
  input: SearchInput,
): Promise<MemoryWithSimilarity[]> {
  const embedding = await generateEmbedding(input.query);
  const vec = `[${embedding.join(',')}]`;
  const limit = input.limit ?? 10;
  const maxAL = input.maxAccessLevel ?? 0;

  const params: unknown[] = [vec, maxAL];
  let whereExtra = '';

  if (input.category) {
    params.push(input.category);
    whereExtra = ` AND category = $${params.length}`;
  }

  params.push(limit);

  const rows = await prisma.$queryRawUnsafe<RawMemoryWithSim[]>(
    `SELECT id, category, title, content, metadata,
            access_level AS "accessLevel",
            created_at   AS "createdAt",
            updated_at   AS "updatedAt",
            1 - (embedding <=> $1::vector) AS similarity
     FROM memories
     WHERE access_level <= $2${whereExtra}
     ORDER BY embedding <=> $1::vector
     LIMIT $${params.length}`,
    ...params,
  );

  return rows.map((r) => ({ ...toMemory(r), similarity: Number(r.similarity) }));
}
