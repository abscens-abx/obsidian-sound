import type { SqlExecutor } from "../db/executor";
import type { Album, Artist, ArtistCredit, LibrarySummary, Playlist, Track } from "../types";
import type { LibraryRepository } from "./repository";

/**
 * Read side of the SQLite library. Effective metadata = manual override ?? embedded.
 * Write paths (scanning, editing) arrive in later milestones.
 */

const EFFECTIVE_TRACKS = `
SELECT t.id, t.source_uri, t.album_id, t.duration_ms, t.artwork_ref, t.created_at,
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
  constructor(private readonly db: SqlExecutor) {}

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
          title: r.title_manual ? "manual" : "embedded",
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
