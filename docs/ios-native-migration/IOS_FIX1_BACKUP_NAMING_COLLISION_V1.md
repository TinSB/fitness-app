# FIX-1 — Backup-filename same-second collision fix (V1)

**Status:** implemented.
**Scope:** a bounded robustness fix to the canonical store's
`JSONFileAppDataStore.backup()`. **Not** a write-boundary change, **not** a
restore, **not** a schema change. Device-local.
**Contract:** amends §8.1 / §9 / §27 of
`docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` (the binding contract).
Allowed-change patterns §19.4 (tests) + §19.6 (refactor within a boundary —
the public `backup() -> URL` contract is unchanged).

## The bug (surfaced during SR-4 integration)

The canonical-AppData store backs up the prior file **before** every sanctioned
overwrite (`performGatedMutation` step 4 → `store.backup()` →
`CanonicalSessionWriter.swift`). The backup filename was built from a
**second-level** ISO-8601 timestamp:

```swift
stampFormatter.formatOptions = [.withInternetDateTime]      // e.g. 2026-06-01T12:34:56Z
let stamp = …replacingOccurrences(of: ":", with: "-")      // → 2026-06-01T12-34-56Z
let backupURL = …appendingPathComponent("\(name).backup-\(stamp)")
```

Two sanctioned writes **in the same second** therefore resolved to the **same**
`…backup-<stamp>` name, and `FileManager.copyItem(at:to:)` throws when the
destination already exists. The write path translated that into
`AppDataStoreError.backupFailed` → `CanonicalSessionWriteError.backupFailed`, so
the **whole gated write failed**.

This was an **honest failure with no data corruption** (backup-before-overwrite
held; nothing was reported as saved that was not) — but it was a **false**
failure: nothing was actually wrong, and it could affect **every** write path
(append / HealthKit import / EDIT-1…4 / DEEP-EDIT-1 / SR-4) under rapid
successive writes.

## The fix

`JSONFileAppDataStore.backup()` only — the orchestration, `store.save`, and the
backup-before-overwrite ordering are untouched.

1. **Millisecond precision.** The stamp gains `.withFractionalSeconds`
   (`2026-06-01T12-34-56.789Z`, still valid ISO-8601), so distinct instants get
   distinct names without any probing in the common case.
2. **Uniqueness backstop.** Because a clock's resolution is finite (two writes
   *can* still resolve to the same instant), the destination is probed for the
   first free sibling, appending a monotonic `-2 / -3 …` suffix until a
   non-existent path is found. This **guarantees** uniqueness regardless of
   clock resolution — covering the same-second *and* same-millisecond cases the
   requirement calls out.

```swift
stampFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
…
let base = "\(url.lastPathComponent).backup-\(stamp)"
var backupURL = directory.appendingPathComponent(base, isDirectory: false)
var disambiguator = 2
while FileManager.default.fileExists(atPath: backupURL.path) {
    backupURL = directory.appendingPathComponent("\(base)-\(disambiguator)", isDirectory: false)
    disambiguator += 1
}
// copyItem then runs against a guaranteed-free path; a GENUINE failure still throws.
```

## Invariants preserved (hard red lines)

- **No orchestration change.** `performGatedMutation` is untouched; there is
  still **exactly one** `store.save` call. The single sanctioned write path is
  intact.
- **Backup-before-overwrite.** The timestamped copy is still taken **before**
  the atomic save and remains the rollback source.
- **Atomic write + honest failure.** Only the same-second **false**
  `.backupFailed` is removed. A **genuine** backup failure (e.g. an unwritable
  directory) still throws `.backupFailed` — the existence probe never invents a
  free name that `copyItem` then fails to write, so there is **no fake success**.
- **No data-model change.** No `AppData` / `schemaVersion` change (no bump), no
  `IronPathDomain` change, no engine change, no goldens touched. The backup
  *filename* is a persistence-layer artifact — `AppData`'s own ISO-8601
  timestamp encoding (§9 invariant 4) is unchanged.
- **No deps / project change.** `project.pbxproj`, `package.json`, lockfiles,
  and `Package.swift` are byte-unchanged.

## Tests (added to `JSONFileAppDataStoreTests`)

- `testConsecutiveSameSecondBackupsAllSucceedWithDistinctNames` — four
  back-to-back `backup()` calls (same second) all succeed and produce four
  **distinct** sibling files on disk, each keeping the `…primary.json.backup-`
  prefix. On the pre-fix code the second iteration threw `.backupFailed`.
- `testGenuineBackupFailureOnUnwritableDirectoryStillThrowsHonestly` — with the
  source present but its directory read-only, `backup()` still throws
  `.backupFailed` (no fake success). Skips honestly when the runtime can bypass
  POSIX permissions (e.g. running as root).
- Existing `testBackupCreatesSiblingFile` / `testBackupOnMissingPrimaryThrowsBackupFailed`
  continue to pass unchanged (the `.backup-` prefix and the no-source honest
  failure are preserved).

## Validation

- `swift test --package-path ios/packages/IronPathPersistence` (new collision
  cases + existing suite).
- `npx vitest run tests/ios` (the iOS static guards, incl. the single-`save` /
  write-path guards — unchanged).
- `xcodebuild … -scheme IronPath … build`.
- Parity goldens: zero drift (`git diff -- tests/fixtures/parity/golden/` empty).
