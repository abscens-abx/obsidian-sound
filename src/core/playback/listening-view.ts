import type { PlaybackState } from "../types";

/** A stale track ID must not turn an unavailable adapter into a listening session. */
export function listeningView(
  state: PlaybackState,
  adapterAvailable: boolean,
  playbackAvailable: boolean,
) {
  if (!adapterAvailable || !playbackAvailable) return "unavailable";
  if (state.status === "idle" || !state.currentTrackId) return "idle";
  return "active";
}