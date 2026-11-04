import { useSuspenseQuery, type UseSuspenseQueryOptions } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { EmptyState, NATIVE_IMPORT_NOTE } from "./EmptyState";
import { PageHeader } from "./PageHeader";

/**
 * Shared screen for a library collection (songs, albums, artists, playlists).
 * Renders real repository data; lists render once the native repository exists.
 */
export function LibraryCollection<T extends { id: string }>({
  eyebrow,
  title,
  noun,
  query,
  empty,
  renderItem,
}: {
  eyebrow: string;
  title: string;
  noun: [string, string];
  query: UseSuspenseQueryOptions<T[], Error, T[], readonly unknown[]>;
  empty: { title: string; body: string; note?: string };
  renderItem: (item: T) => ReactNode;
}) {
  const { data } = useSuspenseQuery(query);
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} meta={`${data.length} ${data.length === 1 ? noun[0] : noun[1]}`} />
      {data.length === 0 ? (
        <EmptyState {...empty} note={empty.note ?? NATIVE_IMPORT_NOTE} />
      ) : (
        <ul className="divide-y divide-hairline">
          {data.map((item) => (
            <li key={item.id}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
    </>
  );
}
