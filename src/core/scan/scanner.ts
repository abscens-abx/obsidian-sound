import type { LawlietLibraryPlugin } from "../native/library-plugin";
import { normalizeAudioItem, normalizeSourceUri, type ScannedTrack } from "./normalize";

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

export type ScanStatus =
  "completed" | "cancelled" | "failed" | "permission-denied" | "access-lost" | "partial";

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
  if (typeof e === "object" && e && "message" in e)
    return String((e as { message: unknown }).message);
  return "Unknown error";
}

export function isAudioPermissionGranted(state: unknown): boolean {
  return state === "granted";
}

/** Requests audio permission only when the user starts a scan. */
export async function ensureAudioPermission(plugin: LawlietLibraryPlugin): Promise<boolean> {
  const { state } = await plugin.checkAudioPermission();
  if (isAudioPermissionGranted(state)) return true;
  const after = await plugin.requestAudioPermission();
  return isAudioPermissionGranted(after.state);
}

export async function scanMediaStore(
  plugin: LawlietLibraryPlugin,
  writer: ScanWriter,
  { signal, onProgress, pageSize = 250 }: ScanOptions = {},
): Promise<ScanResult> {
  pageSize = boundedPageSize(pageSize, 250);
  if (signal?.aborted) return empty("cancelled");
  if (!(await ensureAudioPermission(plugin))) return empty("permission-denied");
  if (signal?.aborted) return empty("cancelled");

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
      if (signal?.aborted) {
        result.status = "cancelled";
        break;
      }
      if (
        !Number.isSafeInteger(page.lastId) ||
        page.lastId < afterId ||
        (page.items.length > 0 && page.lastId <= afterId) ||
        (!page.done && page.items.length === 0)
      ) {
        throw new Error(
          "MediaStore returned an incomplete or non-advancing page. Try scanning again.",
        );
      }
      result.found += page.items.length;
      await writer.touchSeen(
        sourceId,
        scanId,
        page.items.map((r) => normalizeSourceUri(r.uri)).filter((u): u is string => u !== null),
      );
      const batch: ScannedTrack[] = [];
      for (const raw of page.items) {
        if (raw.error) {
          result.failed++;
          continue;
        }
        const t = normalizeAudioItem(raw, "mediastore");
        if (t) batch.push(t);
        else result.skipped++;
      }
      const w = await writer.applyScanBatch(sourceId, scanId, batch);
      result.added += w.added;
      result.updated += w.updated;
      onProgress?.({ phase: "reading", processed: result.found, total });
      if (page.done) break;
      afterId = page.lastId;
    }
  } catch (e) {
    result.status = "failed";
    result.message = errorMessage(e);
  }
  if (signal?.aborted) result.status = "cancelled";
  if (result.status === "completed" && (result.failed || result.skipped)) {
    result.status = "partial";
    result.message = "Some audio metadata could not be read. Existing tracks were kept; try again.";
  }
  const fin = await writer.finishScan(
    sourceId,
    scanId,
    result.status === "completed"
      ? "completed"
      : result.status === "cancelled"
        ? "cancelled"
        : "failed",
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
  pageSize = boundedPageSize(pageSize, 25);
  if (signal?.aborted) return empty("cancelled");
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

  let docs: Awaited<ReturnType<LawlietLibraryPlugin["listFolderAudio"]>>["items"];
  try {
    const listing = await plugin.listFolderAudio({ treeUri: source.treeUri });
    docs = [...new Map(listing.items.map((d) => [d.uri, d])).values()];
    if (docs.some((d) => normalizeSourceUri(d.uri) !== d.uri)) {
      throw new Error("The provider returned an invalid document reference. Existing tracks were kept.");
    }
    if (signal?.aborted) {
      await writer.finishScan(source.id, scanId, "cancelled");
      return empty("cancelled");
    }
    if (listing.truncated) {
      result.message = "The provider returned an incomplete listing or the import limit was reached. Existing tracks were kept; try again.";
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
      if (signal?.aborted) {
        result.status = "cancelled";
        break;
      }
      const received = new Set(items.map((i) => i.uri));
      if (
        received.size !== uris.length ||
        items.length !== uris.length ||
        uris.some((u) => !received.has(u))
      ) {
        throw new Error(
          "The provider returned incomplete metadata. Existing tracks were kept; try again.",
        );
      }
      await writer.touchSeen(source.id, scanId, uris);
      const batch: ScannedTrack[] = [];
      const unreadable: string[] = [];
      for (const raw of items) {
        if (raw.error) {
          result.failed++;
          unreadable.push(raw.uri);
          continue;
        }
        const document = docs.slice(i, i + pageSize).find((d) => d.uri === raw.uri);
        const t = normalizeAudioItem({ ...document, ...raw, modifiedMs: raw.modifiedMs ?? document?.modifiedMs }, "saf");
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
  if (signal?.aborted) result.status = "cancelled";
  if (result.status === "completed" && (truncated || result.failed || result.skipped)) {
    result.status = "partial";
    result.message ??=
      "Some audio metadata could not be read. Existing tracks were kept; try again.";
  }
  // Partial scans are stored as failed, never as completed.
  const finStatus =
    result.status === "cancelled"
      ? "cancelled"
      : result.status !== "completed"
        ? "failed"
        : "completed";
  result.markedUnavailable = (
    await writer.finishScan(source.id, scanId, finStatus, { markMissing: !truncated })
  ).markedUnavailable;
  return result;
}

function boundedPageSize(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(500, Math.floor(value))) : fallback;
}
