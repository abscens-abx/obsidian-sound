import type { Album, Artist, LibrarySummary, Playlist, Track } from "../types";

/**
 * Library data boundary. The Android build will implement this over native
 * SQLite (source of truth). The web preview uses EmptyLibraryRepository, which
 * returns genuinely empty results — no fixtures, no fabricated content.
 */
export interface LibraryRepository {
  getSummary(): Promise<LibrarySummary>;
  listTracks(): Promise<Track[]>;
  listAlbums(): Promise<Album[]>;
  listArtists(): Promise<Artist[]>;
  listPlaylists(): Promise<Playlist[]>;
  search(query: string): Promise<{ tracks: Track[]; albums: Album[]; artists: Artist[] }>;
}

export class EmptyLibraryRepository implements LibraryRepository {
  async getSummary(): Promise<LibrarySummary> {
    return { tracks: 0, albums: 0, artists: 0, playlists: 0 };
  }
  async listTracks() {
    return [];
  }
  async listAlbums() {
    return [];
  }
  async listArtists() {
    return [];
  }
  async listPlaylists() {
    return [];
  }
  async search(_query: string) {
    return { tracks: [], albums: [], artists: [] };
  }
}

let repository: LibraryRepository = new EmptyLibraryRepository();

export function getLibraryRepository(): LibraryRepository {
  return repository;
}

/** Called by the native bridge at startup to install the SQLite-backed implementation. */
export function setLibraryRepository(next: LibraryRepository) {
  repository = next;
}
