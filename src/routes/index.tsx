import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { librarySummaryQuery } from "@/core/library/queries";
import { EmptyState, NATIVE_IMPORT_NOTE } from "@/components/screen/EmptyState";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => pageHead("Home", "Browse your local music library in LAWLIET. No account or audio uploads."),
  loader: ({ context }) => context.queryClient.ensureQueryData(librarySummaryQuery),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(librarySummaryQuery);
  const isEmpty = data.tracks === 0;

  return (
    <>
      <section className="rise-in mb-14 md:mb-20">
        <p className="eyebrow mb-4">Local library</p>
        <h1 className="display-title max-w-3xl text-6xl text-platinum md:text-8xl">
          Your music,
          <br />
          <span className="text-silver italic">kept close.</span>
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
          Your local music collection. No account, nothing uploaded. Audio playback is not implemented yet.
        </p>
      </section>

      <ul
        aria-label="Library totals"
        className="mb-14 grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-4"
      >
        {(
          [
            ["Songs", data.tracks, "/songs"],
            ["Albums", data.albums, "/albums"],
            ["Artists", data.artists, "/artists"],
            ["Playlists", data.playlists, "/playlists"],
          ] as const
        ).map(([label, n, to]) => (
          <li key={label}>
            <Link to={to} className="block bg-background px-5 py-5 transition-colors hover:bg-card">
              <span className="eyebrow block">{label}</span>
              <span className="mt-2 block font-mono text-3xl tabular-nums text-platinum">{n}</span>
            </Link>
          </li>
        ))}
      </ul>

      {isEmpty && (
        <EmptyState
          title="No music yet"
          body="Once the Android app scans your device or you choose a folder, your songs, albums and artists will appear here, read from their embedded tags."
          note={NATIVE_IMPORT_NOTE}
        />
      )}
    </>
  );
}
