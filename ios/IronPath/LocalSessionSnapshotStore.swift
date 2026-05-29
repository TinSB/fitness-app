// LocalSessionSnapshotStore — iOS-9 Local JSON Persistence + Saved Session
// History V1.
//
// The ONLY disk-touching file in the iOS app target. It is the sanctioned,
// app-local JSON store for completed Focus sessions. Everything it does stays
// inside one directory under the app sandbox's Application Support:
//
//   <Application Support>/IronPathLocalSnapshots/
//     focus-session-0001-normal.json   ← append-only history entries
//     focus-session-0002-deloadWeek.json
//     focus-session-latest.json         ← rolling "latest" pointer (overwritten)
//     focus-session-latest.json.bak      ← backup taken BEFORE each overwrite
//
// Hard local-only boundary (enforced by iosLocalJsonPersistenceStaticGuards):
//   • NO iCloud / CloudKit / ubiquity container, NO IronPathCloudSync.
//   • NO HealthKit, NO Supabase, NO URLSession / network, NO WebKit.
//   • NO UserDefaults, NO SQLite / CoreData / SwiftData.
//   • NO IronPathDomain AppData read/write — this never touches the canonical
//     domain store; it is a small presentation-layer record only.
//
// Safety contract:
//   • Atomic write: Data.write(.atomic) renames a temp sibling into place, so a
//     mid-write crash leaves the prior file intact.
//   • Backup-before-overwrite: the rolling latest pointer is copied to a `.bak`
//     sibling BEFORE it is overwritten — a bad new write can't destroy the last
//     good latest. History entries are append-only (a fresh sequence number per
//     save) and are never overwritten in the normal flow.
//   • No fake success: every mutating call THROWS a LocalSnapshotStoreError on
//     failure. Callers must treat a thrown error as "not saved".
//   • Scoped delete: clear() only removes regular files directly inside the
//     sanctioned directory whose names carry this store's own prefix. It never
//     deletes the directory, never recurses, never touches anything else.

import Foundation

/// Errors surfaced to the caller. Mutating operations throw these instead of
/// silently failing, so the UI can show an honest error and keep the in-memory
/// preview usable.
enum LocalSnapshotStoreError: Error, LocalizedError, Equatable {
    case directoryUnavailable(String)
    case encodeFailed(String)
    case writeFailed(String)
    case backupFailed(String)
    case readFailed(String)
    case decodeFailed(String)
    case clearFailed(String)

    var errorDescription: String? {
        switch self {
        case .directoryUnavailable: return "无法定位本机保存目录"
        case .encodeFailed: return "无法编码训练快照"
        case .writeFailed: return "写入本机快照失败"
        case .backupFailed: return "覆盖前备份失败"
        case .readFailed: return "读取本机快照失败"
        case .decodeFailed: return "解析本机快照失败"
        case .clearFailed: return "清除本机快照失败"
        }
    }
}

/// App-local JSON snapshot store. Inject a `directory` (e.g. a temp dir) for a
/// preview/test; the app uses the default Application Support location.
struct LocalSessionSnapshotStore {

    // MARK: - Naming policy (all derived from this single prefix)

    static let directoryName = "IronPathLocalSnapshots"
    /// Every file this store owns starts with this prefix. clear() and the
    /// history listing are both scoped by it.
    static let filePrefix = "focus-session-"
    static let latestFilename = "focus-session-latest.json"
    static let latestBackupFilename = "focus-session-latest.json.bak"

    /// When non-nil, all IO happens here (injected for previews/tests). When
    /// nil, the store resolves the app-local Application Support subdirectory.
    let explicitDirectory: URL?

    init(directory: URL? = nil) {
        self.explicitDirectory = directory
    }

    // MARK: - Directory resolution (app-local only)

    /// Resolve (and create) the sanctioned snapshots directory. Uses the app
    /// sandbox's Application Support — NOT iCloud, NOT a shared container.
    private func resolveDirectory() throws -> URL {
        if let explicitDirectory {
            try ensureDirectory(explicitDirectory)
            return explicitDirectory
        }
        let base: URL
        do {
            base = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
        } catch {
            throw LocalSnapshotStoreError.directoryUnavailable("\(error)")
        }
        let dir = base.appendingPathComponent(Self.directoryName, isDirectory: true)
        try ensureDirectory(dir)
        return dir
    }

