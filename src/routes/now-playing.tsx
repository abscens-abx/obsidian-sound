import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useListeningView } from "@/core/playback/useListeningView";
import { PageHeader } from "@/components/screen/PageHeader";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/now-playing")({
  head: () =>
    pageHead(
      "Now Playing",
      "Your listening state. Audio playback and lyrics are not implemented yet.",
    ),
  component: NowPlaying,
});

function NowPlaying() {
  const { state, view } = useListeningView();
  const active = view === "active";

  return (
    <>
      <PageHeader eyebrow="Listening" title="Now Playing" />
      <section className="rise-in grid gap-8 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] sm:items-center md:gap-12">
        <div className="min-w-0">
          <div
            aria-hidden
            className="listening-void mx-auto grid aspect-square w-full max-w-56 place-items-center sm:max-w-80"
          >
            <span className="display-title text-5xl text-silver">L</span>
          </div>
          <p className="mt-5 text-center font-mono text-[0.6875rem] text-muted-foreground">
            {active ? "Artwork unavailable" : "No track selected"}
          </p>
        </div>
        <div className="min-w-0">
          <h2 className="display-title text-4xl text-platinum md:text-5xl">
            {active ? "Listening state" : "A quiet moment."}
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {view === "unavailable"
              ? "Nothing is playing. Audio playback is not implemented yet. Your local library is still here to browse."
              : active
                ? `Playback status: ${state.status}. Track details are unavailable.`
                : "Nothing is playing. Browse your local library."}
          </p>
          {active && state.error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Button asChild variant="outline" className="mt-6 min-h-11 px-5">
            <Link to="/library">
              Browse Library <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
      <section
        aria-labelledby="lyrics-h"
        className="mt-10 grid gap-3 border-t border-hairline pt-6 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] md:mt-12 md:gap-12"
      >
        <h2 id="lyrics-h" className="eyebrow">
          Lyrics
        </h2>
        <div className="min-w-0">
          <p className="text-sm text-platinum">Planned · not available</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Lyrics entry, import and synchronized display are not implemented yet.
          </p>
        </div>
      </section>
    </>
  );
}
