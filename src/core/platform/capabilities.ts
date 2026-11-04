/**
 * Honest capability report. In the browser preview nothing native exists, so
 * every native capability is reported as unavailable. The Android bridge will
 * supply a real implementation once Capacitor + Media3 are wired.
 */

export type CapabilityKey =
  | "localDiscovery"
  | "folderImport"
  | "playback"
  | "backgroundPlayback"
  | "mediaSession"
  | "offlineDatabase";

export interface Capability {
  key: CapabilityKey;
  label: string;
  available: boolean;
  /** What the capability depends on, shown to the user. */
  requires: string;
}

export interface PlatformInfo {
  runtime: "web-preview" | "android";
  capabilities: Capability[];
}

const WEB_PREVIEW_CAPABILITIES: Capability[] = [
  { key: "localDiscovery", label: "Scan device music", available: false, requires: "Android MediaStore" },
  { key: "folderImport", label: "Import a folder", available: false, requires: "Storage Access Framework" },
  { key: "playback", label: "Audio playback", available: false, requires: "Media3 / ExoPlayer" },
  { key: "backgroundPlayback", label: "Background playback", available: false, requires: "MediaSessionService" },
  { key: "mediaSession", label: "Lock screen & headset controls", available: false, requires: "MediaSession" },
  { key: "offlineDatabase", label: "Offline library database", available: false, requires: "SQLite (native)" },
];

export function getPlatformInfo(): PlatformInfo {
  // A Capacitor runtime check will go here. Until the bridge exists, we are
  // always the web preview — never pretend otherwise.
  return { runtime: "web-preview", capabilities: WEB_PREVIEW_CAPABILITIES };
}

export function isCapabilityAvailable(key: CapabilityKey): boolean {
  return getPlatformInfo().capabilities.some((c) => c.key === key && c.available);
}
