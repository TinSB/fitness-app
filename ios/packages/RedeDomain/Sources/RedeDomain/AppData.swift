// AppData — iOS-2B AppData Swift Models V1.
//
// The top-level Rede data structure. iOS-2B installs the
// schemaVersion guard, the full-tree open-bag carrier (`root`), and
// the canonical re-emit hook. iOS-3 will land the on-disk
// `AppDataStore` protocol and wire decode/encode to the file system.
//
// Design summary (iOS-2A plan §11):
//
// * `schemaVersion` is decoded explicitly so the refusal contract
//   (Agent 5 §3.5) fires at the earliest possible point.
// * The full top-level object — including `schemaVersion` — is held
//   verbatim in `root: OrderedJSONObject`. This preserves all
//   unknown future keys at every nesting level for free, because
//   the carrier never collapses unknown nested objects into typed
//   model values in iOS-2B.
// * `canonicalJSONData()` re-emits via the canonical-stringify path
//   in JSONValue.swift, matching the legacy web schema `stableStringify` rules at
//   `retired web reference`.
//
// What iOS-2B does NOT do:
//
// * No on-disk persistence (iOS-3).
// * No repair / sanitize logic (iOS-3).
// * No engine wiring (iOS-4 / iOS-5).
// * No cloud upload (iOS-7).

import Foundation

public struct AppData: Equatable, Hashable, Sendable {
    /// Validated schema version. Always equals `SchemaVersion.current`
    /// for a successfully-decoded `AppData` — any other value would
    /// have thrown at `init(decoding:)` time.
    public let schemaVersion: SchemaVersion

    /// The full top-level AppData object as parsed from JSON,
    /// including `schemaVersion`. Source of truth for round-trip and
    /// future typed-field promotion.
    public let root: OrderedJSONObject

    public init(schemaVersion: SchemaVersion, root: OrderedJSONObject) {
        self.schemaVersion = schemaVersion
        self.root = root
    }

    /// Parses the given JSON bytes into an `AppData`. Throws
    /// `SchemaVersionError.upgradeRequired` if the payload is older
    /// than `SchemaVersion.current`, or
    /// `SchemaVersionError.futureIncompatible` if it is newer.
    public init(decoding data: Data) throws {
        let parsed = try JSONValue(decoding: data)
        guard case .object(let obj) = parsed else {
            throw JSONValueError.notAnObject
        }
        guard let raw = obj["schemaVersion"] else {
            throw SchemaVersionError.missingOrInvalid
        }
        let found = try AppData.extractInt(from: raw)
        self.schemaVersion = try SchemaVersion.validate(found: found)
        self.root = obj
    }

    /// Emits the canonical-stringified bytes of this AppData, with
    /// every object key lexically sorted. Matches the legacy web schema
    /// `stableStringify` contract used to compute the FNV-1a snapshot
    /// hash at `retired web reference`.
    public func canonicalJSONData() throws -> Data {
        try JSONValue.object(root).canonicalJSONData()
    }

    /// Same as `canonicalJSONData()` but returns a UTF-8 `String`.
    public func canonicalJSONString() throws -> String {
        try String(decoding: canonicalJSONData(), as: UTF8.self)
    }

    /// Extracts a strict-integer value out of a `JSONValue`. Accepts
    /// `.number(.integer)` natively; accepts `.number(.decimal)` only
    /// when the underlying Decimal is whole. Throws on anything else.
    private static func extractInt(from value: JSONValue) throws -> Int {
        switch value {
        case .number(.integer(let i)):
            return Int(i)
        case .number(.decimal(let d)):
            var rounded = Decimal()
            var copy = d
            NSDecimalRound(&rounded, &copy, 0, .down)
            if rounded == d {
                return NSDecimalNumber(decimal: rounded).intValue
            }
            throw SchemaVersionError.missingOrInvalid
        default:
            throw SchemaVersionError.missingOrInvalid
        }
    }
}

// MARK: - iOS-2C — Typed accessors over `root`
//
// These are lazy READ-only views into the full-tree `root` carrier.
// They do NOT mutate `root`; they do NOT affect `canonicalJSONData()`.
// The AppData round-trip hash parity is unaffected.
//
// Failures: any per-element parse error returns `nil` for that entry
// rather than throwing — iOS-3 / iOS-4 callers can compare expected
// vs returned counts to detect malformed entries. The strict-decode
// variant `historyStrict()` is available for tests that want decode
// errors surfaced as exceptions.

extension AppData {
    /// Typed history sessions. Malformed entries are silently skipped;
    /// use `historyStrict()` to surface decode errors.
    public var history: [TrainingSession] {
        guard let arr = root["history"]?.arrayValue else { return [] }
        return arr.compactMap { try? TrainingSession(decoding: $0) }
    }

    public func historyStrict() throws -> [TrainingSession] {
        guard let arr = root["history"]?.arrayValue else { return [] }
        return try arr.map { try TrainingSession(decoding: $0) }
    }

    /// Active session if present and non-null.
    public var activeSession: TrainingSession? {
        guard let v = root["activeSession"], !v.isNull else { return nil }
        return try? TrainingSession(decoding: v)
    }

    /// AppSettings parsed from `root["settings"]`. Returns an empty
    /// `AppSettings()` when the slot is missing.
    public var settings: AppSettings {
        guard let v = root["settings"] else { return AppSettings() }
        return (try? AppSettings(decoding: v)) ?? AppSettings()
    }

    /// HealthMetricSample array. Empty when slot is missing.
    public var healthMetricSamples: [HealthMetricSample] {
        guard let arr = root["healthMetricSamples"]?.arrayValue else { return [] }
        return arr.compactMap { try? HealthMetricSample(decoding: $0) }
    }

    /// AdaptiveCalibrationState if present.
    public var adaptiveCalibration: AdaptiveCalibrationState? {
        guard let v = root["adaptiveCalibration"], !v.isNull else { return nil }
        return try? AdaptiveCalibrationState(decoding: v)
    }

    /// UnitSettings — empty if missing.
    public var unitSettings: UnitSettings {
        guard let v = root["unitSettings"] else { return UnitSettings() }
        return (try? UnitSettings(decoding: v)) ?? UnitSettings()
    }

    /// TodayStatus — empty if missing.
    public var todayStatus: TodayStatus {
        guard let v = root["todayStatus"] else { return TodayStatus() }
        return (try? TodayStatus(decoding: v)) ?? TodayStatus()
    }

    /// ScreeningProfile — empty if missing.
    public var screeningProfile: ScreeningProfile {
        guard let v = root["screeningProfile"] else { return ScreeningProfile() }
        return (try? ScreeningProfile(decoding: v)) ?? ScreeningProfile()
    }

    /// MesocyclePlan — empty if missing.
    public var mesocyclePlan: MesocyclePlan {
        guard let v = root["mesocyclePlan"] else { return MesocyclePlan() }
        return (try? MesocyclePlan(decoding: v)) ?? MesocyclePlan()
    }

    /// ProgramTemplate — empty if missing.
    public var programTemplate: ProgramTemplate {
        guard let v = root["programTemplate"] else { return ProgramTemplate() }
        return (try? ProgramTemplate(decoding: v)) ?? ProgramTemplate()
    }

    /// UserProfile — empty if missing.
    public var userProfile: UserProfile {
        guard let v = root["userProfile"] else { return UserProfile() }
        return (try? UserProfile(decoding: v)) ?? UserProfile()
    }
}
