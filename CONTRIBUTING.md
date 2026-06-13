# Contributing

Rede is a local-first native iOS SwiftUI training product. The source of truth is the manifest-registered living docs; the clean iOS app under `ios/` is the active implementation that realizes them (MVP loop shipped through M0–M6, only M6-4 TestFlight upload remains). The original IronPath/PWA-era packages were retired during M1-0; do not revive them or any removed PWA/cloud runtime.

Before changing behavior, read:

- `docs/DOCS_MANIFEST.md`
- `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md`
- `docs/REDE_iOS_SYSTEM_LOGIC.md`
- `AGENTS.md`

## Workflow

The living docs define the design truth; the clean iOS app realizes it. Docs/spec-only changes should be validated with:

```bash
git diff --check
```

For a runtime slice, run the smallest real verification for that slice. Open the active Xcode project:

```bash
open ios/Rede.xcodeproj
```

List schemes:

```bash
xcodebuild -list -project ios/Rede.xcodeproj
```

Build the app:

```bash
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination 'generic/platform=iOS Simulator' \
  build
```

Run package tests when a runtime slice touches a package:

```bash
cd ios/packages/RedeTrainingDecision
swift test
```

Run all package tests:

```bash
for package in ios/packages/*; do
  if [ -f "$package/Package.swift" ]; then
    (cd "$package" && swift test) || exit 1
  fi
done
```

## Change Rules

1. Preserve approved product/system logic unless the living docs are explicitly amended.
2. Treat retired IronPath/PWA-era code as reference-only; reuse it only through an approved rewrite slice.
3. Keep SwiftUI app-layer code thin; business logic belongs in local Swift packages.
4. All canonical writes must go through the implemented gated writer (`RedePersistence.CanonicalSessionWriter`: load → candidate → DataHealth gate → backup → atomic save → honest failure).
5. Do not feed raw `AppData` into engines.
6. Do not create a second source of truth.
7. Do not add cloud, auth, networking, WebView, watchOS, CRDT, SQLite, CoreData, SwiftData, remote push, or new persistence mechanisms without an approved Master Architecture amendment.
8. Update affected living docs when behavior, architecture, product direction, or validation changes.
9. Keep changes small and verifiable.

## Documentation

The living-doc registry is `docs/DOCS_MANIFEST.md`. Do not add new top-level Markdown files unless they are first registered there.

Use:

- `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md` for architecture contracts.
- `docs/REDE_iOS_SYSTEM_LOGIC.md` for clean rewrite system logic and product surface responsibilities.
- `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` and `docs/CLOUD_DECISIONS_ARCHIVE.md` for approved iOS-native account/cloud/sync/CRDT direction.
- `COMMERCIALIZATION_ROADMAP.md` for business sequencing.
- `CHANGELOG.md` for PR-level change records.

## Pull Request Gate

Before a PR is ready:

1. Run `git diff --check`.
2. Run the relevant Swift package tests when runtime package code changed.
3. Run the Xcode build when clean app wiring, entitlements, HealthKit, notifications, widgets, or project settings changed.
4. Confirm no old web runtime, Node/Vite command, browser test, or cloud runtime implementation was reintroduced.
