# IronPath

IronPath is a local-first training system built with React, Vite, and TypeScript. It focuses on hypertrophy training with posture correction, functional add-ons, weekly volume budgeting, readiness, deload signals, support exercise logs, and planned-vs-actual adherence review.

## Install

```bash
npm install
```

## Develop

```bash
npm run dev
```

Default local URL:

```text
http://127.0.0.1:3000/
```

If that port is already in use, Vite will show the next available local URL.

## Test And Build

```bash
npm run typecheck
npm test
npm run build
```

## iPhone Safari

IronPath includes a basic PWA manifest and app-shell service worker. To use it like an app on iPhone:

1. Open IronPath in Safari.
2. Tap the Safari share button.
3. Choose Add to Home Screen.
4. Launch IronPath from the Home Screen icon.

The app uses a timestamp-based rest timer. If Safari is backgrounded or the phone is locked, the timer calculates the remaining time from `startedAt` and `durationSec` when you return. It does not send native push notifications.

## Training On Mobile

TrainingView includes a mobile-first Focus Mode. On small screens it opens by default during an active session. It shows the current exercise, current set, target load/reps/RIR, last record, strategy, large one-hand buttons, pain flag, technique quality, replacement, skip controls, and rest countdown.

The full desktop TrainingView remains available for detailed editing and review.

## Data Storage

Training data is stored locally in browser `localStorage` using split keys. The data model has `schemaVersion`, migration, sanitization, and AppData schema validation. Active sessions are saved after set completion, support log updates, pain flags, technique quality changes, and timer updates.

If you refresh Safari during a workout, unfinished `activeSession` is restored and the app offers to continue the session. Completed active sessions are not restored as in-progress workouts.

## Backup And Restore

Open Progress, then use Data Backup / Restore:

- Export full backup downloads `ironpath-backup-YYYY-MM-DD.json`.
- Import backup reads a JSON file, migrates old schema versions, validates the result, and only replaces current data after confirmation.
- Invalid JSON or invalid app data will not overwrite current training data.

## Delivery Notes

Do not package these folders:

- `node_modules`
- `dist`
- `.vite`
- `.vitest`
- `coverage`
- logs and `*.log`

Keep source files, `package.json`, `package-lock.json`, `index.html`, `vite.config.js`, and `public` PWA assets.

## Current PWA Limits

- iOS Safari requires manual Add to Home Screen.
- Rest timing is timestamp-recovered, not native notification-based.
- Data is local by default, so export backups regularly.
