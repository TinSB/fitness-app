// RepairHelpers — iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1.
//
// Pure-value Swift ports of `retired web reference`:
//   * `hashIdempotencyKey(repairId:, affectedIds:)` — FNV-1a-style
//     32-bit JS-overflow hash used by every repair's dryRun to derive
//     a stable idempotency key.
//   * `computeAppDataHash(_:)` — coarse-grained AppData fingerprint
//     used by the orchestrator for `appDataHashBefore` /
//     `appDataHashAfter` on ledger rows.
//   * `buildReceipt(...)` — JSON-value-shaped `DataRepairLogEntry`
//     receipt that runRepair appends to `settings.dataRepairLogs`.
//   * `parseIsoDate(_:)` — re-exported wrapper around the iOS-3A
//     `parseIsoDate` for convenience inside the repairs/ subdir.
//
// These helpers are internal — the public Data Health API is the
// `RepairDefinition` protocol + the orchestrator.

import Foundation
import RedeDomain

// MARK: - Idempotency key

/// JS-bit-overflow hash to mirror the legacy web schema reference. The legacy web schema
/// implementation uses signed-32 wrap on every iteration and a
/// `>>> 0` cast at the end; Swift reproduces that with `Int32` +
/// `&<<` / `&-` / `&+` overflow operators and `UInt32(bitPattern:)`.
public func hashIdempotencyKey(repairId: String, affectedIds: [String]) -> String {
    let unique = Array(Set(affectedIds.map { $0 })).sorted()
    let payload = "\(repairId)|\(unique.joined(separator: "|"))"
    var hash: Int32 = 0
    for scalar in payload.unicodeScalars {
        let charCode = Int32(truncatingIfNeeded: scalar.value)
        hash = (hash &<< 5) &- hash &+ charCode
    }
    let positive = UInt32(bitPattern: hash)
    return "idem_\(repairId)_\(String(positive, radix: 36))_\(unique.count)"
}

// MARK: - AppData hash

/// Coarse hash of an AppData. The shape is intentionally narrow —
/// not a full canonical hash — so a repair that touches one
/// session's lifecycle fields changes the hash even though the
/// canonical JSON differs in many more bytes. Mirrors legacy web schema
/// `computeAppDataHash` shape exactly:
///   {schemaVersion, historyLength, historyIds[], todayStatusDate,
///    issueScoresKeys[], issueScoresSum, healthLatest}
public func computeAppDataHash(_ appData: AppData) -> String {
    let history = appData.history
    let historyIds = history.map { $0.id ?? "" }
    let todayStatusDate = appData.todayStatus.date

    let adaptiveObj = appData.screeningProfile.adaptiveState?.objectValue
    let issueScoresObj = adaptiveObj?["issueScores"]?.objectValue ?? OrderedJSONObject()
    let issueScoresKeys = issueScoresObj.entries.map { $0.key }.sorted()
    let issueScoresSum: Double = issueScoresObj.entries.reduce(0.0) { acc, entry in
        if let n = entry.value.doubleValue, !n.isNaN { return acc + n }
        return acc
    }

    var healthLatestMs: Double?
    for sample in appData.healthMetricSamples {
        if let parsed = parseIsoDate(sample.startDate) {
            let ms = parsed.timeIntervalSince1970 * 1000.0
            healthLatestMs = max(healthLatestMs ?? ms, ms)
        }
    }
    if let workouts = appData.root["importedWorkoutSamples"]?.arrayValue {
        for entry in workouts {
            guard case .object(let obj) = entry else { continue }
            if let parsed = parseIsoDate(obj["startDate"]?.stringValue) {
                let ms = parsed.timeIntervalSince1970 * 1000.0
                healthLatestMs = max(healthLatestMs ?? ms, ms)
            }
        }
    }

    // Re-emit through OrderedJSONObject so canonical key order matches
    // a legacy web schema `JSON.stringify` of the equivalent object literal.
    var entries: [OrderedJSONObject.Entry] = []
    entries.append(.init(key: "schemaVersion", value: .number(.integer(Int64(appData.schemaVersion.rawValue)))))
    entries.append(.init(key: "historyLength", value: .number(.integer(Int64(history.count)))))
    entries.append(.init(key: "historyIds", value: .array(historyIds.map { .string($0) })))
    if let d = todayStatusDate {
        entries.append(.init(key: "todayStatusDate", value: .string(d)))
    } else {
        entries.append(.init(key: "todayStatusDate", value: .null))
    }
    entries.append(.init(key: "issueScoresKeys", value: .array(issueScoresKeys.map { .string($0) })))
    // legacy web schema `Object.values(...).reduce((sum, value) => ...)` skips
    // non-number entries. We already filtered above; emit as integer
    // when whole, double otherwise (matches legacy web schema sum semantics).
    if issueScoresSum.truncatingRemainder(dividingBy: 1) == 0 {
        entries.append(.init(key: "issueScoresSum", value: .number(.integer(Int64(issueScoresSum)))))
    } else {
        entries.append(.init(key: "issueScoresSum", value: .number(.double(issueScoresSum))))
    }
    if let ms = healthLatestMs {
        entries.append(.init(key: "healthLatest", value: .number(.integer(Int64(ms)))))
    } else {
        entries.append(.init(key: "healthLatest", value: .null))
    }

    let payload: String
    do {
        payload = try JSONValue.object(OrderedJSONObject(entries: entries)).canonicalJSONString()
    } catch {
        // Defensive: a hash failure means we silently degrade the hash
        // to a constant rather than throw — the orchestrator can still
        // proceed, the ledger row just won't have a meaningful hash.
        payload = "appdata_canonicalize_failed"
    }
    var hash: Int32 = 0
    for scalar in payload.unicodeScalars {
        let charCode = Int32(truncatingIfNeeded: scalar.value)
        hash = (hash &<< 5) &- hash &+ charCode
    }
    let positive = UInt32(bitPattern: hash)
    return "appdata_\(String(positive, radix: 36))_\(history.count)"
}

