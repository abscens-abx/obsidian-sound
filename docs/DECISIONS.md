# Decisions

1. **Dark-only theme.** The identity is obsidian; no light mode toggle.
2. **Adapters, not browser fakes.** Native features sit behind `LibraryRepository` / `PlaybackAdapter`; preview implementations are empty/unavailable.
3. **No disabled "Import" button.** Empty states explain that import needs the Android app instead of showing a control that does nothing.
4. **Mini player always visible**, showing "Nothing playing" with no transport controls when idle.
5. **Mobile nav = Home, Search, Library, Settings**; Songs/Albums/Artists/Playlists/Queue are reached via Library. Desktop shows all in the sidebar.
6. **No cloud in M0/1.** No auth, DB or external services provisioned.

7. **Capacitor 8 + @capacitor-community/sqlite 8.** Maintained, peer-compatible with Capacitor 8; no other plugins.
8. **Own migration runner** instead of the plugin's upgrade API, so the same versioned SQL is tested on desktop (`node:sqlite`) and run on device.
9. **SPA build only for the device.** Web hosting keeps SSR; `CAPACITOR_BUILD=1` produces the static shell.
10. **Manual edits stored separately** from embedded tags so rescans can never overwrite them.
11. **Capabilities flip only on success** of their own implementation; the Android shell alone enables nothing.

## Assumptions
- Working name "Obsidian" — placeholder brand, replace before distribution.
- Fonts load from Google Fonts in the preview; the Android build should bundle them locally for full offline use.
- Polymorphic `favorites` rows are validated in the repository, not by foreign keys.
