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
      <PageHeader
        eyebrow="Up next"
        title="Queue"
        meta={`${queue.length} ${queue.length === 1 ? "track" : "tracks"}`}
      />
      {queue.length === 0 && (
        <EmptyState
          title="Queue is empty"
          body="There are no queued tracks. Audio playback and queue controls are not implemented yet."
        />
      )}
    </>
  );
}
