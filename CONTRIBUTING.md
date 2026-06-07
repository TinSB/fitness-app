# Contributing

IronPath is a local-first native iOS SwiftUI training app. The active code surface is `ios/` plus the manifest-registered living docs.

Before changing behavior, read:

- `docs/DOCS_MANIFEST.md`
- `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md`
- `docs/IRONPATH_iOS_SYSTEM_LOGIC.md`
- `AGENTS.md`

## Local Development

Open the app project:

```bash
open ios/IronPath.xcodeproj
```

List schemes:

```bash
xcodebuild -list -project ios/IronPath.xcodeproj
```

Build the app:

```bash
xcodebuild \
  -project ios/IronPath.xcodeproj \
  -scheme IronPath \
  -destination 'generic/platform=iOS Simulator' \
  build
```

Run package tests:

```bash
cd ios/packages/IronPathTrainingDecision
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

1. Keep SwiftUI app-layer code thin; business logic belongs in local Swift packages.
2. Preserve the canonical write path through `CanonicalSessionWriter`.
3. Do not feed raw `AppData` into engines.
4. Do not create a second source of truth.
5. Do not add cloud, auth, networking, WebView, watchOS, CRDT, SQLite, CoreData, SwiftData, remote push, or new persistence mechanisms without an approved Master Architecture amendment.
6. Update affected living docs when behavior, architecture, product direction, or validation changes.
7. Keep changes small and verifiable.

## Documentation

The living-doc registry is `docs/DOCS_MANIFEST.md`. Do not add new top-level Markdown files unless they are first registered there.

Use:

- `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` for architecture contracts.
- `docs/IRONPATH_iOS_SYSTEM_LOGIC.md` for current system logic and product surface responsibilities.
- `docs/IRONPATH_REBUILD_00_IRONRULES_AND_CLOUD.md` and `docs/CLOUD_DECISIONS_ARCHIVE.md` for approved iOS-native account/cloud/sync/CRDT direction.
- `COMMERCIALIZATION_ROADMAP.md` for business sequencing.
- `CHANGELOG.md` for PR-level change records.

## Pull Request Gate

Before a PR is ready:

1. Run the relevant Swift package tests.
2. Run the Xcode build when app wiring, entitlements, HealthKit, notifications, widgets, or project settings changed.
3. Run `git diff --check`.
4. Confirm no old web runtime, Node/Vite command, browser test, or cloud runtime implementation was reintroduced.
