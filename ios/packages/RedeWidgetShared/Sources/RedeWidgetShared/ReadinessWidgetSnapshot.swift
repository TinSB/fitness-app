// ReadinessWidgetSnapshot + codec + shared config — W-1 Readiness Widget V1.
//
// The small DERIVED read-only snapshot the app writes to the App Group container and
// the widget reads. It carries already-formatted plain Strings (headline / advice /
// labeled rows) — NO engine types, NO canonical AppData. It is a presentation record
// (like the LocalSnapshot history, §12): never read back as a source of truth.

import Foundation

/// Shared configuration for the app↔widget App Group container.
public enum WidgetSharedConfig {
    /// The App Group both the app and the widget extension declare in their
    /// entitlements. The shared snapshot file lives in this group's container.
    public static let appGroupIdentifier = "group.com.tinsab.rede"
    /// The derived snapshot filename inside the App Group container.
    public static let snapshotFilename = "readiness-widget-snapshot.json"
}

/// One labeled key/value row carried in the snapshot (e.g. 准备度 / 今日意图).
public struct ReadinessWidgetRow: Codable, Equatable, Sendable {
    public let label: String
    public let value: String
    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }
}

/// The derived readiness snapshot. Open-bag-free, tiny, plain Strings.
public struct ReadinessWidgetSnapshot: Codable, Equatable, Sendable {
    /// Current snapshot schema. A future bump migrates forward; an unknown version
    /// is rejected on decode (honest "no snapshot" rather than a misread).
    public static let currentSchemaVersion = 1

    public let schemaVersion: Int
    public let generatedAtIso: String
    public let headline: String
    public let advice: String
    public let rows: [ReadinessWidgetRow]
    /// 写快照时用户的语言（如 "zh"/"en"）。供 widget 端给**非快照携带**的文案（空态/新鲜度脚注）
    /// 选语言——这些文案在 widget 端合成、不在 headline/advice 里。可选：旧快照无此键 → 解码为 nil
    /// （additive、不 bump schema），widget 退回系统语言。
    public let locale: String?

    public init(
        schemaVersion: Int = ReadinessWidgetSnapshot.currentSchemaVersion,
        generatedAtIso: String,
        headline: String,
        advice: String,
        rows: [ReadinessWidgetRow],
        locale: String? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.generatedAtIso = generatedAtIso
        self.headline = headline
        self.advice = advice
        self.rows = rows
        self.locale = locale
    }
}

/// Errors surfaced when (de)serializing or storing the snapshot.
public enum ReadinessWidgetSnapshotError: Error, Equatable {
    case unsupportedSchemaVersion(Int)
    case appGroupUnavailable
}

/// Pure JSON codec for the snapshot. No IO — the store seam owns the bytes.
public enum ReadinessWidgetSnapshotCodec {
    /// Accepted schema versions on read (only the current one for V1).
    public static let acceptedSchemaVersions: Set<Int> = [1]

    public static func encode(_ snapshot: ReadinessWidgetSnapshot) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(snapshot)
    }

    /// Decode + validate the schema version. Throws `unsupportedSchemaVersion` for an
    /// unknown version so a forward-incompatible file is never misrendered.
    public static func decode(_ data: Data) throws -> ReadinessWidgetSnapshot {
        let snapshot = try JSONDecoder().decode(ReadinessWidgetSnapshot.self, from: data)
        guard acceptedSchemaVersions.contains(snapshot.schemaVersion) else {
            throw ReadinessWidgetSnapshotError.unsupportedSchemaVersion(snapshot.schemaVersion)
        }
        return snapshot
    }
}
