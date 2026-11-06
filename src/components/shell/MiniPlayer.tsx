import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useListeningView } from "@/core/playback/useListeningView";

/**
 * Persistent mini player. Shows real adapter state only. When idle it renders
 * no transport controls — there is nothing to control.
 */
export function MiniPlayer() {
  const { state, view } = useListeningView();
  const idle = view !== "active";

  return (
    <Link
      to="/now-playing"
      className="flex h-[var(--mini-player-height)] items-center gap-3 border-t border-hairline bg-card px-5 transition-colors hover:bg-graphite md:px-6"
      aria-label={idle ? "Now playing: nothing playing" : "Open now playing"}
    >
      <span aria-hidden className="art-void size-9 shrink-0 rounded-sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-platinum">
          {idle ? "Nothing playing" : "Now playing"}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {view === "unavailable"
            ? "Playback not implemented yet"
            : idle
              ? "No track selected"
              : state.status}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-silver" aria-hidden />
    </Link>
  );
}
