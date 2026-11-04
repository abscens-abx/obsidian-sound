# Decisions

1. **Dark-only theme.** The identity is obsidian; no light mode toggle.
2. **Adapters, not browser fakes.** Native features sit behind `LibraryRepository` / `PlaybackAdapter`; preview implementations are empty/unavailable.
3. **No disabled "Import" button.** Empty states explain that import needs the Android app instead of showing a control that does nothing.
4. **Mini player always visible**, showing "Nothing playing" with no transport controls when idle.
5. **Mobile nav = Home, Search, Library, Settings**; Songs/Albums/Artists/Playlists/Queue are reached via Library. Desktop shows all in the sidebar.
6. **No cloud in M0/1.** No auth, DB or external services provisioned.

## Assumptions
- Working name "Obsidian" — placeholder brand, replace before distribution.
- Fonts load from Google Fonts in the preview; the Android build should bundle them locally for full offline use.
