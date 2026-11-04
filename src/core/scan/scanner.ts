import type { LawlietLibraryPlugin } from "../native/library-plugin";
import { normalizeAudioItem, type ScannedTrack } from "./normalize";

/**
 * Scan orchestration, shared by MediaStore discovery and SAF folder import.
 * Work is paged so the UI stays responsive and can be cancelled between pages.
 * A scan only marks missing tracks unavailable when it completed fully.
 */

export interface ScanWriter {
  ensureMediaStoreSource(): Promise<string>;
  beginScan(): string;
  applyScanBatch(
    sourceId: string,
    scanId: string,
    items: ScannedTrack[],
  ): Promise<{ added: number; updated: number }>;
  touchSeen(sourceId: string, scanId: string, uris: string[]): Promise<void>;
  finishScan(
    sourceId: string,
    scanId: string,
    status: "completed" | "cancelled" | "failed",
    options?: { markMissing?: boolean },
  ): Promise<{ markedUnavailable: number }>;
}

export type ScanStatus = "completed" | "cancelled" | "failed" | "permission-denied" | "access-lost";

export interface ScanResult {
  status: ScanStatus;
  found: number;
  added: number;
  updated: number;
  /** Items without a usable URI or title. */
  skipped: number;
  /** Items the platform could not read. */
  failed: number;
  markedUnavailable: number;
  message: string | null;
}

export interface ScanProgress {
  phase: "listing" | "reading";
  processed: number;
  total: number | null;
}

export interface ScanOptions {
  signal?: AbortSignal;
  onProgress?: (p: ScanProgress) => void;
  pageSize?: number;
}

const empty = (status: ScanStatus, message: string | null = null): ScanResult => ({
  status,
  found: 0,
  added: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  markedUnavailable: 0,
  message,
});

export function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object" && e && "message" in e) return String((e as { message: unknown }).message);
  return "Unknown error";
}

/** Requests audio permission only when the user starts a scan. */
export async function ensureAudioPermission(plugin: LawlietLibraryPlugin): Promise<boolean> {
  const { state } = await plugin.checkAudioPermission();
  if (state === "granted") return true;
  const after = await plugin.requestAudioPermission();
  return after.state === "granted";
}

export async function scanMediaStore(
  plugin: LawlietLibraryPlugin,
  writer: ScanWriter,
  { signal, onProgress, pageSize = 250 }: ScanOptions = {},
): Promise<ScanResult> {
  if (!(await ensureAudioPermission(plugin))) return empty("permission-denied");

  const sourceId = await writer.ensureMediaStoreSource();
  const scanId = writer.beginScan();
  const result = empty("completed");
  let total: number | null = null;
  try {
    total = (await plugin.countMediaStore()).count;
  } catch {
    total = null; // progress becomes indeterminate; scanning still works
  }
  onProgress?.({ phase: "reading", processed: 0, total });

  let afterId = 0;
  try {
    for (;;) {
      if (signal?.aborted) {
        result.status = "cancelled";
        break;
      }
      const page = await plugin.queryMediaStore({ afterId, limit: pageSize });
      result.found += page.items.length;
      const batch: ScannedTrack[] = [];
      for (const raw of page.items) {
        const t = normalizeAudioItem(raw, "mediastore");
        if (t) batch.push(t);
        else result.skipped++;
      }
      const w = await writer.applyScanBatch(sourceId, scanId, batch);
      result.added += w.added;
      result.updated += w.updated;
      onProgress?.({ phase: "reading", processed: result.found, total });
      if (page.done || page.items.length === 0 || page.lastId <= afterId) break;
      afterId = page.lastId;
    }
  } catch (e) {
    result.status = "failed";
    result.message = errorMessage(e);
  }
  const fin = await writer.finishScan(
    sourceId,
    scanId,
    result.status === "completed" ? "completed" : result.status === "cancelled" ? "cancelled" : "failed",
  );
  result.markedUnavailable = fin.markedUnavailable;
  return result;
}

export async function scanFolder(
  plugin: LawlietLibraryPlugin,
  writer: ScanWriter,
  source: { id: string; treeUri: string },
  { signal, onProgress, pageSize = 25 }: ScanOptions = {},
): Promise<ScanResult> {
  const access = await plugin.hasFolderAccess({ treeUri: source.treeUri }).catch(() => ({
    granted: false,
  }));
  if (!access.granted) {
    return empty(
      "access-lost",
      "Access to this folder is no longer granted. Choose the folder again to restore it.",
    );
  }
  const scanId = writer.beginScan();
  const result = empty("completed");
  onProgress?.({ phase: "listing", processed: 0, total: null });

  let docs: { uri: string }[];
  try {
    const listing = await plugin.listFolderAudio({ treeUri: source.treeUri });
    docs = listing.items;
    if (listing.truncated) {
      result.message = "This folder has more files than one import can handle; some were not read.";
    }
  } catch (e) {
    await writer.finishScan(source.id, scanId, "failed");
    return empty("failed", errorMessage(e));
  }
  result.found = docs.length;
  const truncated = result.message !== null;

  try {
    for (let i = 0; i < docs.length; i += pageSize) {
      if (signal?.aborted) {
        result.status = "cancelled";
        break;
      }
      onProgress?.({ phase: "reading", processed: i, total: docs.length });
      const uris = docs.slice(i, i + pageSize).map((d) => d.uri);
      const { items } = await plugin.readMetadata({ uris });
      const batch: ScannedTrack[] = [];
      const unreadable: string[] = [];
      for (const raw of items) {
        if (raw.error) {
          result.failed++;
          unreadable.push(raw.uri);
          continue;
        }
        const t = normalizeAudioItem(raw, "saf");
        if (t) batch.push(t);
        else result.skipped++;
      }
      const w = await writer.applyScanBatch(source.id, scanId, batch);
      // Present but unreadable this time: keep existing rows available.
      if (unreadable.length) await writer.touchSeen(source.id, scanId, unreadable);
      result.added += w.added;
      result.updated += w.updated;
    }
    if (result.status === "completed") {
      onProgress?.({ phase: "reading", processed: docs.length, total: docs.length });
    }
  } catch (e) {
    result.status = "failed";
    result.message = errorMessage(e);
  }
  // A truncated listing is not a complete view, so never mark rows missing from it.
  const finStatus = result.status === "cancelled" ? "cancelled" : result.status === "failed" ? "failed" : "completed";
  result.markedUnavailable = (
    await writer.finishScan(source.id, scanId, finStatus, { markMissing: !truncated })
  ).markedUnavailable;
  return result;
}
