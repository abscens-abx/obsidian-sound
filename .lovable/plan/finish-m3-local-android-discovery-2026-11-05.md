# Finish M3: local Android discovery

- Add and register the Kotlin Capacitor library plugin: user-triggered audio permission, paged MediaStore queries, local metadata reading, persisted SAF folder selection and bounded tree traversal.
- Harden existing scan orchestration so incomplete, unreadable, cancelled or failed scans never hide tracks; retain idempotent SQLite writes, manual edits and playlist/history references without changing migrations v1/v2.
- Keep native availability conditional on successful operations and leave the browser preview unavailable. Preserve the UI, LAWLIET/L branding and product attribution; keep Android identifiers unchanged.
- Add TypeScript/SQLite regression tests and practical pure Kotlin tests. Update project documentation and architecture rules.

## Verification
Run all existing and new tests and lint; inspect automatic web build/type results. Sync Capacitor if an existing Android web bundle is available without manually rebuilding the Lovable app. Compile Android only if JDK 21 and SDK 36 are available. Clearly separate source implementation from device-only verification; do not start M4 or publish.