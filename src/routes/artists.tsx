import { createFileRoute } from "@tanstack/react-router";
import { artistsQuery } from "@/core/library/queries";
import { LibraryCollection } from "@/components/screen/LibraryCollection";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/artists")({
  head: () => pageHead("Artists", "Artists credited across your local library."),
  loader: ({ context }) => context.queryClient.ensureQueryData(artistsQuery),
  component: () => (
    <LibraryCollection
      eyebrow="Library"
      title="Artists"
      noun={["artist", "artists"]}
      query={artistsQuery}
      empty={{ title: "No artists", body: "Every credited artist, including featured credits, will be listed here." }}
      renderItem={(a) => (
        <div className="flex items-center justify-between py-3">
          <p className="truncate text-sm text-platinum">{a.name}</p>
          <span className="font-mono text-xs text-muted-foreground">{a.trackCount}</span>
        </div>
      )}
    />
  ),
});
