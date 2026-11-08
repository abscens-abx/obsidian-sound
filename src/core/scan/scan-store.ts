import type { QueryClient } from "@tanstack/react-query";
import type { SqliteLibraryRepository } from "../library/sqlite-repository";
import type { LawlietLibraryPlugin } from "../native/library-plugin";
import { markCapability } from "../platform/capabilities";
import {
  errorMessage,
  scanFolder,
  scanMediaStore,
  type ScanProgress,
  type ScanResult,
} from "./scanner";

/**
 * App-wide scan state so progress survives navigation. Only configured on
 * Android after SQLite and the native plugin are both ready; otherwise
 * `isScanningSupported()` is false and the UI shows no scan controls.
 */

export type ScanJob = { kind: "device" } | { kind: "folder"; label: string };

export type ScanState =
  | { phase: "idle" }
  | { phase: "running"; job: ScanJob; progress: ScanProgress | null }
  | { phase: "done"; job: ScanJob; result: ScanResult };

interface Deps {
  plugin: LawlietLibraryPlugin;
  repo: SqliteLibraryRepository;
  queryClient: QueryClient;
}

let deps: Deps | null = null;
let state: ScanState = { phase: "idle" };
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function set(next: ScanState) {
  state = next;
  listeners.forEach((l) => l());
}

export const getScanState = () => state;
export const IDLE_SCAN: ScanState = { phase: "idle" };
export function subscribeScan(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function configureScanning(next: Deps) {
  deps = next;
  listeners.forEach((l) => l());
}
export const isScanningSupported = () => deps !== null;
export const getScanRepository = () => deps?.repo ?? null;

async function run(job: ScanJob, work: (d: Deps, signal: AbortSignal) => Promise<ScanResult>) {
  if (!deps || state.phase === "running") return;
  const d = deps;
  controller = new AbortController();
  set({ phase: "running", job, progress: null });
  let result: ScanResult;
  try {
    result = await work(d, controller.signal);
  } catch (e) {
    result = {
      status: "failed",
      found: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      markedUnavailable: 0,
      message: errorMessage(e),
    };
  }
  controller = null;
  set({ phase: "done", job, result });
  await d.queryClient.invalidateQueries({ queryKey: ["library"] });
}

const progress = (job: ScanJob) => (p: ScanProgress) => {
  if (state.phase === "running") set({ phase: "running", job, progress: p });
};

export function startDeviceScan() {
  const job: ScanJob = { kind: "device" };
  return run(job, async (d, signal) => {
    const r = await scanMediaStore(d.plugin, d.repo, { signal, onProgress: progress(job) });
    // Exercised end to end: permission granted and MediaStore read fully.
    if (r.status === "permission-denied") markCapability("localDiscovery", false);
    if (r.status === "completed") markCapability("localDiscovery", true);
    return r;
  });
}

/** Opens the system folder picker, saves the folder, then imports it. */
export function importNewFolder() {
  if (!deps || state.phase === "running") return Promise.resolve();
  const job: ScanJob = { kind: "folder", label: "Folder" };
  return run(job, async (d, signal) => {
    const picked = await d.plugin.pickFolder();
    if (picked.cancelled || !picked.treeUri || signal.aborted) {
      return {
        status: "cancelled",
        found: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        markedUnavailable: 0,
        message: null,
      };
    }
    const label = picked.displayName || "Folder";
    const id = await d.repo.upsertFolderSource(picked.treeUri, label);
    const r = await scanFolder(
      d.plugin,
      d.repo,
      { id, treeUri: picked.treeUri },
      { signal, onProgress: progress(job) },
    );
    if (r.status === "completed") markCapability("folderImport", true);
    return r;
  });
}

export function rescanFolder(source: { id: string; treeUri: string; displayName: string }) {
  const job: ScanJob = { kind: "folder", label: source.displayName };
  return run(job, async (d, signal) => {
    const r = await scanFolder(d.plugin, d.repo, source, { signal, onProgress: progress(job) });
    if (r.status === "completed") markCapability("folderImport", true);
    return r;
  });
}

export function cancelScan() {
  controller?.abort();
  void deps?.plugin.cancelScan().catch(() => {
    // JS cancellation still prevents writes/finalisation as a complete scan.
  });
}

export function dismissScanResult() {
  if (state.phase === "done") set({ phase: "idle" });
}

export async function openAppSettings() {
  try {
    await deps?.plugin.openAppSettings();
  } catch (e) {
    if (state.phase === "done") {
      set({ ...state, result: { ...state.result, message: errorMessage(e) } });
    }
  }
}
