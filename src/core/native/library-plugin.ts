import type { RawAudioItem } from "../scan/normalize";

/**
 * Typed bridge to the Kotlin `LawlietLibrary` Capacitor plugin
 * (android/app/src/main/java/app/obsidiansound/player/library/LawlietLibraryPlugin.kt).
 * Every URI crossing this boundary is an opaque content:// URI; no file paths.
 */

export type AudioPermissionState = "granted" | "denied" | "prompt" | "prompt-with-rationale";

export interface FolderAudioDocument {
  uri: string;
  displayName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  modifiedMs: number | null;
}

export interface MetadataResult extends RawAudioItem {
  /** Set when the platform could not read this document. */
  error?: string | null;
}

export interface LawlietLibraryPlugin {
  checkAudioPermission(): Promise<{ state: AudioPermissionState }>;
  requestAudioPermission(): Promise<{ state: AudioPermissionState }>;
  openAppSettings(): Promise<void>;
  countMediaStore(): Promise<{ count: number }>;
  /** Keyset page over MediaStore.Audio (IS_MUSIC), ordered by _ID. */
  queryMediaStore(options: {
    afterId: number;
    limit: number;
  }): Promise<{ items: RawAudioItem[]; lastId: number; done: boolean }>;
  /** ACTION_OPEN_DOCUMENT_TREE; persists read permission on success. */
  pickFolder(): Promise<{ cancelled: boolean; treeUri?: string; displayName?: string }>;
  hasFolderAccess(options: { treeUri: string }): Promise<{ granted: boolean }>;
  listFolderAudio(options: {
    treeUri: string;
  }): Promise<{ items: FolderAudioDocument[]; truncated: boolean }>;
  readMetadata(options: { uris: string[] }): Promise<{ items: MetadataResult[] }>;
}

export const PLUGIN_NAME = "LawlietLibrary";

/** Native-only: dynamic import keeps @capacitor/core out of web/SSR evaluation. */
export async function loadLibraryPlugin(): Promise<LawlietLibraryPlugin | null> {
  const { Capacitor, registerPlugin } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable(PLUGIN_NAME)) return null;
  return registerPlugin<LawlietLibraryPlugin>(PLUGIN_NAME);
}
