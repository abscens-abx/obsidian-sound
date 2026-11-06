# Listening UX polish — 2026-11-06

## Delivered
- Deliberate Now Playing idle state with an abstract L placeholder, a working Library link, and explicit unavailable playback/lyrics messaging.
- Shared adapter/capability gate for Now Playing and MiniPlayer; no invented metadata, progress or transport controls.
- Removed premature playback, background queue and sync promises from the reviewed screens.
- Added desktop Library navigation, semantic active-page markers, 44px navigation/link targets, safe-area offsets and resilient headings/capability rows.
- Existing tokens only; border geometry replaces gradient artwork placeholders and the mobile header no longer blurs.

## Exact changed files
- `src/routes/now-playing.tsx`
- `src/routes/index.tsx`
- `src/routes/settings.tsx`
- `src/routes/queue.tsx`
- `src/routes/search.tsx`
- `src/components/shell/AppShell.tsx`
- `src/components/shell/MiniPlayer.tsx`
- `src/components/screen/PageHeader.tsx`
- `src/styles.css`
- `src/core/playback/listening-view.ts` (new)
- `src/core/playback/useListeningView.ts` (new)
- `src/test/listening-view.test.ts` (new)
- `AGENTS.md`
- `roadmap.md`
- `docs/LISTENING_UX_VERIFICATION.md` (this report)

Library data queries, native scanners, migrations, capability state mutations and Android identifiers were not changed. No dependencies, playback, auth, cloud or publishing added.

## Checks
- `bunx vitest run`: 28 tests passed across four files; includes four concrete listening-state rules.
- `bun run lint`: one pre-existing `no-control-regex` error in `src/core/scan/normalize.ts:59`, plus seven warnings. Left untouched because native scanner work is explicitly excluded.
- Targeted ESLint on all changed TypeScript/TSX files: passed.
- Automatic production build: `build OK` in `/tmp/observability/build-errors.log`; no manual production build or typecheck was run because the project harness handles these.
- Playwright: Home, Library, Settings and Now Playing reviewed at 1280×1800, 360×800 and 320×740; no horizontal overflow or page errors. Library → Now Playing round trip succeeds via real links; no fake transport buttons. Screenshots inspected.
- Every content route uses `pageHead()` with its own title/description, Open Graph metadata and Twitter card.
- `bunx cap sync android`: blocked because `dist/capacitor` web assets are absent in this sandbox. No updated Android bundle or device verification claimed; the documented `npm run cap:sync` pipeline must run where Android SPA assets can be built.

M3 native verification remains a separate unfinished task; this pass does not begin M4.