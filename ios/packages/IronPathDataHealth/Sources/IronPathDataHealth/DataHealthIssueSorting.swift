// DataHealthIssueSorting — CC-0 coach-action capstone foundation (1/3).
//
// Faithful line-by-line Swift port of the PURE `sortDataHealthIssues` from
// `src/engines/dataHealthEngine.ts:41` plus the three type families it reads:
// `DataHealthSeverity` (ts:8), `DataHealthIssue` (ts:10), `DataHealthReport`
// (ts:29) and the private `dataHealthSeverityRank` map (ts:35). These are the
// `coachActionEngine` foundation deps (`import { sortDataHealthIssues, type
// DataHealthIssue, type DataHealthReport } from './dataHealthEngine'`,
// coachActionEngine.ts:4) — CC-0 ports ONLY this self-contained sort + its types;
// the rest of `dataHealthEngine` (buildDataHealthReport et al.) and the
// coachAction engine itself are later tracks.
//
// PURE / READ-ONLY: `sortDataHealthIssues` is a stable sort over a copy of the
// input — severity DESC (error > warning > info) then `title` ASC via
// `localeCompare(_, 'zh-CN')`. Zero `: Date`, no IO, no randomness, no write
// path, no engine dependencies (the `dataHealthEngine.ts` module imports —
// trainingData / training-model / engineUtils / replacementEngine /
// sessionDetailSummaryEngine / unitConversionEngine — are used by OTHER
// functions in that file, never by the sort or these types). NOT wired into any
// UI.

import Foundation
import IronPathDomain

/// Errors raised while decoding a DataHealth golden shape.
public enum DataHealthDecodeError: Error, Equatable, Sendable {
    case notAnObject(context: String)
    case missingKey(String, context: String)
    case invalidEnum(String, value: String, context: String)
}

/// `DataHealthSeverity` (dataHealthEngine.ts:8).
public enum DataHealthSeverity: String, Equatable, Hashable, Sendable, CaseIterable {
    case info
    case warning
    case error
}

/// The closed `category` union on `DataHealthIssue` (dataHealthEngine.ts:13-21).
/// Raw values mirror the TS string literals VERBATIM (note `healthData`
/// camelCase among otherwise lower-case tokens).
public enum DataHealthCategory: String, Equatable, Hashable, Sendable, CaseIterable {
    case replacement
    case unit
    case history
    case summary
    case analytics
    case healthData
    case template
    case unknown
}

/// `DataHealthIssue` (dataHealthEngine.ts:10). `affectedIds` / `suggestedAction`
/// are the only optional fields (TS `?`); everything else is required.
public struct DataHealthIssue: Equatable, Hashable, Sendable {
    public let id: String
    public let severity: DataHealthSeverity
    public let category: DataHealthCategory
    public let title: String
    public let message: String
    public let affectedIds: [String]?
    public let canAutoFix: Bool
    public let suggestedAction: String?

    public init(
        id: String,
        severity: DataHealthSeverity,
        category: DataHealthCategory,
        title: String,
        message: String,
        affectedIds: [String]? = nil,
        canAutoFix: Bool,
        suggestedAction: String? = nil
    ) {
        self.id = id
        self.severity = severity
        self.category = category
        self.title = title
        self.message = message
        self.affectedIds = affectedIds
        self.canAutoFix = canAutoFix
        self.suggestedAction = suggestedAction
    }

    public init(decoding value: JSONValue, context: String = "DataHealthIssue") throws {
        guard let obj = value.objectValue else {
            throw DataHealthDecodeError.notAnObject(context: context)
        }
        self.id = try DataHealthDecode.requireString(obj, "id", context)
        self.severity = try DataHealthDecode.requireEnum(obj, "severity", DataHealthSeverity.self, context)
        self.category = try DataHealthDecode.requireEnum(obj, "category", DataHealthCategory.self, context)
        self.title = try DataHealthDecode.requireString(obj, "title", context)
        self.message = try DataHealthDecode.requireString(obj, "message", context)
        self.affectedIds = DataHealthDecode.optionalStringArray(obj, "affectedIds")
        self.canAutoFix = obj["canAutoFix"]?.boolValue ?? false
        self.suggestedAction = DataHealthDecode.optionalString(obj, "suggestedAction")
    }
}

/// The closed `status` union on `DataHealthReport` (dataHealthEngine.ts:30).
public enum DataHealthStatus: String, Equatable, Hashable, Sendable, CaseIterable {
    case healthy
    case hasWarnings = "has_warnings"
    case hasErrors = "has_errors"
}

