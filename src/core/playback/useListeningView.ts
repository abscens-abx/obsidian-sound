import { useSyncExternalStore } from "react";
import { getPlatformInfo, subscribePlatform, WEB_PREVIEW_INFO } from "../platform/capabilities";
import { getPlaybackAdapter } from "./adapter";
import { listeningView } from "./listening-view";
import { usePlaybackState } from "./usePlayback";

export function useListeningView() {
  const state = usePlaybackState();
  const platform = useSyncExternalStore(subscribePlatform, getPlatformInfo, () => WEB_PREVIEW_INFO);
  const playbackAvailable = platform.capabilities.some((c) => c.key === "playback" && c.available);
  return {
    state,
    view: listeningView(state, getPlaybackAdapter().available, playbackAvailable),
  };
}