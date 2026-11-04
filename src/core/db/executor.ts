/**
 * Minimal SQL boundary. Implemented by the Capacitor SQLite plugin on device
 * and by node:sqlite in tests. Repositories and migrations depend only on this.
 */
export type SqlValue = string | number | null;

export interface SqlExecutor {
  /** Run one or more statements with no parameters and no result. */
  execute(sql: string): Promise<void>;
  /** Run a single parameterised write. */
  run(sql: string, params?: SqlValue[]): Promise<void>;
  /** Run a single parameterised read. */
  query<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

export async function inTransaction<T>(db: SqlExecutor, fn: () => Promise<T>): Promise<T> {
  await db.execute("BEGIN IMMEDIATE");
  try {
    const result = await fn();
    await db.execute("COMMIT");
    return result;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}
