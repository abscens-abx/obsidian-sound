// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import type { SqlExecutor, SqlValue } from "@/core/db/executor";
import { migrate, MigrationError, validateMigrations, SCHEMA_VERSION } from "@/core/db/migrate";
import { MIGRATIONS } from "@/core/db/migrations";
import { SqliteLibraryRepository } from "@/core/library/sqlite-repository";
import {
  getPlatformInfo,
  isCapabilityAvailable,
  markCapability,
  resetPlatformInfo,
  runtimeFromPlatform,
  setRuntime,
} from "@/core/platform/capabilities";

function memoryDb(): SqlExecutor & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  return {
    raw,
    async execute(sql) {
      raw.exec(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      raw.prepare(sql).run(...params);
    },
    async query<T>(sql: string, params: SqlValue[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
  };
}

describe("migrations", () => {
  it("are numbered 1..n in order", () => {
    expect(() => validateMigrations(MIGRATIONS)).not.toThrow();
    expect(() => validateMigrations([MIGRATIONS[0], { ...MIGRATIONS[0], version: 3 }])).toThrow(MigrationError);
  });

  it("apply once and are idempotent on re-run", async () => {
    const db = memoryDb();
    expect(await migrate(db)).toEqual([1]);
    expect(await migrate(db)).toEqual([]);
    const rows = await db.query<{ version: number }>("SELECT version FROM schema_migrations");
    expect(rows.map((r) => r.version)).toEqual([1]);
    expect(SCHEMA_VERSION).toBe(1);
  });

  it("create every core table", async () => {
    const db = memoryDb();
    await migrate(db);
    const names = (await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r.name);
    for (const t of [
      "tracks", "artists", "track_artists", "albums", "playlists", "playlist_tracks",
      "lyrics", "lyric_lines", "lyric_words", "favorites", "playback_history", "app_preferences",
      "track_field_overrides",
    ]) expect(names).toContain(t);
  });

  it("enforce foreign keys", async () => {
    const db = memoryDb();
    await migrate(db);
    await expect(
      db.run("INSERT INTO playlist_tracks (playlist_id, position, track_id) VALUES ('nope', 0, 'nope')"),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it("roll back a failing migration and leave version unchanged", async () => {
    const db = memoryDb();
    const bad = [...MIGRATIONS, { version: 2, name: "bad", sql: "CREATE TABLE x (a); SELECT * FROM missing_table;" }];
    await expect(migrate(db, bad)).rejects.toThrow();
    const rows = await db.query<{ version: number }>("SELECT version FROM schema_migrations");
    expect(rows.map((r) => r.version)).toEqual([1]);
    expect(await db.query("SELECT name FROM sqlite_master WHERE name='x'")).toEqual([]);
  });

  it("refuse a database newer than the app", async () => {
    const db = memoryDb();
    await migrate(db);
    await db.run("INSERT INTO schema_migrations VALUES (2, 'future', 0)");
    await expect(migrate(db)).rejects.toThrow(/newer/);
  });
});

describe("SqliteLibraryRepository", () => {
  it("returns an empty library from an empty database", async () => {
    const db = memoryDb();
    await migrate(db);
    const repo = new SqliteLibraryRepository(db);
    expect(await repo.getSummary()).toEqual({ tracks: 0, albums: 0, artists: 0, playlists: 0 });
    expect(await repo.listTracks()).toEqual([]);
  });

  it("prefers manual overrides and manual credits over embedded tags", async () => {
    const db = memoryDb();
    await migrate(db);
    // Test-only rows inside an in-memory database; never shipped.
    await db.execute(`
      INSERT INTO artists (id, name, name_key) VALUES ('a1','Embedded Artist','embedded artist'),('a2','Corrected Artist','corrected artist');
      INSERT INTO tracks (id, source_uri, source_kind, title, duration_ms) VALUES ('t1','content://media/external/audio/media/1','mediastore','embedded title',1000);
      INSERT INTO track_artists (track_id, artist_id, role, position, source) VALUES ('t1','a1','primary',0,'embedded'),('t1','a2','primary',0,'manual');
      INSERT INTO track_field_overrides (track_id, field, value) VALUES ('t1','title','Corrected Title');
    `);
    // Simulate a rescan refreshing embedded tags: manual values must survive.
    await db.run("UPDATE tracks SET title = 'rescanned title' WHERE id = 't1'");
    const [t] = await new SqliteLibraryRepository(db).listTracks();
    expect(t.title).toBe("Corrected Title");
    expect(t.fieldSources.title).toBe("manual");
    expect(t.credits.map((c) => c.name)).toEqual(["Corrected Artist"]);
    expect(t.sourceUri).toBe("content://media/external/audio/media/1");
  });
});

describe("capabilities", () => {
  afterEach(resetPlatformInfo);

  it("maps runtimes conservatively", () => {
    expect(runtimeFromPlatform("android", true)).toBe("android");
    expect(runtimeFromPlatform("android", false)).toBe("web-preview");
    expect(runtimeFromPlatform("web", false)).toBe("web-preview");
  });

  it("android runtime alone enables nothing", () => {
    setRuntime("android");
    expect(getPlatformInfo().capabilities.every((c) => !c.available)).toBe(true);
  });

  it("only the marked capability becomes available", () => {
    setRuntime("android");
    markCapability("offlineDatabase", true);
    expect(isCapabilityAvailable("offlineDatabase")).toBe(true);
    expect(isCapabilityAvailable("playback")).toBe(false);
    expect(isCapabilityAvailable("localDiscovery")).toBe(false);
  });
});
