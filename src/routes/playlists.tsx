import { createFileRoute } from "@tanstack/react-router";
import { playlistsQuery } from "@/core/library/queries";
import { LibraryCollection } from "@/components/screen/LibraryCollection";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/playlists")({
  head: () => pageHead("Playlists", "Playlists you build from your own music."),
  loader: ({ context }) => context.queryClient.ensureQueryData(playlistsQuery),
  component: () => (
    <LibraryCollection
      eyebrow="Library"
      title="Playlists"
      noun={["playlist", "playlists"]}
      query={playlistsQuery}
      empty={{
        title: "No playlists",
        body: "Playlists are saved on your device. Creating them arrives with the offline database milestone.",
        note: "Playlist storage needs the on-device SQLite database, which is not yet connected.",
      }}
      renderItem={(p) => (
        <div className="flex items-center justify-between py-3">
          <p className="truncate text-sm text-platinum">{p.name}</p>
          <span className="font-mono text-xs text-muted-foreground">{p.trackIds.length}</span>
        </div>
      )}
    />
  ),
});
