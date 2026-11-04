import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { EmptyLibraryRepository } from "@/core/library/repository";
import { PlaybackUnavailableError, UnavailablePlaybackAdapter } from "@/core/playback/adapter";
import { getPlatformInfo } from "@/core/platform/capabilities";
import { formatDuration } from "@/lib/format";

describe("foundation", () => {
  it("web preview library is genuinely empty (no fixtures)", async () => {
    expect(await new EmptyLibraryRepository().getSummary()).toEqual({ tracks: 0, albums: 0, artists: 0, playlists: 0 });
  });

  it("web preview never claims native playback", async () => {
    const a = new UnavailablePlaybackAdapter();
    expect(a.available).toBe(false);
    await expect(a.play()).rejects.toBeInstanceOf(PlaybackUnavailableError);
    expect(getPlatformInfo().capabilities.every((c) => !c.available)).toBe(true);
  });

  it("formats durations", () => {
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });

  it.each(["/songs", "/albums", "/artists", "/playlists", "/search", "/library", "/queue", "/now-playing", "/settings"])(
    "matches %s",
    (path) => {
      const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
      expect(router.matchRoutes(path).at(-1)?.routeId).toBe(path);
    },
  );
});
