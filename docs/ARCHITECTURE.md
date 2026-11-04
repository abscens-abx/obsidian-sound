# Architecture

```text
UI (TanStack Start, React, Tailwind)  ── routes/, components/
        │ typed boundaries
core/   ├─ types.ts               domain model (platform-agnostic)
        ├─ library/repository.ts  LibraryRepository  → native SQLite (future)
        ├─ playback/adapter.ts    PlaybackAdapter    → Capacitor plugin → Kotlin MediaSessionService + Media3 ExoPlayer (future)
        └─ platform/capabilities  honest capability report
```

- Web preview installs `EmptyLibraryRepository` and `UnavailablePlaybackAdapter`. They return empty data / reject commands; they never simulate playback with browser audio or timers.
- The Android bridge will call `setLibraryRepository` / `setPlaybackAdapter` at startup.
- Discovery: MediaStore scan + Storage Access Framework folder import (Kotlin).
- SQLite is the offline source of truth for tracks, albums, artists, playlists, lyrics, favorites, history, preferences.
- Playback position, queue and state are owned by the native player and pushed to the UI via `subscribe`.
- A future iOS client implements the same two interfaces (AVFoundation / MPNowPlayingInfoCenter).

## Verifiable in browser vs device
- Browser: layout, navigation, accessibility, empty/error states, data-flow wiring.
- Device only: scanning, playback, background audio, notification/lock-screen, Bluetooth/headset controls, SQLite.
