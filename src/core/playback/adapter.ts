import { IDLE_PLAYBACK, type Id, type PlaybackState, type RepeatMode } from "../types";

/**
 * Playback boundary. The real implementation is a Capacitor plugin that talks
 * to a Kotlin MediaSessionService hosting a Media3 ExoPlayer. Position comes
 * from the native player clock via events — never from a JS timer.
 */
export interface PlaybackAdapter {
  readonly available: boolean;
  getState(): PlaybackState;
  subscribe(listener: (state: PlaybackState) => void): () => void;
  playQueue(trackIds: Id[], startIndex: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(positionMs: number): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setShuffle(enabled: boolean): Promise<void>;
  setRepeat(mode: RepeatMode): Promise<void>;
}

export class PlaybackUnavailableError extends Error {
  constructor() {
    super("Playback requires the Android app (Media3). It is not available in the web preview.");
  }
}

/** Web-preview adapter: always idle; every command rejects honestly. */
export class UnavailablePlaybackAdapter implements PlaybackAdapter {
  readonly available = false;
  getState() {
    return IDLE_PLAYBACK;
  }
  subscribe() {
    return () => {};
  }
  private reject = () => Promise.reject(new PlaybackUnavailableError());
  playQueue = this.reject;
  play = this.reject;
  pause = this.reject;
  seekTo = this.reject;
  next = this.reject;
  previous = this.reject;
  setShuffle = this.reject;
  setRepeat = this.reject;
}

let adapter: PlaybackAdapter = new UnavailablePlaybackAdapter();
export const getPlaybackAdapter = () => adapter;
export const setPlaybackAdapter = (next: PlaybackAdapter) => {
  adapter = next;
};
