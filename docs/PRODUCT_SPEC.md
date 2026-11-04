# Product Spec — Obsidian

Offline-first local music player, Android first. Plays audio the user owns or is authorized to use.

## Non-goals
- Not a streaming service. No access to, extraction of, or DRM bypass for Spotify or other subscription downloads.
- No automatic upload of audio. No required account or connection.

## Principles
- Embedded tags are the default metadata source; manual edits are tracked per field (`fieldSources`) and never silently overwritten.
- No fake tracks, counts, artists, analytics or playback state. Empty states are deliberate.
- Lyrics are labelled "synced" only when real timestamps are driven by the native playback clock.

## Screens
Home, Library, Songs, Albums, Artists, Playlists, Search, Now Playing (with Lyrics section), Queue, Settings.

## Identity
Obsidian/graphite/silver/platinum; Instrument Serif display, Geist text, Geist Mono for numerals and labels. Dark only.
