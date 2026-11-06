import { describe, expect, it } from "vitest";
import { listeningView } from "@/core/playback/listening-view";
import { IDLE_PLAYBACK } from "@/core/types";

describe("honest listening state", () => {
  const playing = { ...IDLE_PLAYBACK, status: "playing" as const, currentTrackId: "local-track" };

  it("never presents an unavailable adapter as playback, even with a stale track", () => {
    expect(listeningView(playing, false, true)).toBe("unavailable");
  });

  it("requires playback capability success, not just an adapter or Android shell", () => {
    expect(listeningView(playing, true, false)).toBe("unavailable");
  });

  it("keeps idle native state idle even if it retains a track ID", () => {
    expect(listeningView({ ...playing, status: "idle" }, true, true)).toBe("idle");
  });

  it("requires a real selected track for an active session", () => {
    expect(listeningView({ ...playing, currentTrackId: null }, true, true)).toBe("idle");
    expect(listeningView(playing, true, true)).toBe("active");
  });
});