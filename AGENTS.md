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
