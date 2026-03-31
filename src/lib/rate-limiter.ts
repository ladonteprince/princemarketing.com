const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number = 20,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowKey = `${key}:${Math.floor(now / 60000)}`;
  const entry = store.get(windowKey) || { count: 0, resetAt: now + 60000 };

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  store.set(windowKey, entry);

  // Cleanup old entries
  if (store.size > 500) {
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }

  return { allowed: true, remaining: limit - entry.count };
}
