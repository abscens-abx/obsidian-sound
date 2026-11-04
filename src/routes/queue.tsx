import { createFileRoute } from "@tanstack/react-router";
import { usePlaybackState } from "@/core/playback/usePlayback";
import { PageHeader } from "@/components/screen/PageHeader";
import { EmptyState } from "@/components/screen/EmptyState";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/queue")({
  head: () => pageHead("Queue", "What plays next."),
  component: Queue,
});

function Queue() {
  const { queue } = usePlaybackState();
  return (
    <>
      <PageHeader eyebrow="Up next" title="Queue" meta={`${queue.length} ${queue.length === 1 ? "track" : "tracks"}`} />
      {queue.length === 0 && (
        <EmptyState
          title="Queue is empty"
          body="Playing an album, playlist or song fills the queue. It is owned by the native player so it survives the app going to the background."
        />
      )}
    </>
  );
}
