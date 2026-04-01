# Music Player (Expo / React Native)
An Expo React Native music player with queue playback, album/playlist context, shuffle + auto-repeat, and offline downloads.

## Features
- **Search** songs/albums/playlists (Saavn API integration).
- **Player + mini-player** with progress, prev/next, and queue view.
- **Shuffle (album/playlist only)**: toggle shuffle on/off and restore original ordering.
- **Auto (repeat)**:
  - For album/playlist: restart from beginning when the last track ends (reshuffles if shuffle is on).
  - For ad-hoc queue: loops back to the track that was playing when Auto was enabled.
- **Offline downloads**:
  - Download/remove per track (search, album, playlist, downloads list).
  - Playback prefers local `file://` audio when downloaded; otherwise streams.

## Tech stack
- **Expo SDK 54** + **React Native 0.81**
- **TypeScript**
- **expo-av** for audio playback
- **expo-file-system** (legacy API) for offline downloads
- **Zustand** for app state
- **React Navigation** for screens

## Setup
### Prerequisites
- Node.js + npm
- Xcode (iOS) or Android Studio + Android SDK (Android)

### Install
```bash
npm install
```

### Run (development)
```bash
npx expo start
```

## Build Android APK (Android Studio / Gradle)
This project uses Expo prebuild to generate native Android files.

1. Generate `android/` (one-time, or after native config changes):
```bash
npx expo prebuild --platform android
```

2. Build a release APK:
```bash
cd android
./gradlew assembleRelease
```

APK output:
`android/app/build/outputs/apk/release/app-release.apk`

> Note: the default prebuild config signs release with the **debug keystore** (fine for local installs/testing). For Play Store you’ll want to configure a real release keystore.

## Architecture
### Playback flow
- `App.tsx` mounts `PlaybackController` globally so playback continues across screens.
- `src/components/PlaybackController.tsx`
  - Loads audio with `expo-av`.
  - Tracks playback progress in the player store.
  - Handles end-of-track: next track, auto-repeat restart (album/playlist), or auto loop (ad-hoc queue).
  - Uses `src/audio/getPlayableUri.ts` to choose **local downloaded audio** when available.

### State management
- `src/store/playerStore.ts` (Zustand)
  - Queue state: `queue`, `currentSong`, `currentIndex`, `sound`, progress.
  - Context-aware playback:
    - `playbackContext` tracks the **album/playlist originalSongs** so shuffle can be toggled reliably.
    - `shuffleEnabled` is only meaningful with a playbackContext.
  - Auto-repeat:
    - `autoPlayEnabled` enables repeat behavior.
    - `autoQueueSnapshot` + `autoQueueAnchorIndex` capture the ad-hoc queue state when Auto is enabled.
  - `suppressNextAudioReload` prevents restarting the current track when shuffle toggles and the song stays the same.

- `src/store/downloadsStore.ts` (Zustand + persist)
  - Persistent map of downloaded tracks (`entries`) and transient download progress/errors.
  - Stores audio under `documentDirectory/offline/audio/` and optional artwork under `documentDirectory/offline/covers/`.

### Screens
- `src/screens/HomeScreen.tsx`: search + browse, downloads entry card.
- `src/screens/AlbumScreen.tsx` / `src/screens/PlaylistScreen.tsx`: play/shuffle controls and per-track download actions.
- `src/screens/PlayerScreen.tsx`: full player with Auto and Shuffle (when context exists).
- `src/screens/QueueScreen.tsx`: queue reorder/remove.
- `src/screens/DownloadsScreen.tsx`: list of downloaded tracks (play, queue, remove).

## Trade-offs / design notes
- **Shuffle is limited to album/playlist** to avoid surprising behavior on arbitrary “mixed queues”.
- **Auto-repeat for ad-hoc queues** uses a snapshot of the queue at the time Auto is enabled because `nextSong` removes played tracks.
- **Offline downloads use `expo-file-system/legacy`**:
  - Works well on device builds; simpler than introducing custom native networking.
  - Requires the **legacy** API because the new API surfaces different types and legacy functions throw if imported from the non-legacy entrypoint.
- **Downloads persistence** stores only the manifest; the actual files live in app storage. If files are deleted by the OS/user, playback falls back to streaming.

## Project structure (high level)
```text
src/
  api/                  # Saavn API client
  audio/                # audio helpers (playable URI resolution, audio mode)
  components/            # UI components + PlaybackController
  navigation/            # React Navigation stack + root ref
  offline/               # offline storage paths
  screens/               # app screens
  store/                 # Zustand stores (player + downloads)
```
