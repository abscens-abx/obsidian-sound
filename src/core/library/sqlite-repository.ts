import { inTransaction, type SqlExecutor } from "../db/executor";
import { nameKey, type ScannedTrack } from "../scan/normalize";
import type {
  Album,
  Artist,
  ArtistCredit,
  LibrarySource,
  LibrarySummary,
  Playlist,
  Track,
} from "../types";
import type { LibraryRepository } from "./repository";

export const MEDIASTORE_SOURCE_ID = "mediastore";

function defaultId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  c?.getRandomValues?.(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * SQLite library. Effective metadata = manual override ?? embedded.
 * Scan writes touch only embedded columns and `source='embedded'` credits;
 * manual overrides and manual credits are never written here.
 */

const EFFECTIVE_TRACKS = `
SELECT t.id, t.source_uri, t.title_source, t.album_id, t.duration_ms, t.artwork_ref, t.created_at,
  COALESCE(o_title.value, t.title) AS title,
  COALESCE(o_album.value, al.title) AS album_title,
  COALESCE(CAST(o_year.value AS INTEGER), t.year) AS year,
  COALESCE(o_genre.value, t.genre) AS genre,
  COALESCE(CAST(o_tn.value AS INTEGER), t.track_number) AS track_number,
  COALESCE(CAST(o_dn.value AS INTEGER), t.disc_number) AS disc_number,
  (o_title.track_id IS NOT NULL) AS title_manual,
  (o_album.track_id IS NOT NULL) AS album_manual,
  (o_year.track_id IS NOT NULL) AS year_manual,
  (o_genre.track_id IS NOT NULL) AS genre_manual,
  EXISTS (SELECT 1 FROM favorites f WHERE f.entity_type = 'track' AND f.entity_id = t.id) AS is_favorite
FROM tracks t
LEFT JOIN albums al ON al.id = t.album_id
LEFT JOIN track_field_overrides o_title ON o_title.track_id = t.id AND o_title.field = 'title'
LEFT JOIN track_field_overrides o_album ON o_album.track_id = t.id AND o_album.field = 'album_title'
LEFT JOIN track_field_overrides o_year ON o_year.track_id = t.id AND o_year.field = 'year'
LEFT JOIN track_field_overrides o_genre ON o_genre.track_id = t.id AND o_genre.field = 'genre'
LEFT JOIN track_field_overrides o_tn ON o_tn.track_id = t.id AND o_tn.field = 'track_number'
LEFT JOIN track_field_overrides o_dn ON o_dn.track_id = t.id AND o_dn.field = 'disc_number'
WHERE t.is_available = 1`;

type TrackRow = {
  id: string;
  source_uri: string;
  title_source: "embedded" | "filename";
  album_id: string | null;
  duration_ms: number;
  artwork_ref: string | null;
  created_at: number;
  title: string;
  album_title: string | null;
  year: number | null;
  genre: string | null;
  track_number: number | null;
  disc_number: number | null;
  title_manual: number;
  album_manual: number;
  year_manual: number;
  genre_manual: number;
  is_favorite: number;
};

type CreditRow = {
  track_id: string;
  artist_id: string;
  name: string;
  role: ArtistCredit["role"];
  source: string;
};

export class SqliteLibraryRepository implements LibraryRepository {
  private artistIds = new Map<string, string>();
  private albumIds = new Map<string, string>();

  constructor(
    private readonly db: SqlExecutor,
    private readonly newId: () => string = defaultId,
  ) {}

  // ---------- sources ----------

  async listSources(): Promise<LibrarySource[]> {
    const rows = await this.db.query<{
      id: string;
      kind: LibrarySource["kind"];
      tree_uri: string | null;
      display_name: string;
      last_scanned_at: number | null;
      last_scan_status: LibrarySource["lastScanStatus"];
      track_count: number;
    }>(`SELECT s.id, s.kind, s.tree_uri, s.display_name, s.last_scanned_at, s.last_scan_status,
        (SELECT COUNT(*) FROM tracks t WHERE t.source_id = s.id AND t.is_available = 1) AS track_count
      FROM library_sources s ORDER BY s.kind DESC, s.display_name COLLATE NOCASE, s.id`);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      treeUri: r.tree_uri,
      displayName: r.display_name,
      lastScannedAt: r.last_scanned_at == null ? null : new Date(Number(r.last_scanned_at)).toISOString(),
      lastScanStatus: r.last_scan_status,
      trackCount: Number(r.track_count),
    }));
  }

  async ensureMediaStoreSource(): Promise<string> {
    await this.db.run(
      "INSERT OR IGNORE INTO library_sources (id, kind, display_name) VALUES (?, 'mediastore', 'Device music')",
      [MEDIASTORE_SOURCE_ID],
    );
    return MEDIASTORE_SOURCE_ID;
  }

  /** Idempotent per tree URI; refreshes the display name. */
  async upsertFolderSource(treeUri: string, displayName: string): Promise<string> {
    const [existing] = await this.db.query<{ id: string }>(
      "SELECT id FROM library_sources WHERE tree_uri = ?",
      [treeUri],
    );
    if (existing) {
      await this.db.run("UPDATE library_sources SET display_name = ? WHERE id = ?", [
        displayName,
        existing.id,
      ]);
      return existing.id;
    }
    const id = this.newId();
    await this.db.run(
      "INSERT INTO library_sources (id, kind, tree_uri, display_name) VALUES (?, 'saf', ?, ?)",
      [id, treeUri, displayName],
    );
    return id;
  }

  beginScan(): string {
    return this.newId();
  }

  // ---------- scan writes ----------

  /**
   * Upserts one batch in a single transaction, keyed by source URI. Returns
   * how many rows were newly added vs refreshed.
   */
  async applyScanBatch(
    sourceId: string,
    scanId: string,
    items: ScannedTrack[],
  ): Promise<{ added: number; updated: number }> {
    if (items.length === 0) return { added: 0, updated: 0 };
    // De-duplicate within the batch: same URI -> last one wins.
    const byUri = new Map(items.map((i) => [i.sourceUri, i]));
    const unique = [...byUri.values()];
    try {
      return await inTransaction(this.db, async () => {
        const uris = unique.map((i) => i.sourceUri);
        const existingRows = await this.db.query<{ id: string; source_uri: string }>(
          `SELECT id, source_uri FROM tracks WHERE source_uri IN (${uris.map(() => "?").join(",")})`,
          uris,
        );
        const existing = new Map(existingRows.map((r) => [r.source_uri, r.id]));
        let added = 0;
        let updated = 0;
        const now = Date.now();
        for (const it of unique) {
          const artistId = it.artist ? await this.artistId(it.artist) : null;
          const groupArtist = it.albumArtist ?? it.artist;
          const albumArtistId = groupArtist ? await this.artistId(groupArtist) : null;
          const albumId = it.album ? await this.albumId(it.album, albumArtistId, it.year) : null;
          const embedded = [
            it.sourceKind,
            it.mediastoreId,
            it.mimeType,
            it.sizeBytes,
            it.modifiedAt,
            it.title,
            it.titleSource,
            albumId,
            it.trackNumber,
            it.discNumber,
            it.durationMs,
            it.year,
            it.genre,
            it.artworkRef,
            sourceId,
            scanId,
            now,
          ];
          let trackId = existing.get(it.sourceUri);
          if (trackId) {
            await this.db.run(
              `UPDATE tracks SET source_kind = ?, mediastore_id = ?, mime_type = ?, size_bytes = ?,
                source_modified_at = ?, title = ?, title_source = ?, album_id = ?, track_number = ?,
                disc_number = ?, duration_ms = ?, year = ?, genre = ?, artwork_ref = ?, source_id = ?,
                last_seen_scan_id = ?, updated_at = ?, is_available = 1
               WHERE id = ?`,
              [...embedded, trackId],
            );
            updated++;
          } else {
            trackId = this.newId();
            await this.db.run(
              `INSERT INTO tracks (source_kind, mediastore_id, mime_type, size_bytes, source_modified_at,
                title, title_source, album_id, track_number, disc_number, duration_ms, year, genre,
                artwork_ref, source_id, last_seen_scan_id, updated_at, id, source_uri, is_available)
               VALUES (${embedded.map(() => "?").join(",")}, ?, ?, 1)`,
              [...embedded, trackId, it.sourceUri],
            );
            existing.set(it.sourceUri, trackId);
            added++;
          }
          // Refresh embedded credits only; manual credits are untouched.
          await this.db.run("DELETE FROM track_artists WHERE track_id = ? AND source = 'embedded'", [
            trackId,
          ]);
          if (artistId) {
            await this.db.run(
              "INSERT INTO track_artists (track_id, artist_id, role, position, source) VALUES (?, ?, 'primary', 0, 'embedded')",
              [trackId, artistId],
            );
          }
        }
        return { added, updated };
      });
    } catch (error) {
      // Cached IDs may refer to rows that were rolled back.
      this.artistIds.clear();
      this.albumIds.clear();
      throw error;
    }
  }

  /**
   * Records the scan outcome. Only a completed scan marks unseen tracks of
   * this source unavailable; rows are never deleted, so playlists, history and
   * manual edits keep their references and recover if the file returns.
   */
  async finishScan(
    sourceId: string,
    scanId: string,
    status: "completed" | "cancelled" | "failed",
  ): Promise<{ markedUnavailable: number }> {
    return inTransaction(this.db, async () => {
      let markedUnavailable = 0;
      if (status === "completed") {
        const where =
          "source_id = ? AND is_available = 1 AND (last_seen_scan_id IS NULL OR last_seen_scan_id != ?)";
        const [row] = await this.db.query<{ n: number }>(
          `SELECT COUNT(*) AS n FROM tracks WHERE ${where}`,
          [sourceId, scanId],
        );
        markedUnavailable = Number(row?.n ?? 0);
        await this.db.run(`UPDATE tracks SET is_available = 0, updated_at = ? WHERE ${where}`, [
          Date.now(),
          sourceId,
          scanId,
        ]);
      }
      await this.db.run(
        "UPDATE library_sources SET last_scan_id = ?, last_scanned_at = ?, last_scan_status = ? WHERE id = ?",
        [scanId, Date.now(), status, sourceId],
      );
      return { markedUnavailable };
    });
  }

  private async artistId(name: string): Promise<string> {
    const key = nameKey(name);
    const cached = this.artistIds.get(key);
    if (cached) return cached;
    await this.db.run("INSERT OR IGNORE INTO artists (id, name, name_key) VALUES (?, ?, ?)", [
      this.newId(),
      name,
      key,
    ]);
    const [row] = await this.db.query<{ id: string }>("SELECT id FROM artists WHERE name_key = ?", [
      key,
    ]);
    if (!row) throw new Error("artist upsert failed");
    this.artistIds.set(key, row.id);
    return row.id;
  }

  private async albumId(title: string, artistId: string | null, year: number | null) {
    const key = nameKey(title);
    const cacheKey = `${key}\u0000${artistId ?? ""}`;
    let id = this.albumIds.get(cacheKey);
    if (!id) {
      const [row] = await this.db.query<{ id: string }>(
        "SELECT id FROM albums WHERE title_key = ? AND album_artist_id IS ?",
        [key, artistId],
      );
      id = row?.id;
      if (!id) {
        id = this.newId();
        await this.db.run(
          "INSERT INTO albums (id, title, title_key, album_artist_id, year) VALUES (?, ?, ?, ?, ?)",
          [id, title, key, artistId, year],
        );
      }
      this.albumIds.set(cacheKey, id);
    }
    if (year !== null) {
      await this.db.run("UPDATE albums SET year = ?, updated_at = ? WHERE id = ? AND year IS NOT ?", [
        year,
        Date.now(),
        id,
        year,
      ]);
    }
    return id;
  }

  // ---------- reads ----------

  async getSummary(): Promise<LibrarySummary> {
    const [row = { tracks: 0, albums: 0, artists: 0, playlists: 0 }] = await this.db.query<
      Record<keyof LibrarySummary, number>
    >(`SELECT
      (SELECT COUNT(*) FROM tracks WHERE is_available = 1) AS tracks,
      (SELECT COUNT(DISTINCT album_id) FROM tracks WHERE is_available = 1 AND album_id IS NOT NULL) AS albums,
      (SELECT COUNT(DISTINCT ta.artist_id) FROM track_artists ta JOIN tracks t ON t.id = ta.track_id WHERE t.is_available = 1) AS artists,
      (SELECT COUNT(*) FROM playlists) AS playlists`);
    return {
      tracks: Number(row.tracks),
      albums: Number(row.albums),
      artists: Number(row.artists),
      playlists: Number(row.playlists),
    };
  }

  async listTracks(): Promise<Track[]> {
    const rows = await this.db.query<TrackRow>(
      `${EFFECTIVE_TRACKS} ORDER BY title COLLATE NOCASE, t.id`,
    );
    return this.hydrate(rows);
  }

  async listAlbums(): Promise<Album[]> {
    const rows = await this.db.query<{
      id: string;
      title: string;
      artist_name: string | null;
      year: number | null;
      artwork_ref: string | null;
      track_count: number;
    }>(`SELECT al.id, al.title, ar.name AS artist_name, al.year, al.artwork_ref, COUNT(t.id) AS track_count
      FROM albums al
      JOIN tracks t ON t.album_id = al.id AND t.is_available = 1
      LEFT JOIN artists ar ON ar.id = al.album_artist_id
      GROUP BY al.id ORDER BY al.title COLLATE NOCASE, al.id`);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      artistName: r.artist_name ?? "Unknown artist",
      year: r.year,
      artworkUri: r.artwork_ref,
      trackCount: Number(r.track_count),
    }));
  }

  async listArtists(): Promise<Artist[]> {
    const rows = await this.db.query<{
      id: string;
      name: string;
      album_count: number;
      track_count: number;
    }>(
      `SELECT ar.id, ar.name, COUNT(DISTINCT t.album_id) AS album_count, COUNT(DISTINCT t.id) AS track_count
      FROM artists ar
      JOIN track_artists ta ON ta.artist_id = ar.id
      JOIN tracks t ON t.id = ta.track_id AND t.is_available = 1
      GROUP BY ar.id ORDER BY COALESCE(ar.sort_name, ar.name) COLLATE NOCASE, ar.id`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      albumCount: Number(r.album_count),
      trackCount: Number(r.track_count),
    }));
  }

  async listPlaylists(): Promise<Playlist[]> {
    const lists = await this.db.query<{
      id: string;
      name: string;
      created_at: number;
      updated_at: number;
    }>("SELECT id, name, created_at, updated_at FROM playlists ORDER BY name COLLATE NOCASE, id");
    const items = await this.db.query<{ playlist_id: string; track_id: string }>(
      "SELECT playlist_id, track_id FROM playlist_tracks ORDER BY playlist_id, position",
    );
    return lists.map((p) => ({
      id: p.id,
      name: p.name,
      trackIds: items.filter((i) => i.playlist_id === p.id).map((i) => i.track_id),
      createdAt: new Date(Number(p.created_at)).toISOString(),
      updatedAt: new Date(Number(p.updated_at)).toISOString(),
    }));
  }

  async search(query: string) {
    const q = query.trim();
    if (!q) return { tracks: [], albums: [], artists: [] };
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const tracks = await this.hydrate(
      await this.db.query<TrackRow>(
        `SELECT * FROM (${EFFECTIVE_TRACKS}) WHERE title LIKE ? ESCAPE '\\' OR album_title LIKE ? ESCAPE '\\' ORDER BY title COLLATE NOCASE LIMIT 50`,
        [like, like],
      ),
    );
    const albums = (await this.listAlbums()).filter((a) =>
      a.title.toLowerCase().includes(q.toLowerCase()),
    );
    const artists = (await this.listArtists()).filter((a) =>
      a.name.toLowerCase().includes(q.toLowerCase()),
    );
    return { tracks, albums, artists };
  }

  private async hydrate(rows: TrackRow[]): Promise<Track[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const credits = await this.db.query<CreditRow>(
      `SELECT ta.track_id, ta.artist_id, ar.name, ta.role, ta.source
       FROM track_artists ta JOIN artists ar ON ar.id = ta.artist_id
       WHERE ta.track_id IN (${ids.map(() => "?").join(",")})
       ORDER BY ta.track_id, ta.role, ta.position`,
      ids,
    );
    return rows.map((r) => {
      const own = credits.filter((c) => c.track_id === r.id);
      const manual = own.filter((c) => c.source === "manual");
      const effective = manual.length > 0 ? manual : own.filter((c) => c.source === "embedded");
      return {
        id: r.id,
        title: r.title,
        credits: effective.map((c) => ({ artistId: c.artist_id, name: c.name, role: c.role })),
        albumId: r.album_id,
        albumTitle: r.album_title,
        trackNumber: r.track_number,
        discNumber: r.disc_number,
        durationMs: Number(r.duration_ms),
        sourceUri: r.source_uri,
        artworkUri: r.artwork_ref,
        year: r.year,
        genre: r.genre,
        fieldSources: {
          title: r.title_manual ? "manual" : r.title_source === "filename" ? "filename" : "embedded",
          credits: manual.length > 0 ? "manual" : "embedded",
          albumTitle: r.album_manual ? "manual" : "embedded",
          year: r.year_manual ? "manual" : "embedded",
          genre: r.genre_manual ? "manual" : "embedded",
        },
        isFavorite: Boolean(r.is_favorite),
        addedAt: new Date(Number(r.created_at)).toISOString(),
      };
    });
  }
}
