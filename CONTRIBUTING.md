# Contributing

Rede is a local-first native iOS SwiftUI training product under a clean rewrite baseline. The active truth is the manifest-registered living docs. Existing `ios/` code is legacy/reference inventory until a rewrite slice explicitly approves reuse.

Before changing behavior, read:

- `docs/DOCS_MANIFEST.md`
- `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md`
- `docs/REDE_iOS_SYSTEM_LOGIC.md`
- `AGENTS.md`

## Clean Rewrite Workflow

Start from the living docs, not from the legacy runtime. Docs/spec-only changes should be validated with:

```bash
git diff --check
```

When a clean runtime slice exists, run the smallest real verification for that slice. The existing Xcode project may still be inspected as legacy reference:

```bash
open ios/Rede.xcodeproj
```

List legacy schemes:

```bash
xcodebuild -list -project ios/Rede.xcodeproj
```

Build the legacy reference:

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
2. Treat old `ios/` behavior as reference-only unless a rewrite slice approves reuse.
3. Keep SwiftUI app-layer code thin; business logic belongs in local Swift packages.
4. Preserve a canonical gated write path; old `CanonicalSessionWriter` is a reference contract, not a mandatory old implementation.
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
