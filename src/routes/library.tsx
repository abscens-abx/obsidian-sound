import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { librarySummaryQuery } from "@/core/library/queries";
import { PageHeader } from "@/components/screen/PageHeader";
import { libraryNav, utilityNav } from "@/components/shell/nav-items";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/library")({
  head: () => pageHead("Library", "Browse songs, albums, artists and playlists."),
  loader: ({ context }) => context.queryClient.ensureQueryData(librarySummaryQuery),
  component: Library,
});

function Library() {
  const { data } = useSuspenseQuery(librarySummaryQuery);
  const counts: Record<string, number> = {
    "/songs": data.tracks,
    "/albums": data.albums,
    "/artists": data.artists,
    "/playlists": data.playlists,
  };
  const items = [...libraryNav, utilityNav[0]];
  return (
    <>
      <PageHeader eyebrow="Collection" title="Library" />
      <ul className="divide-y divide-hairline border-y border-hairline">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-14 items-center gap-4 px-1 py-4 transition-colors hover:bg-card"
            >
              <Icon className="size-5 text-silver" strokeWidth={1.5} aria-hidden />
              <span className="flex-1 text-base text-platinum">{label}</span>
              {to in counts && (
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {counts[to]}
                </span>
              )}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
