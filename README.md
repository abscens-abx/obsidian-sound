# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Android (Capacitor)

Obsidian Sound ships as a Capacitor 8 Android app (`app.obsidiansound.player`). Native source is in `android/`.

Requirements: Node 20+, JDK 21, Android Studio with SDK 36.

```sh
npm install
npm run cap:sync     # SPA build -> dist/capacitor -> android/ (runs build:android + cap sync)
npm run cap:open     # open in Android Studio, then Run or Build > Generate Signed Bundle/APK
```

Implemented: Android shell, runtime detection, on-device SQLite with versioned migrations, read-only SQLite library repository.
Not implemented: music scanning (MediaStore), folder import (SAF), playback (Media3), background/lock-screen/headset controls, lyrics sync. See `docs/`.

Tests: `npm test` (migrations run against a real in-memory SQLite).
