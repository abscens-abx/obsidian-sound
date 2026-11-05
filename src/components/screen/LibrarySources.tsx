import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { sourcesQuery } from "@/core/library/queries";
import {
  cancelScan,
  dismissScanResult,
  getScanState,
  IDLE_SCAN,
  importNewFolder,
  isScanningSupported,
  openAppSettings,
  rescanFolder,
  startDeviceScan,
  subscribeScan,
} from "@/core/scan/scan-store";
import { Button } from "@/components/ui/button";
import type { ScanResult } from "@/core/scan/scanner";

const btn =
  "inline-flex min-h-11 items-center rounded-md border border-silver/40 px-4 text-sm text-platinum transition-colors hover:bg-graphite focus-visible:outline focus-visible:outline-2 focus-visible:outline-silver";

function summary(r: ScanResult): string {
  switch (r.status) {
    case "permission-denied":
      return "Music access was not granted. LAWLIET only reads audio files, and only when you ask it to.";
    case "partial":
    case "access-lost":
    case "failed":
      return r.message ?? "The scan could not finish.";
    case "cancelled":
      return `Stopped. ${r.added} added, ${r.updated} refreshed before stopping.`;
    default:
      if (r.found === 0) return "Finished. No audio files were found.";
      return (
        [
          `${r.found} found`,
          `${r.added} added`,
          `${r.updated} refreshed`,
          r.markedUnavailable ? `${r.markedUnavailable} no longer present` : "",
          r.failed ? `${r.failed} could not be read` : "",
          r.skipped ? `${r.skipped} skipped` : "",
        ]
          .filter(Boolean)
          .join(" · ") + (r.message ? `. ${r.message}` : "")
      );
  }
}

/** Scan/import entry point. Renders real controls only when native scanning is configured. */
export function LibrarySources() {
  const supported = useSyncExternalStore(subscribeScan, isScanningSupported, () => false);
  const state = useSyncExternalStore(subscribeScan, getScanState, () => IDLE_SCAN);
  const { data: sources = [] } = useQuery({ ...sourcesQuery, enabled: supported });
  const running = state.phase === "running";

  return (
    <section aria-labelledby="src-h" className="mt-14 max-w-2xl">
      <h2 id="src-h" className="eyebrow mb-4">
        Sources
      </h2>
      {!supported ? (
        <p className="border-l border-silver/40 pl-3 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
          Scanning device music and importing folders run in the LAWLIET Android app. The web
          preview cannot read device files.
        </p>
      ) : (
        <>
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            Scanning asks for permission to read audio files on this device. Folder import uses the
            system picker and reads only the folder you choose. Nothing is copied or uploaded.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              type="button"
              className={btn}
              disabled={running}
              onClick={() => void startDeviceScan()}
            >
              Scan device music
            </Button>
            <Button
              variant="outline"
              type="button"
              className={btn}
              disabled={running}
              onClick={() => void importNewFolder()}
            >
              Add a folder
            </Button>
          </div>

          <div aria-live="polite" className="mt-6 min-h-6 text-sm">
            {state.phase === "running" && (
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-platinum">
                  {state.job.kind === "device"
                    ? "Scanning device music"
                    : `Importing ${state.job.label}`}
                  {state.progress?.phase === "listing" && " — listing files"}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {state.progress
                    ? `${state.progress.processed}${state.progress.total != null ? ` / ${state.progress.total}` : ""}`
                    : "…"}
                </span>
                <Button variant="outline" type="button" className={btn} onClick={cancelScan}>
                  Cancel
                </Button>
              </div>
            )}
            {state.phase === "done" && (
              <div className="space-y-3">
                <p className="text-muted-foreground">{summary(state.result)}</p>
                <div className="flex flex-wrap gap-3">
                  {state.result.status === "permission-denied" && (
                    <>
                      <Button
                        variant="outline"
                        type="button"
                        className={btn}
                        onClick={() => void startDeviceScan()}
                      >
                        Try again
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        className={btn}
                        onClick={() => void openAppSettings()}
                      >
                        Open app settings
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    type="button"
                    className={btn}
                    onClick={dismissScanResult}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </div>

          {sources.length > 0 && (
            <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
              {sources.map((s) => (
                <li key={s.id} className="flex min-h-14 items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm text-platinum">{s.displayName}</p>
                    <p className="font-mono text-[0.6875rem] text-muted-foreground">
                      {s.trackCount} tracks
                      {s.lastScanStatus ? ` · last ${s.lastScanStatus}` : ""}
                    </p>
                  </div>
                  {s.kind === "saf" && s.treeUri && (
                    <Button
                      variant="outline"
                      type="button"
                      className={btn}
                      disabled={running}
                      aria-label={`Rescan ${s.displayName}`}
                      onClick={() =>
                        s.treeUri
                          ? void rescanFolder({
                              id: s.id,
                              treeUri: s.treeUri,
                              displayName: s.displayName,
                            })
                          : undefined
                      }
                    >
                      Rescan
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
