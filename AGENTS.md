<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Native capabilities (library, playback) live behind `src/core` adapter interfaces; never simulate them with browser audio or timers — the web preview is not proof of Android behavior.
- No fixture or fabricated library data in the UI; empty states explain what is missing.
- Screens share `PageHeader`, `EmptyState`, `LibraryCollection`; every route uses `pageHead()` for metadata — keeps visuals and SEO consistent.
- See docs/ARCHITECTURE.md and docs/DECISIONS.md before structural changes.
- Schema changes are new append-only migrations in `src/core/db/migrations.ts`; never edit a shipped one — devices already applied it.
- Manual metadata edits go to `track_field_overrides` / `track_artists.source='manual'`; scanners write only embedded columns, so user corrections survive rescans.
- Native plugins are loaded only via dynamic import after runtime detection, so web/SSR never evaluates them; run `npm run cap:sync` after web changes for the Android app.
- Now Playing and MiniPlayer share the listening-view gate: both adapter availability and successful playback capability are required, so stale state cannot advertise unimplemented playback.
- The M3 bridge cancels provider work by generation plus CancellationSignal; JS abort checks prevent incomplete scans from marking missing tracks, while retriever cancellation waits for the current native call.
- A content URI identifies one track globally and retains its first source owner; rescans from another tree refresh embedded metadata without moving ownership, avoiding duplicate tracks and unsafe source reassignment under schema v2.
