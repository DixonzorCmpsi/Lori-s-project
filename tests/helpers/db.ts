import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://callboard:callboard_dev@localhost:5432/callboard_test";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });

export const testDb = drizzle(pool, { schema });

export async function cleanupTestDb() {
  await pool.end();
}

/**
 * Wraps a test function in a database transaction that rolls back after completion.
 * Ensures no shared state between tests.
 */
export async function withTransaction<T>(
  fn: (tx: typeof testDb) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txDb = drizzle(client, { schema });
    const result = await fn(txDb as unknown as typeof testDb);
    await client.query("ROLLBACK");
    return result;
  } finally {
    client.release();
  }
}
