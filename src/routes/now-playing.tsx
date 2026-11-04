import { createFileRoute } from "@tanstack/react-router";
import { usePlaybackState } from "@/core/playback/usePlayback";
import { getPlaybackAdapter } from "@/core/playback/adapter";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/now-playing")({
  head: () => pageHead("Now Playing", "The track currently playing on your device."),
  component: NowPlaying,
});

function NowPlaying() {
  const state = usePlaybackState();
  const available = getPlaybackAdapter().available;

  return (
    <div className="rise-in grid gap-10 md:grid-cols-[minmax(0,22rem)_1fr] md:items-end md:gap-14">
      <div aria-hidden className="art-void aspect-square w-full max-w-sm rounded-md" />
      <div>
        <p className="eyebrow mb-3">Now playing</p>
        <h1 className="display-title text-5xl text-platinum md:text-6xl">
          {state.status === "idle" ? "Silence" : "Playing"}
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Nothing is playing. Start a song from your library and it will appear here with its
          artwork, progress and lyrics.
        </p>
        {!available && (
          <p className="mt-8 border-l border-silver/40 pl-3 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
            Playback runs natively on Android through Media3, including background and lock-screen
            controls. The web preview cannot play audio.
          </p>
        )}
        <section aria-labelledby="lyrics-h" className="mt-12 border-t border-hairline pt-6">
          <h2 id="lyrics-h" className="eyebrow mb-2">
            Lyrics
          </h2>
          <p className="text-sm text-muted-foreground">
            Manual lyrics and LRC import are planned. Synced lyrics will only be shown when a file
            has real timestamps.
          </p>
        </section>
      </div>
    </div>
  );
}
