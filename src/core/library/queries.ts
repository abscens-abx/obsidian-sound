import { queryOptions } from "@tanstack/react-query";
import { getLibraryRepository } from "./repository";
import { getScanRepository } from "../scan/scan-store";

export const librarySummaryQuery = queryOptions({
  queryKey: ["library", "summary"],
  queryFn: () => getLibraryRepository().getSummary(),
});

export const tracksQuery = queryOptions({
  queryKey: ["library", "tracks"],
  queryFn: () => getLibraryRepository().listTracks(),
});

export const albumsQuery = queryOptions({
  queryKey: ["library", "albums"],
  queryFn: () => getLibraryRepository().listAlbums(),
});

export const artistsQuery = queryOptions({
  queryKey: ["library", "artists"],
  queryFn: () => getLibraryRepository().listArtists(),
});

export const playlistsQuery = queryOptions({
  queryKey: ["library", "playlists"],
  queryFn: () => getLibraryRepository().listPlaylists(),
});

export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: ["library", "search", q],
    queryFn: () => getLibraryRepository().search(q),
    enabled: q.trim().length > 0,
  });

/** Saved scan sources (device + folders). Empty when scanning is not supported. */
export const sourcesQuery = queryOptions({
  queryKey: ["library", "sources"],
  queryFn: async () => (await getScanRepository()?.listSources()) ?? [],
});