    private func ensureDirectory(_ dir: URL) throws {
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            throw LocalSnapshotStoreError.directoryUnavailable("\(error)")
        }
    }

    private static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }

    private static func makeDecoder() -> JSONDecoder { JSONDecoder() }

    // MARK: - Save (append history + rolling latest with backup-before-overwrite)

    /// Persist a completed-session snapshot. Writes a new append-only history
    /// file, then refreshes the rolling latest pointer (backing the old one up
    /// first). Returns the history file URL. THROWS on any failure — a thrown
    /// error means nothing was reported as saved.
    @discardableResult
    func save(_ snapshot: LocalCompletedSessionSnapshot) throws -> URL {
        let dir = try resolveDirectory()

        let data: Data
        do {
            data = try Self.makeEncoder().encode(snapshot)
        } catch {
            throw LocalSnapshotStoreError.encodeFailed("\(error)")
        }

        // 1) Append-only history entry under a fresh sequence number.
        let seq = try nextSequence(in: dir)
        let historyURL = dir.appendingPathComponent(
            historyFilename(seq: seq, scenarioId: snapshot.scenarioId),
            isDirectory: false
        )
        do {
            try data.write(to: historyURL, options: [.atomic])
        } catch {
            throw LocalSnapshotStoreError.writeFailed("\(error)")
        }

        // 2) Backup-before-overwrite the rolling latest pointer.
        let latestURL = dir.appendingPathComponent(Self.latestFilename, isDirectory: false)
        if FileManager.default.fileExists(atPath: latestURL.path) {
            let backupURL = dir.appendingPathComponent(Self.latestBackupFilename, isDirectory: false)
            do {
                if FileManager.default.fileExists(atPath: backupURL.path) {
                    try FileManager.default.removeItem(at: backupURL)
                }
                try FileManager.default.copyItem(at: latestURL, to: backupURL)
            } catch {
                throw LocalSnapshotStoreError.backupFailed("\(error)")
            }
        }

        // 3) Overwrite the latest pointer atomically.
        do {
            try data.write(to: latestURL, options: [.atomic])
        } catch {
            throw LocalSnapshotStoreError.writeFailed("\(error)")
        }

        return historyURL
    }

    // MARK: - Load latest

    /// Load the most-recently-saved snapshot, or nil if none exists yet.
    /// Prefers the rolling latest pointer; falls back to the highest-sequence
    /// history file. THROWS only on a genuine read/decode failure.
    func loadLatest() throws -> LocalCompletedSessionSnapshot? {
        let dir = try resolveDirectory()
        let latestURL = dir.appendingPathComponent(Self.latestFilename, isDirectory: false)
        if FileManager.default.fileExists(atPath: latestURL.path) {
            return try decode(at: latestURL)
        }
        // Fallback: newest history entry.
        return try listSnapshots().first
    }

    // MARK: - List history

    /// All saved history snapshots, newest first. Files that fail to decode are
    /// skipped (a single corrupt file must not hide the rest). Missing directory
    /// yields an empty list (not an error).
    func listSnapshots() throws -> [LocalCompletedSessionSnapshot] {
        let dir = try resolveDirectory()
        let names = try historyFilenames(in: dir)
        // Sort by sequence descending (newest save first).
        let sorted = names.sorted { lhs, rhs in
            (sequence(of: lhs) ?? -1) > (sequence(of: rhs) ?? -1)
        }
        var out: [LocalCompletedSessionSnapshot] = []
        for name in sorted {
            let url = dir.appendingPathComponent(name, isDirectory: false)
            if let snapshot = try? decode(at: url) {
                out.append(snapshot)
            }
        }
        return out
    }

    // MARK: - Clear (scoped to this store's own files only)

    /// Delete only the regular files directly inside the sanctioned directory
    /// whose names carry this store's prefix (history + latest pointer + its
    /// backup). Never deletes the directory, never recurses, never touches
    /// unrelated files. Returns the number of files removed.
    @discardableResult
    func clear() throws -> Int {
        let dir = try resolveDirectory()
        let contents: [URL]
        do {
            contents = try FileManager.default.contentsOfDirectory(
                at: dir,
                includingPropertiesForKeys: [.isRegularFileKey],
                options: [.skipsHiddenFiles]
            )
        } catch {
            // Nothing to clear if the directory can't be enumerated; treat a
            // missing directory as already-clear rather than an error.
            return 0
        }
        var removed = 0
        for url in contents {
            let name = url.lastPathComponent
            guard name.hasPrefix(Self.filePrefix) else { continue }
            let isRegular = (try? url.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile ?? false
            guard isRegular else { continue }
            do {
                try FileManager.default.removeItem(at: url)
                removed += 1
            } catch {
                throw LocalSnapshotStoreError.clearFailed("\(error)")
            }
        }
        return removed
    }

    // MARK: - Helpers

    private func decode(at url: URL) throws -> LocalCompletedSessionSnapshot {
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            throw LocalSnapshotStoreError.readFailed("\(error)")
        }
        do {
            return try Self.makeDecoder().decode(LocalCompletedSessionSnapshot.self, from: data)
        } catch {
            throw LocalSnapshotStoreError.decodeFailed("\(error)")
        }
    }

    /// History filenames only (exclude the latest pointer + its backup).
    private func historyFilenames(in dir: URL) throws -> [String] {
        let contents: [URL]
        do {
            contents = try FileManager.default.contentsOfDirectory(
                at: dir,
                includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]
            )
        } catch {
            return []
        }
        return contents
            .map { $0.lastPathComponent }
            .filter { isHistoryFilename($0) }
    }

    /// True only for `focus-session-<digits>-...json` (history entries).
    private func isHistoryFilename(_ name: String) -> Bool {
        sequence(of: name) != nil
    }

    /// Parse the sequence number out of a `focus-session-<seq>-<scenario>.json`
    /// filename. Returns nil for the latest pointer / backup / foreign files.
    private func sequence(of name: String) -> Int? {
        guard name.hasPrefix(Self.filePrefix), name.hasSuffix(".json") else { return nil }
        let rest = name.dropFirst(Self.filePrefix.count)
        guard let dash = rest.firstIndex(of: "-") else { return nil }
        let digits = rest[rest.startIndex..<dash]
        guard !digits.isEmpty, digits.allSatisfy(\.isNumber) else { return nil }
        return Int(digits)
    }

    /// Next monotonic sequence = (max existing) + 1, starting at 1.
    private func nextSequence(in dir: URL) throws -> Int {
        let maxSeq = try historyFilenames(in: dir).compactMap { sequence(of: $0) }.max() ?? 0
        return maxSeq + 1
    }

    private func historyFilename(seq: Int, scenarioId: String) -> String {
        let safeScenario = sanitize(scenarioId)
        let padded = String(format: "%04d", seq)
        return "\(Self.filePrefix)\(padded)-\(safeScenario).json"
    }

    /// Keep only filename-safe characters so an unexpected scenario id can never
    /// escape the sanctioned directory.
    private func sanitize(_ raw: String) -> String {
        let allowed = raw.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) }
        let cleaned = String(String.UnicodeScalarView(allowed))
        return cleaned.isEmpty ? "session" : cleaned
    }
}
