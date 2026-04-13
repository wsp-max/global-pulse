const buckets = new Map<string, number>();

export async function rateLimit(sourceId: string, minIntervalMs: number): Promise<void> {
  const now = Date.now();
  const nextAllowedAt = buckets.get(sourceId) ?? 0;

  if (now < nextAllowedAt) {
    const waitMs = nextAllowedAt - now;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  buckets.set(sourceId, Date.now() + minIntervalMs);
}