// MARK: - Receipt builder

/// Builds the `DataRepairLogEntry`-shaped receipt as a `JSONValue`
/// object. Mirrors `repairHelpers.ts:buildReceipt`. Optional `before`
/// / `after` payloads are passed through verbatim.
public struct ReceiptParams: Sendable {
    public let repairId: String
    public let category: RepairCategory
    public let action: String
    public let affectedIds: [String]
    public let beforeSummary: String
    public let afterSummary: String
    public let repairedAt: String?
    public let before: JSONValue?
    public let after: JSONValue?

    public init(
        repairId: String,
        category: RepairCategory,
        action: String,
        affectedIds: [String],
        beforeSummary: String,
        afterSummary: String,
        repairedAt: String? = nil,
        before: JSONValue? = nil,
        after: JSONValue? = nil
    ) {
        self.repairId = repairId
        self.category = category
        self.action = action
        self.affectedIds = affectedIds
        self.beforeSummary = beforeSummary
        self.afterSummary = afterSummary
        self.repairedAt = repairedAt
        self.before = before
        self.after = after
    }
}

public func buildReceipt(_ p: ReceiptParams) -> JSONValue {
    let stamp = p.repairedAt ?? isoNow()
    var entries: [OrderedJSONObject.Entry] = []
    entries.append(.init(key: "id", value: .string("\(p.repairId)-\(stamp)")))
    entries.append(.init(key: "repairId", value: .string(p.repairId)))
    entries.append(.init(key: "createdAt", value: .string(stamp)))
    entries.append(.init(key: "repairedAt", value: .string(stamp)))
    entries.append(.init(key: "category", value: .string(p.category.rawValue)))
    entries.append(.init(key: "action", value: .string(p.action)))
    let unique = Array(Set(p.affectedIds.filter { !$0.isEmpty })).sorted()
    entries.append(.init(key: "affectedIds", value: .array(unique.map { .string($0) })))
    entries.append(.init(key: "beforeSummary", value: .string(p.beforeSummary)))
    entries.append(.init(key: "afterSummary", value: .string(p.afterSummary)))
    if let v = p.before { entries.append(.init(key: "before", value: v)) }
    if let v = p.after { entries.append(.init(key: "after", value: v)) }
    return .object(OrderedJSONObject(entries: entries))
}

/// Returns the current time as an ISO-8601 string with internet-
/// datetime format, matching JS `new Date().toISOString()`.
public func isoNow(_ clock: RuntimeGuardClock = defaultGuardClock) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: clock.now())
}

/// Returns the receipt's `id` field if present, otherwise nil.
internal func receiptIdField(_ receipt: JSONValue) -> String? {
    guard case .object(let obj) = receipt else { return nil }
    return obj["id"]?.stringValue
}
