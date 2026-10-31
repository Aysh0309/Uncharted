import { getDb } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  resetInSeconds: number;
}

/**
 * Checks and records rate limits per user in MongoDB.
 * Uses a TTL index so old requests are automatically pruned by MongoDB.
 * Safe for serverless environments where in-memory state is transient.
 *
 * @param userId - Unique ID of the authenticated user
 * @param limit - Maximum allowed requests in window (default: 20 per minute)
 * @param windowSeconds - Rolling window size in seconds (default: 60)
 */
export async function checkRateLimit(
  userId: string,
  limit = 20,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const db = await getDb();
  const rateLimitCol = db.collection("rateLimits");

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  // Count requests by this user in the active rolling window
  const count = await rateLimitCol.countDocuments({
    userId,
    createdAt: { $gte: windowStart },
  });

  if (count >= limit) {
    return {
      allowed: false,
      currentCount: count,
      limit,
      resetInSeconds: windowSeconds,
    };
  }

  // Record current request event
  await rateLimitCol.insertOne({
    userId,
    createdAt: now,
  });

  return {
    allowed: true,
    currentCount: count + 1,
    limit,
    resetInSeconds: windowSeconds,
  };
}
