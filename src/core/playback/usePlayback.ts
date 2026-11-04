import { useSyncExternalStore } from "react";
import { getPlaybackAdapter } from "./adapter";
import { IDLE_PLAYBACK } from "../types";

export function usePlaybackState() {
  const adapter = getPlaybackAdapter();
  return useSyncExternalStore(
    (cb) => adapter.subscribe(cb),
    () => adapter.getState(),
    () => IDLE_PLAYBACK,
  );
}
