import { Link } from "@tanstack/react-router";
import { usePlaybackState } from "@/core/playback/usePlayback";

/**
 * Persistent mini player. Shows real adapter state only. When idle it renders
 * no transport controls — there is nothing to control.
 */
export function MiniPlayer() {
  const state = usePlaybackState();
  const idle = state.status === "idle" || !state.currentTrackId;

  return (
    <Link
      to="/now-playing"
      className="flex h-[var(--mini-player-height)] items-center gap-3 border-t border-hairline bg-card px-5 transition-colors hover:bg-graphite md:px-6"
      aria-label={idle ? "Now playing: nothing playing" : "Open now playing"}
    >
      <span aria-hidden className="art-void size-9 shrink-0 rounded-sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-platinum">{idle ? "Nothing playing" : "Now playing"}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {idle ? "Choose a track from your library" : state.status}
        </span>
      </span>
      <span className="eyebrow hidden sm:inline">Idle</span>
    </Link>
  );
}
