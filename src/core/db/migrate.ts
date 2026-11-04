import { inTransaction, type SqlExecutor } from "./executor";
import { MIGRATIONS, type Migration } from "./migrations";

export class MigrationError extends Error {}

/** Throws if versions are not unique, positive and strictly increasing from 1. */
export function validateMigrations(list: readonly Migration[]): void {
  list.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new MigrationError(`Migration "${m.name}" has version ${m.version}; expected ${i + 1}.`);
    }
  });
}

/**
 * Applies pending migrations in order, each in its own transaction, and
 * records them in `schema_migrations`. Safe to call on every app start.
 * Returns the versions applied in this call.
 */
export async function migrate(db: SqlExecutor, list: readonly Migration[] = MIGRATIONS): Promise<number[]> {
  validateMigrations(list);
  await db.execute("PRAGMA foreign_keys = ON");
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  )`);

  const rows = await db.query<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version");
  const current = rows.length ? Number(rows[rows.length - 1].version) : 0;
  if (current > list.length) {
    throw new MigrationError(`Database is at version ${current}, newer than this app (${list.length}).`);
  }

  const applied: number[] = [];
  for (const m of list.slice(current)) {
    await inTransaction(db, async () => {
      await db.execute(m.sql);
      await db.run("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)", [
        m.version,
        m.name,
        Date.now(),
      ]);
    });
    applied.push(m.version);
  }
  return applied;
}

export const SCHEMA_VERSION = MIGRATIONS.length;
