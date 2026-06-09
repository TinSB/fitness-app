// AppGroupWidgetSnapshotStore — W-1 Readiness Widget V1.
//
// The real `WidgetSnapshotStore`, reading/writing the derived snapshot JSON inside
// the shared App Group container via Foundation `FileManager`. Used by BOTH the app
// (writes) and the widget extension (reads) — the App Group is the only shared
// surface. Compiled `#if os(iOS)` so the host `swift test` toolchain never builds it
// (the pure codec/mapping carry the unit tests behind the seam, with a fake store).
//
// LOCAL + DERIVED (master §12 as amended by W-1): this is an on-device derived
// presentation record. It NEVER reads/writes canonical AppData and is NEVER a source
// of truth. No network, no cloud, no iCloud/ubiquity — a plain App Group file.

#if os(iOS)
import Foundation

public struct AppGroupWidgetSnapshotStore: WidgetSnapshotStore {
    private let groupIdentifier: String
    private let filename: String

    public init(
        groupIdentifier: String = WidgetSharedConfig.appGroupIdentifier,
        filename: String = WidgetSharedConfig.snapshotFilename
    ) {
        self.groupIdentifier = groupIdentifier
        self.filename = filename
    }

    private var fileURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: groupIdentifier)?
            .appendingPathComponent(filename)
    }

    /// Read + validate the snapshot. Any failure (no container, no file, unreadable,
    /// unknown schema) returns nil → the widget shows the honest placeholder.
    public func read() -> ReadinessWidgetSnapshot? {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else { return nil }
        return try? ReadinessWidgetSnapshotCodec.decode(data)
    }

    /// Atomically write the derived snapshot. Throws if the App Group container is
    /// unavailable or the write fails (no fake success).
    public func write(_ snapshot: ReadinessWidgetSnapshot) throws {
        guard let url = fileURL else { throw ReadinessWidgetSnapshotError.appGroupUnavailable }
        let data = try ReadinessWidgetSnapshotCodec.encode(snapshot)
        try data.write(to: url, options: [.atomic])
    }
}
#endif
