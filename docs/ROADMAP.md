# Roadmap

- [x] M0/1 — Foundation: design tokens, responsive shell (sidebar / bottom nav + mini player), all screens with honest empty states, typed adapter boundaries, docs.
- [x] M2 — Capacitor 8 Android project, runtime detection, truthful capability state, SQLite schema v1 + migrations + read-only repository.
  - Not yet verified on a device/emulator; no APK/AAB built (no JDK/Android SDK in the build environment).
  - Next: build in Android Studio, confirm "Offline library database: Available" in Settings on a device.
- [ ] M3 — MediaStore scan + SAF folder import; tag reading; library lists populated.
- [ ] M4 — Media3 playback via MediaSessionService: queue, shuffle/repeat, background, notification, lock-screen, headset.
- [ ] M5 — Favorites, playlists CRUD, playback history.
- [ ] M6 — Metadata editing with provenance; multiple artist credits; discographies.
- [ ] M7 — Lyrics: manual/static, LRC import/export, line then word sync, offset adjustment.
- [ ] Later — automatic lyric recognition; optional opt-in cloud sync; iOS client.
