/**
 * Pure normalisation of raw native scan results into embedded-tag values.
 * Never invents metadata: missing or placeholder values become null. The only
 * derived value is a title from the file name, and it is marked 'filename'.
 */

export type SourceKind = "mediastore" | "saf";

/** Shape returned by the native LawlietLibrary plugin (both MediaStore and SAF). */
export interface RawAudioItem {
  uri: string;
  mediaStoreId?: number | null;
  displayName?: string | null;
  title?: string | null;
  artist?: string | null;
  albumArtist?: string | null;
  album?: string | null;
  /** MediaStore TRACK column (disc * 1000 + track) or a tag string like "3/12". */
  track?: number | string | null;
  /** Disc tag, e.g. "1/2". MediaStore usually encodes disc inside `track`. */
  disc?: number | string | null;
  durationMs?: number | string | null;
  year?: number | string | null;
  genre?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  modifiedMs?: number | null;
  artworkRef?: string | null;
}

export interface ScannedTrack {
  sourceUri: string;
  sourceKind: SourceKind;
  mediastoreId: number | null;
  title: string;
  titleSource: "embedded" | "filename";
  artist: string | null;
  albumArtist: string | null;
  album: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  durationMs: number;
  year: number | null;
  genre: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  modifiedAt: number | null;
  artworkRef: string | null;
}

/** Values Android and tag writers use to mean "no value". */
const PLACEHOLDERS = new Set(["<unknown>", "unknown", "unknown artist", "unknown album", "null"]);

export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Strip control characters (incl. NULs some ID3 writers leave behind).
  // eslint-disable-next-line no-control-regex
  const t = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || PLACEHOLDERS.has(t.toLowerCase())) return null;
  return t;
}

/** Case/width-insensitive key used to merge artists and albums with the same name. */
export function nameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function positiveInt(value: unknown): number | null {
  const n =
    typeof value === "number" ? value : typeof value === "string" ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** "3/12" -> 3, "07" -> 7, 0/garbage -> null. */
export function parsePartNumber(value: unknown): number | null {
  if (typeof value === "string") return positiveInt(value.split("/")[0]?.trim());
  return positiveInt(value);
}

/** MediaStore packs disc into TRACK as disc*1000 + track. */
export function decodeMediaStoreTrack(raw: unknown): { track: number | null; disc: number | null } {
  const n = positiveInt(raw);
  if (n === null) return { track: null, disc: null };
  if (n >= 1000) return { track: positiveInt(n % 1000), disc: positiveInt(Math.floor(n / 1000)) };
  return { track: n, disc: null };
}

export function parseYear(value: unknown): number | null {
  const s = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const m = /^\s*(\d{4})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1 && y <= 9999 ? y : null;
}

/**
 * Accepts only content:// URIs and returns them unchanged (trimmed). URIs are
 * opaque: never decoded, re-encoded or converted to file paths.
 */
export function normalizeSourceUri(uri: unknown): string | null {
  if (typeof uri !== "string") return null;
  const t = uri.trim();
  return /^content:\/\/[^/\s?#]+\/[^\s?#]+$/.test(t) ? t : null;
}

export function titleFromFileName(name: unknown): string | null {
  const t = cleanText(name);
  if (!t) return null;
  return cleanText(t.replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/_/g, " "));
}

/** Returns null when the item cannot be stored (bad URI or no usable title). */
export function normalizeAudioItem(raw: RawAudioItem, kind: SourceKind): ScannedTrack | null {
  const sourceUri = normalizeSourceUri(raw.uri);
  if (!sourceUri) return null;

  const tagTitle = cleanText(raw.title);
  const fallback = tagTitle ? null : titleFromFileName(raw.displayName);
  const title = tagTitle ?? fallback;
  if (!title) return null;

  let trackNumber: number | null;
  let discNumber: number | null;
  if (kind === "mediastore" && typeof raw.track !== "string") {
    const d = decodeMediaStoreTrack(raw.track);
    trackNumber = d.track;
    discNumber = parsePartNumber(raw.disc) ?? d.disc;
  } else {
    trackNumber = parsePartNumber(raw.track);
    discNumber = parsePartNumber(raw.disc);
  }

  const duration = Number(raw.durationMs);
  const size = Number(raw.sizeBytes);
  const modified = Number(raw.modifiedMs);
  const msId = Number(raw.mediaStoreId);
  return {
    sourceUri,
    sourceKind: kind,
    mediastoreId: kind === "mediastore" && Number.isInteger(msId) && msId > 0 ? msId : null,
    title,
    titleSource: tagTitle ? "embedded" : "filename",
    artist: cleanText(raw.artist),
    albumArtist: cleanText(raw.albumArtist),
    album: cleanText(raw.album),
    trackNumber,
    discNumber,
    durationMs: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0,
    year: parseYear(raw.year),
    genre: cleanText(raw.genre),
    mimeType: cleanText(raw.mimeType)?.toLowerCase() ?? null,
    sizeBytes:
      Number.isFinite(size) && size >= 0 && raw.sizeBytes != null ? Math.floor(size) : null,
    modifiedAt:
      Number.isFinite(modified) && modified > 0 && raw.modifiedMs != null
        ? Math.floor(modified)
        : null,
    artworkRef: normalizeSourceUri(raw.artworkRef),
  };
}
