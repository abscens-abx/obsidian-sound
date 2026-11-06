import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { useDeferredValue, useId, useState } from "react";
import { searchQuery } from "@/core/library/queries";
import { PageHeader } from "@/components/screen/PageHeader";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/search")({
  head: () => pageHead("Search", "Search your local library by title, artist or album."),
  component: SearchPage,
});

function SearchPage() {
  const id = useId();
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q.trim());
  const { data, isFetching } = useQuery(searchQuery(deferred));
  const total = data ? data.tracks.length + data.albums.length + data.artists.length : 0;

  return (
    <>
      <PageHeader eyebrow="Find" title="Search" />
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mb-10">
        <label htmlFor={id} className="sr-only">
          Search your library
        </label>
        <SearchIcon
          className="pointer-events-none absolute left-0 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden
        />
        <input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Songs, albums, artists"
          autoComplete="off"
          className="w-full border-b border-input bg-transparent py-4 pl-9 text-xl text-platinum placeholder:text-muted-foreground focus:border-silver focus:outline-none"
        />
      </form>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {deferred.length === 0
          ? "Search your available local library by song, album or artist."
          : isFetching
            ? "Searching…"
            : total === 0
              ? `No matches for "${deferred}" in your library.`
              : `${total} results`}
      </p>
    </>
  );
}
