export interface Memory {
  id: string;
  category: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  accessLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryWithSimilarity extends Memory {
  similarity: number;
}

export interface CreateMemoryInput {
  category: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  accessLevel?: number; // 0 | 1 | 2
}

export interface UpdateMemoryInput {
  category?: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  accessLevel?: number;
}

export interface SearchInput {
  query: string;
  category?: string;
  maxAccessLevel?: number;
  limit?: number;
}
