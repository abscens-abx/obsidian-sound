import { createFileRoute } from "@tanstack/react-router";
import { albumsQuery } from "@/core/library/queries";
import { LibraryCollection } from "@/components/screen/LibraryCollection";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/albums")({
  head: () => pageHead("Albums", "Albums assembled from your files' embedded tags."),
  loader: ({ context }) => context.queryClient.ensureQueryData(albumsQuery),
  component: () => (
    <LibraryCollection
      eyebrow="Library"
      title="Albums"
      noun={["album", "albums"]}
      query={albumsQuery}
      empty={{ title: "No albums", body: "Albums are grouped from the album and album-artist tags embedded in your files." }}
      renderItem={(a) => (
        <div className="py-3">
          <p className="truncate text-sm text-platinum">{a.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {a.artistName}
            {a.year ? ` · ${a.year}` : ""}
          </p>
        </div>
      )}
    />
  ),
});
