/**
 * Domain model. Platform-agnostic: shared by the web UI, the future Android
 * bridge (Capacitor + Media3) and any future iOS client.
 */

export type Id = string;

/** Where a field value came from. Manual edits must never be silently replaced. */
export type FieldSource = "embedded" | "manual";

export interface ArtistCredit {
  artistId: Id;
  name: string;
  role: "primary" | "featured" | "composer" | "producer";
}

export interface Track {
  id: Id;
  title: string;
  credits: ArtistCredit[];
  albumId: Id | null;
  albumTitle: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  durationMs: number;
  /** Platform content URI (e.g. content://media/...) — opaque to the UI. */
  sourceUri: string;
  artworkUri: string | null;
  year: number | null;
  genre: string | null;
  /** Per-field provenance for metadata correction. */
  fieldSources: Partial<Record<"title" | "credits" | "albumTitle" | "year" | "genre", FieldSource>>;
  isFavorite: boolean;
  addedAt: string;
}

export interface Album {
  id: Id;
  title: string;
  artistName: string;
  year: number | null;
  artworkUri: string | null;
  trackCount: number;
}

export interface Artist {
  id: Id;
  name: string;
  albumCount: number;
  trackCount: number;
}

export interface Playlist {
  id: Id;
  name: string;
  trackIds: Id[];
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySummary {
  tracks: number;
  albums: number;
  artists: number;
  playlists: number;
}

export type RepeatMode = "off" | "all" | "one";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlaybackState {
  status: PlaybackStatus;
  currentTrackId: Id | null;
  /** Position as reported by the native player clock — never a JS timer. */
  positionMs: number;
  durationMs: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Id[];
  error: string | null;
}

export const IDLE_PLAYBACK: PlaybackState = {
  status: "idle",
  currentTrackId: null,
  positionMs: 0,
  durationMs: 0,
  shuffle: false,
  repeat: "off",
  queue: [],
  error: null,
};
