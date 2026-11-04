import { createFileRoute } from "@tanstack/react-router";
import { tracksQuery } from "@/core/library/queries";
import { LibraryCollection } from "@/components/screen/LibraryCollection";
import { formatDuration } from "@/lib/format";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/songs")({
  head: () => pageHead("Songs", "Every track in your local library."),
  loader: ({ context }) => context.queryClient.ensureQueryData(tracksQuery),
  component: () => (
    <LibraryCollection
      eyebrow="Library"
      title="Songs"
      noun={["song", "songs"]}
      query={tracksQuery}
      empty={{ title: "No songs", body: "Tracks you add to your library are listed here, sorted by title." }}
      renderItem={(t) => (
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-platinum">{t.title}</p>
            <p className="truncate text-xs text-muted-foreground">{t.credits.map((c) => c.name).join(", ")}</p>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatDuration(t.durationMs)}</span>
        </div>
      )}
    />
  ),
});
