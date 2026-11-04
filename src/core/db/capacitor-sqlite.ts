import type { SqlExecutor, SqlValue } from "./executor";

export const DATABASE_NAME = "obsidian_sound";

/**
 * Opens the on-device database through @capacitor-community/sqlite.
 * Dynamically imported so the web/SSR bundle never evaluates the plugin.
 * Only call on a native platform. Schema versioning is handled by our own
 * `migrate()`, not the plugin's upgrade statements.
 */
export async function openCapacitorDatabase(): Promise<SqlExecutor> {
  const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(DATABASE_NAME, false)).result;
  const conn =
    consistent && exists
      ? await sqlite.retrieveConnection(DATABASE_NAME, false)
      : await sqlite.createConnection(DATABASE_NAME, false, "no-encryption", 1, false);
  await conn.open();

  return {
    async execute(sql) {
      // transaction=false: our migrate()/inTransaction control transactions.
      await conn.execute(sql, false);
    },
    async run(sql, params: SqlValue[] = []) {
      await conn.run(sql, params, false);
    },
    async query<T>(sql: string, params: SqlValue[] = []) {
      const res = await conn.query(sql, params);
      return (res.values ?? []) as T[];
    },
  };
}
