const TOKEN = process.env.JURUPARI_TOKEN;

export function validateToken(provided?: string): boolean {
  if (!TOKEN) throw new Error('JURUPARI_TOKEN env var not set');
  return provided === TOKEN;
}

// Returns the max access level the caller is allowed to see.
// Extend this function when level-2 (TOTP / hardware key) is added.
export function maxAccessLevel(token?: string): number {
  if (!token) return 0;
  try {
    return validateToken(token) ? 1 : 0;
  } catch {
    return 0;
  }
}
