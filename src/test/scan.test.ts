// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { migrate } from "@/core/db/migrate";
import type { SqlExecutor, SqlValue } from "@/core/db/executor";
import { SqliteLibraryRepository } from "@/core/library/sqlite-repository";
import type { LawlietLibraryPlugin, MetadataResult } from "@/core/native/library-plugin";
import {
  normalizeAudioItem,
  normalizeSourceUri,
  decodeMediaStoreTrack,
} from "@/core/scan/normalize";
import { scanMediaStore, scanFolder, isAudioPermissionGranted } from "@/core/scan/scanner";
import {
  configureScanning,
  startDeviceScan,
  importNewFolder,
  rescanFolder,
  getScanState,
} from "@/core/scan/scan-store";
import { isCapabilityAvailable, resetPlatformInfo, setRuntime } from "@/core/platform/capabilities";

const raw = (id = 1): MetadataResult => ({
  uri: `content://media/external/audio/media/${id}`,
  title: `Tag ${id}`,
  artist: "Tag artist",
  album: "Tag album",
  durationMs: 1000,
});
function plugin(): LawlietLibraryPlugin {
  return {
    checkAudioPermission: vi.fn(async () => ({ state: "granted" as const })),
    requestAudioPermission: vi.fn(async () => ({ state: "denied" as const })),
    cancelScan: vi.fn(async () => {}),
    openAppSettings: vi.fn(async () => {}),
    countMediaStore: vi.fn(async () => ({ count: 1 })),
    queryMediaStore: vi.fn(async ({ afterId }) => ({
      items: afterId ? [] : [raw()],
      lastId: afterId || 1,
      done: true,
    })),
    pickFolder: vi.fn(async () => ({
      cancelled: false,
      treeUri: "content://provider/tree/music",
      displayName: "Music",
    })),
    hasFolderAccess: vi.fn(async () => ({ granted: true })),
    listFolderAudio: vi.fn(async () => ({
      items: [
        {
          uri: raw().uri,
          displayName: "File.mp3",
          mimeType: "audio/mpeg",
          sizeBytes: 20,
          modifiedMs: 10000,
        },
      ],
      truncated: false,
    })),
    readMetadata: vi.fn(async ({ uris }) => ({ items: uris.map((uri) => ({ ...raw(), uri })) })),
  };
}
const databases: DatabaseSync[] = [];
afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
  resetPlatformInfo();
});
async function setup() {
  const db = new DatabaseSync(":memory:");
  databases.push(db);
  const sql: SqlExecutor = {
    async execute(s) {
      db.exec(s);
    },
    async run(s, p: SqlValue[] = []) {
      db.prepare(s).run(...p);
    },
    async query<T>(s: string, p: SqlValue[] = []) {
      return db.prepare(s).all(...p) as T[];
    },
  };
  await migrate(sql);
  let id = 0;
  const repo = new SqliteLibraryRepository(sql, () => `test-${++id}`);
  return { db, sql, repo, p: plugin() };
}
function normalized(id = 1) {
  const item = normalizeAudioItem(raw(id), "mediastore");
  if (!item) throw new Error("Invalid test metadata");
  return item;
}
describe("native metadata normalization", () => {
  it("keeps opaque content references and rejects paths/network URLs", () => {
    expect(normalizeSourceUri("content://provider/tree/a%2Fb/document/c%3Ad")).toBe(
      "content://provider/tree/a%2Fb/document/c%3Ad",
    );
    for (const uri of [
      "file:///music.mp3",
      "https://host/music.mp3",
      "content://provider/has space",
    ])
      expect(normalizeSourceUri(uri)).toBeNull();
  });
  it("maps metadata only, including the supplied tag example, without audio", () => {
    expect(
      normalizeAudioItem(
        {
          uri: raw().uri,
          title: "Don't Stop 'Til You Get Enough",
          artist: "Michael Jackson",
          album: "Off the Wall",
          durationMs: "313760",
          track: "1/10",
          disc: "1/1",
          year: "1979",
        },
        "saf",
      ),
    ).toMatchObject({
      title: "Don't Stop 'Til You Get Enough",
      artist: "Michael Jackson",
      album: "Off the Wall",
      durationMs: 313760,
      trackNumber: 1,
      discNumber: 1,
      year: 1979,
      titleSource: "embedded",
    });
  });
  it("marks filename fallback and never invents unknown tags", () => {
    expect(
      normalizeAudioItem(
        { uri: raw().uri, title: "<unknown>", artist: "<unknown>", displayName: "Local_file.mp3" },
        "saf",
      ),
    ).toMatchObject({ title: "Local file", titleSource: "filename", artist: null, album: null });
    expect(normalizeAudioItem({ uri: raw().uri }, "saf")).toBeNull();
    expect(decodeMediaStoreTrack(1003)).toEqual({ track: 3, disc: 1 });
  });
  it("accepts only a granted permission result", () => {
    expect(isAudioPermissionGranted("granted")).toBe(true);
    for (const state of ["denied", "prompt", "prompt-with-rationale", undefined, true])
      expect(isAudioPermissionGranted(state)).toBe(false);
  });
});
describe("MediaStore orchestration", () => {
  it("advances page cursors, refreshes idempotently and falls back to indeterminate count", async () => {
    const { repo, p } = await setup();
    p.countMediaStore = vi.fn(async () => {
      throw new Error("Count unavailable");
    });
    p.queryMediaStore = vi.fn(async ({ afterId }) => ({
      items: [raw(afterId + 1)],
      lastId: afterId + 1,
      done: afterId === 1,
    }));
    expect(await scanMediaStore(p, repo, { pageSize: 1 })).toMatchObject({
      status: "completed",
      added: 2,
    });
    expect(p.queryMediaStore).toHaveBeenNthCalledWith(2, { afterId: 1, limit: 1 });
    expect(await scanMediaStore(p, repo, { pageSize: 1 })).toMatchObject({
      status: "completed",
      added: 0,
      updated: 2,
    });
    expect((await repo.listTracks()).length).toBe(2);
  });
  it("requests permission only when explicitly scanning and does not query on denial", async () => {
    const { repo, p } = await setup();
    p.checkAudioPermission = vi.fn(async () => ({ state: "prompt" }));
    expect(await scanMediaStore(p, repo)).toMatchObject({ status: "permission-denied" });
    expect(p.requestAudioPermission).toHaveBeenCalledOnce();
    expect(p.queryMediaStore).not.toHaveBeenCalled();
  });
  it.each(["nonadvancing", "provider", "metadata", "cancelled"] as const)(
    "keeps unseen existing tracks after %s scan",
    async (mode) => {
      const { repo, p } = await setup();
      await scanMediaStore(p, repo);
      const abort = new AbortController();
      p.queryMediaStore = vi.fn(async () => {
        if (mode === "provider") throw new Error("Provider failed");
        if (mode === "cancelled") abort.abort();
        return {
          items: mode === "metadata" ? [{ ...raw(2), error: "Unreadable" }] : [],
          lastId: 0,
          done: mode !== "nonadvancing",
        };
      });
      if (mode === "metadata")
        p.queryMediaStore = vi.fn(async () => ({
          items: [{ ...raw(2), error: "Unreadable" }],
          lastId: 2,
          done: true,
        }));
      const result = await scanMediaStore(p, repo, { signal: abort.signal });
      expect(result.status).toBe(
        mode === "cancelled" ? "cancelled" : mode === "metadata" ? "partial" : "failed",
      );
      expect(result.markedUnavailable).toBe(0);
      expect((await repo.listTracks()).length).toBe(1);
    },
  );
  it("pre-aborted scans do not prompt or write", async () => {
    const { repo, p } = await setup();
    const abort = new AbortController();
    abort.abort();
    expect((await scanMediaStore(p, repo, { signal: abort.signal })).status).toBe("cancelled");
    expect(p.checkAudioPermission).not.toHaveBeenCalled();
  });
});
describe("SAF orchestration", () => {
  it("deduplicates listings, uses document modification metadata and paginates batches", async () => {
    const { repo, p } = await setup();
    const source = {
      id: await repo.upsertFolderSource("content://provider/tree/music", "Music"),
      treeUri: "content://provider/tree/music",
    };
    const doc = {
      uri: raw().uri,
      displayName: "File.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 20,
      modifiedMs: 10000,
    };
    p.listFolderAudio = vi.fn(async () => ({
      items: [doc, doc, { ...doc, uri: raw(2).uri }],
      truncated: false,
    }));
    expect(await scanFolder(p, repo, source, { pageSize: 1 })).toMatchObject({
      status: "completed",
      found: 2,
      added: 2,
    });
    expect(p.readMetadata).toHaveBeenCalledTimes(2);
    expect((await repo.listTracks()).length).toBe(2);
  });
  it.each(["truncated", "omitted", "unreadable", "provider", "cancelled", "access-lost"] as const)(
    "does not hide existing tracks on %s",
    async (mode) => {
      const { repo, p } = await setup();
      const source = {
        id: await repo.upsertFolderSource("content://provider/tree/music", "Music"),
        treeUri: "content://provider/tree/music",
      };
      await scanFolder(p, repo, source);
      const abort = new AbortController();
      if (mode === "truncated")
        p.listFolderAudio = vi.fn(async () => ({ items: [], truncated: true }));
      if (mode === "access-lost") p.hasFolderAccess = vi.fn(async () => ({ granted: false }));
      p.readMetadata = vi.fn(async () => {
        if (mode === "provider") throw new Error("Provider error");
        if (mode === "cancelled") abort.abort();
        return {
          items:
            mode === "omitted"
              ? []
              : [{ ...raw(), ...(mode === "unreadable" ? { error: "Unreadable" } : {}) }],
        };
      });
      const result = await scanFolder(p, repo, source, { signal: abort.signal });
      expect(result.status).not.toBe("completed");
      expect(result.markedUnavailable).toBe(0);
      expect((await repo.listTracks()).length).toBe(1);
    },
  );
});
describe("transactional rescans", () => {
  it("preserves every manual correction, artist credit and playlist/history reference", async () => {
    const { repo, sql } = await setup();
    const source = await repo.ensureMediaStoreSource();
    await repo.applyScanBatch(source, "first", [normalized(), normalized()]);
    const [track] = await repo.listTracks();
    if (!track) throw new Error("Missing track");
    for (const [field, value] of Object.entries({
      title: "Manual",
      album_title: "Manual album",
      album_artist: "Manual album artist",
      track_number: "9",
      disc_number: "2",
      year: "2001",
      genre: "Manual genre",
    }))
      await sql.run("INSERT INTO track_field_overrides(track_id,field,value) VALUES(?,?,?)", [
        track.id,
        field,
        value,
      ]);
    await sql.run(
      "INSERT INTO artists(id,name,name_key) VALUES('manual','Manual artist','manual artist')",
    );
    await sql.run(
      "INSERT INTO track_artists(track_id,artist_id,role,position,source) VALUES(?,'manual','primary',0,'manual')",
      [track.id],
    );
    await sql.run("INSERT INTO playlists(id,name) VALUES('playlist','Local')");
    await sql.run(
      "INSERT INTO playlist_tracks(playlist_id,position,track_id) VALUES('playlist',0,?)",
      [track.id],
    );
    await sql.run("INSERT INTO playback_history(track_id,started_at) VALUES(?,0)", [track.id]);
    await repo.applyScanBatch(source, "second", [
      { ...normalized(), title: "New embedded", titleSource: "filename", artist: "New artist" },
    ]);
    expect((await repo.listTracks())[0]).toMatchObject({
      id: track.id,
      title: "Manual",
      albumTitle: "Manual album",
      trackNumber: 9,
      discNumber: 2,
      year: 2001,
      genre: "Manual genre",
      fieldSources: { title: "manual", credits: "manual" },
      credits: [{ name: "Manual artist" }],
    });
    expect(await repo.finishScan(source, "empty-completed", "completed")).toEqual({
      markedUnavailable: 1,
    });
    expect(await repo.listTracks()).toEqual([]);
    expect(await sql.query("SELECT * FROM playlist_tracks")).toHaveLength(1);
    expect(await sql.query("SELECT * FROM playback_history")).toHaveLength(1);
    expect(await sql.query("SELECT * FROM track_field_overrides")).toHaveLength(7);
    await repo.applyScanBatch(source, "returns", [normalized()]);
    expect((await repo.listTracks())[0]?.id).toBe(track.id);
  });
  it("retains first-source ownership for identical URIs without duplicates", async () => {
    const { repo, sql } = await setup();
    const first = await repo.ensureMediaStoreSource();
    const second = await repo.upsertFolderSource("content://provider/tree/music", "Music");
    await repo.applyScanBatch(first, "owner", [normalized()]);
    await repo.applyScanBatch(second, "other", [normalized()]);
    expect(await sql.query("SELECT source_id,last_seen_scan_id FROM tracks")).toEqual([
      { source_id: first, last_seen_scan_id: "owner" },
    ]);
    expect((await repo.listTracks()).length).toBe(1);
  });
  it("rolls back the whole batch on constraint failure and invalidates cached IDs", async () => {
    const { repo, sql } = await setup();
    const source = await repo.ensureMediaStoreSource();
    await expect(
      repo.applyScanBatch(source, "bad", [normalized(), { ...normalized(2), durationMs: -1 }]),
    ).rejects.toThrow();
    expect(await sql.query("SELECT * FROM tracks")).toHaveLength(0);
    expect(await sql.query("SELECT * FROM artists")).toHaveLength(0);
    expect(await repo.applyScanBatch(source, "retry", [normalized()])).toEqual({
      added: 1,
      updated: 0,
    });
  });
});
describe("scan entry points and capabilities", () => {
  it("refreshes queries and revokes discovery after denial", async () => {
    const { repo, p } = await setup();
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    setRuntime("android");
    configureScanning({ repo, plugin: p, queryClient: client });
    await startDeviceScan();
    expect(isCapabilityAvailable("localDiscovery")).toBe(true);
    expect(isCapabilityAvailable("playback")).toBe(false);
    p.checkAudioPermission = vi.fn(async () => ({ state: "denied" }));
    await startDeviceScan();
    expect(isCapabilityAvailable("localDiscovery")).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["library"] });
  });
  it("persists selected folder, handles picker cancellation/failure, and revokes lost access", async () => {
    const { repo, p } = await setup();
    configureScanning({ repo, plugin: p, queryClient: new QueryClient() });
    setRuntime("android");
    await importNewFolder();
    expect(isCapabilityAvailable("folderImport")).toBe(true);
    const [source] = await repo.listSources();
    if (!source?.treeUri) throw new Error("Missing folder");
    p.hasFolderAccess = vi.fn(async () => ({ granted: false }));
    await rescanFolder({ id: source.id, treeUri: source.treeUri, displayName: source.displayName });
    expect(isCapabilityAvailable("folderImport")).toBe(false);
    p.pickFolder = vi.fn(async () => ({ cancelled: true }));
    await importNewFolder();
    expect(getScanState()).toMatchObject({ phase: "done", result: { status: "cancelled" } });
    p.pickFolder = vi.fn(async () => {
      throw new Error("Picker unavailable");
    });
    await importNewFolder();
    expect(getScanState()).toMatchObject({
      phase: "done",
      result: { status: "failed", message: "Picker unavailable" },
    });
    expect(await repo.listSources()).toHaveLength(1);
  });
});