/// `DataHealthReport` (dataHealthEngine.ts:29). Foundation type consumed by
/// `coachActionEngine` as a type-only input (`report.issues`); CC-0 ports the
/// shape, not the report-building engine.
public struct DataHealthReport: Equatable, Hashable, Sendable {
    public let status: DataHealthStatus
    public let issues: [DataHealthIssue]
    public let summary: String

    public init(status: DataHealthStatus, issues: [DataHealthIssue], summary: String) {
        self.status = status
        self.issues = issues
        self.summary = summary
    }

    public init(decoding value: JSONValue, context: String = "DataHealthReport") throws {
        guard let obj = value.objectValue else {
            throw DataHealthDecodeError.notAnObject(context: context)
        }
        self.status = try DataHealthDecode.requireEnum(obj, "status", DataHealthStatus.self, context)
        self.issues = try (obj["issues"]?.arrayValue ?? []).map {
            try DataHealthIssue(decoding: $0, context: "\(context).issues[]")
        }
        self.summary = try DataHealthDecode.requireString(obj, "summary", context)
    }
}

public enum DataHealthEngine {

    /// `dataHealthSeverityRank` (dataHealthEngine.ts:35) — error 3 > warning 2 > info 1.
    private static func severityRank(_ severity: DataHealthSeverity) -> Int {
        switch severity {
        case .error: return 3
        case .warning: return 2
        case .info: return 1
        }
    }

    /// `sortDataHealthIssues` (dataHealthEngine.ts:41).
    ///
    /// `[...issues].sort((left, right) => { … })` — a STABLE sort over a COPY:
    /// `severityDiff = rank[right] - rank[left]` (severity DESC); on a tie,
    /// `left.title.localeCompare(right.title, 'zh-CN')` (title ASC). Mirrored with
    /// a JS-style three-way comparator over a stable sort so equal-severity /
    /// equal-title pairs keep their original relative order, exactly like
    /// `Array.prototype.sort`'s guaranteed stability.
    public static func sortDataHealthIssues(_ issues: [DataHealthIssue] = []) -> [DataHealthIssue] {
        stableSorted(issues) { left, right in
            let severityDiff = severityRank(right.severity) - severityRank(left.severity) // ts:43
            if severityDiff != 0 { return severityDiff }                                  // ts:44
            return localeCompareZhCN(left.title, right.title)                             // ts:45
        }
    }

    /// `a.localeCompare(b, 'zh-CN')` via Foundation's ICU collation. Returns
    /// -1 / 0 / 1 so callers read like the JS three-way comparator. Same proven
    /// paradigm as `SmartReplacementEngine.localeCompareZhHans`, with the locale
    /// the source actually passes (`'zh-CN'`, dataHealthEngine.ts:45).
    private static func localeCompareZhCN(_ a: String, _ b: String) -> Int {
        switch a.compare(b, options: [], range: nil, locale: Locale(identifier: "zh-CN")) {
        case .orderedAscending: return -1
        case .orderedSame: return 0
        case .orderedDescending: return 1
        }
    }

    /// A STABLE sort driven by a JS-style three-way comparator (negative = left
    /// first). Ties (comparator == 0) keep their original relative order,
    /// mirroring `Array.prototype.sort`'s guaranteed stability.
    private static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }
}

// MARK: - DataHealth golden decode helpers

/// Narrow JSONValue extraction helpers for the DataHealth golden shapes.
/// Pure-value decode ONLY — no engine logic, no computation. Kept local to the
/// DataHealth module because the `IronPathTrainingDecision` keyed accessors are
/// internal to that module (cannot be reused here).
enum DataHealthDecode {
    static func requireString(_ obj: OrderedJSONObject, _ key: String, _ context: String) throws -> String {
        guard let v = obj[key], !v.isNull else {
            throw DataHealthDecodeError.missingKey(key, context: context)
        }
        guard let s = v.stringValue else {
            throw DataHealthDecodeError.missingKey(key, context: context)
        }
        return s
    }

    static func optionalString(_ obj: OrderedJSONObject, _ key: String) -> String? {
        guard let v = obj[key], !v.isNull else { return nil }
        return v.stringValue
    }

    static func optionalStringArray(_ obj: OrderedJSONObject, _ key: String) -> [String]? {
        guard let v = obj[key], !v.isNull, let arr = v.arrayValue else { return nil }
        return arr.compactMap { $0.stringValue }
    }

    static func requireEnum<E: RawRepresentable>(
        _ obj: OrderedJSONObject,
        _ key: String,
        _ type: E.Type,
        _ context: String
    ) throws -> E where E.RawValue == String {
        let raw = try requireString(obj, key, context)
        guard let parsed = E(rawValue: raw) else {
            throw DataHealthDecodeError.invalidEnum(key, value: raw, context: context)
        }
        return parsed
    }
}
