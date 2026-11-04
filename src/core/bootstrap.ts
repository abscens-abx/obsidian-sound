import type { QueryClient } from "@tanstack/react-query";
import { migrate } from "./db/migrate";
import { SqliteLibraryRepository } from "./library/sqlite-repository";
import { setLibraryRepository } from "./library/repository";
import { detectRuntime, markCapability, setRuntime } from "./platform/capabilities";

let started: Promise<void> | null = null;

/**
 * Client-only startup. In the web preview this only records the runtime.
 * On Android it opens SQLite, runs migrations, and installs the SQLite
 * repository; the database capability is marked available only on success.
 */
export function bootstrapNative(queryClient: QueryClient): Promise<void> {
  if (started) return started;
  started = (async () => {
    const runtime = detectRuntime();
    setRuntime(runtime);
    if (runtime !== "android") return;
    try {
      const { openCapacitorDatabase } = await import("./db/capacitor-sqlite");
      const db = await openCapacitorDatabase();
      await migrate(db);
      setLibraryRepository(new SqliteLibraryRepository(db));
      markCapability("offlineDatabase", true);
      await queryClient.invalidateQueries({ queryKey: ["library"] });
    } catch (error) {
      console.error("Offline database failed to initialise", error);
      markCapability("offlineDatabase", false);
    }
  })();
  return started;
}
