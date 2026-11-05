import type { QueryClient } from "@tanstack/react-query";
import { migrate } from "./db/migrate";
import { SqliteLibraryRepository } from "./library/sqlite-repository";
import { setLibraryRepository } from "./library/repository";
import {
  detectRuntime,
  markCapability,
  markImplemented,
  isCapabilityAvailable,
  setRuntime,
} from "./platform/capabilities";

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
      const repo = new SqliteLibraryRepository(db);
      setLibraryRepository(repo);
      markCapability("offlineDatabase", true);
      await queryClient.invalidateQueries({ queryKey: ["library"] });

      // Scanning needs both the database and the native plugin. Presence of the
      // plugin only marks the code as implemented; availability is earned by a
      // successful scan/import (see scan-store).
      const { loadLibraryPlugin } = await import("./native/library-plugin");
      const plugin = await loadLibraryPlugin();
      if (plugin) {
        const { configureScanning } = await import("./scan/scan-store");
        configureScanning({ plugin, repo, queryClient });
        markImplemented("localDiscovery");
        markImplemented("folderImport");
      }
    } catch (error) {
      console.error("Offline library failed to initialise", error);
      if (!isCapabilityAvailable("offlineDatabase")) markCapability("offlineDatabase", false);
    }
  })();
  return started;
}
