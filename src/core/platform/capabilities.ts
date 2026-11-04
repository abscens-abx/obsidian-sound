/**
 * Truthful capability state. Every capability starts unavailable and is only
 * flipped by the code that actually implements it, after it succeeds at
 * runtime. Being inside the Android shell does NOT by itself enable anything.
 */

export type CapabilityKey =
  | "localDiscovery"
  | "folderImport"
  | "playback"
  | "backgroundPlayback"
  | "mediaSession"
  | "offlineDatabase";

export type Runtime = "web-preview" | "android" | "ios";

export interface Capability {
  key: CapabilityKey;
  label: string;
  available: boolean;
  /** Native code for this capability is present in this build (not yet proof it works). */
  implemented?: boolean;
  requires: string;
}

export interface PlatformInfo {
  runtime: Runtime;
  capabilities: Capability[];
}

const BASE: Capability[] = [
  {
    key: "localDiscovery",
    label: "Scan device music",
    available: false,
    requires: "Android MediaStore",
  },
  {
    key: "folderImport",
    label: "Import a folder",
    available: false,
    requires: "Storage Access Framework",
  },
  { key: "playback", label: "Audio playback", available: false, requires: "Media3 / ExoPlayer" },
  {
    key: "backgroundPlayback",
    label: "Background playback",
    available: false,
    requires: "MediaSessionService",
  },
  {
    key: "mediaSession",
    label: "Lock screen & headset controls",
    available: false,
    requires: "MediaSession",
  },
  {
    key: "offlineDatabase",
    label: "Offline library database",
    available: false,
    requires: "SQLite on device",
  },
];

export const WEB_PREVIEW_INFO: PlatformInfo = { runtime: "web-preview", capabilities: BASE };

/** Pure mapping from Capacitor's platform string; anything unknown is the web preview. */
export function runtimeFromPlatform(platform: string | undefined, isNative: boolean): Runtime {
  if (!isNative) return "web-preview";
  if (platform === "android") return "android";
  if (platform === "ios") return "ios";
  return "web-preview";
}

/** Safe in SSR and the browser: only reports native when Capacitor's native bridge is present. */
export function detectRuntime(): Runtime {
  if (typeof window === "undefined") return "web-preview";
  const cap = (
    window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }
  ).Capacitor;
  return runtimeFromPlatform(cap?.getPlatform?.(), Boolean(cap?.isNativePlatform?.()));
}

let info: PlatformInfo = WEB_PREVIEW_INFO;
const listeners = new Set<() => void>();

export function getPlatformInfo(): PlatformInfo {
  return info;
}

export function subscribePlatform(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setRuntime(runtime: Runtime) {
  info = { ...info, runtime };
  listeners.forEach((l) => l());
}

/** Call only from the implementation of `key`, after it has succeeded. */
export function markCapability(key: CapabilityKey, available: boolean) {
  info = {
    ...info,
    capabilities: info.capabilities.map((c) => (c.key === key ? { ...c, available } : c)),
  };
  listeners.forEach((l) => l());
}

/** Records that native code exists for `key`. Never makes it available. */
export function markImplemented(key: CapabilityKey) {
  info = {
    ...info,
    capabilities: info.capabilities.map((c) => (c.key === key ? { ...c, implemented: true } : c)),
  };
  listeners.forEach((l) => l());
}

export function isCapabilityAvailable(key: CapabilityKey): boolean {
  return info.capabilities.some((c) => c.key === key && c.available);
}

/** Test helper. */
export function resetPlatformInfo() {
  info = WEB_PREVIEW_INFO;
  listeners.forEach((l) => l());
}
