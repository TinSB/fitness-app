// PainPatternEngine — AN-5 painPattern (trainingLevel-consumed subset) port.
//
// Faithful line-by-line Swift port of the PURE pain-pattern aggregation function
// from `retired web reference` — ONLY the subset CALLed by
// trainingLevelEngine (`buildPainPatterns(history)`) plus every private helper it
// reads:
//   - buildPainPatterns        (painPatternEngine.ts:58)
//   + recentNormalSessions     (painPatternEngine.ts:31)
//   + painSeverityFromSet      (painPatternEngine.ts:51)
//   + sessionSortKey           (painPatternEngine.ts:23)
//   + toTime                   (painPatternEngine.ts:25)
//   + excludedFlags / isTrainingSession (painPatternEngine.ts:18-21)
// and the output / input types (PainPattern + PainSuggestedAction from
// training-model.ts:1028/151, BuildPainPatternsOptions from painPatternEngine.ts:12,
// PainAccumulator from painPatternEngine.ts:4).
//
// Dependency boundary (AN-5 §, matches the slice contract):
//   * `getExercisePainPattern` (painPatternEngine.ts:142) is NOT ported — it is not
//     CALLed by trainingLevelEngine (only exercisePrescriptionEngine reads it, which
//     is a later slice). Only the trainingLevel-consumed subset lands here.
//   * REUSES (does NOT re-port) the already-ported `E1RMEngine.number` (engineUtils
//     `number`) and the AN-1 civil-calendar primitives `AnalyticsSupport.daysFromCivil`
//     (for the `new Date(value).getTime()` epoch arithmetic) — so the lookback-window
//     math is `zero : Date`.
//
// PURE / read-only: consumes `history: [TrainingSession]` + options; no IO, no wall
// clock (the only "clock" is the OPTIONAL injected `options.currentDate`; with no
// option the anchor is the most-recent session's own date string), no randomness.
// NOT wired into any UI (that is AN-7).

import Foundation
import RedeDomain

public enum PainPatternEngine {

    // MARK: - Output / input types

    /// `PainSuggestedAction` (training-model.ts:151). RawValue strings mirror the legacy web schema
    /// string-literal union so the golden's `suggestedAction` decodes/compares verbatim.
    public enum PainSuggestedAction: String, Equatable, Sendable {
        case watch = "watch"
        case substitute = "substitute"
        case deload = "deload"
        case seekProfessional = "seek_professional"
    }

    /// `PainPattern` (training-model.ts:1028) — the FULL canonical shape (this slice is
    /// the first full port; the partial `PlateauDetectionEngine.PainPattern` /
    /// `SmartReplacementPainPattern` stay as their own consumed subsets).
    public struct PainPattern: Equatable, Sendable {
        public let area: String
        public let exerciseId: String?
        public let frequency: Int
        public let severityAvg: Double
        public let lastOccurredAt: String
        public let suggestedAction: PainSuggestedAction

        public init(
            area: String,
            exerciseId: String? = nil,
            frequency: Int,
            severityAvg: Double,
            lastOccurredAt: String,
            suggestedAction: PainSuggestedAction
        ) {
            self.area = area
            self.exerciseId = exerciseId
            self.frequency = frequency
            self.severityAvg = severityAvg
            self.lastOccurredAt = lastOccurredAt
            self.suggestedAction = suggestedAction
        }
    }

    /// `BuildPainPatternsOptions` (painPatternEngine.ts:12).
    public struct BuildPainPatternsOptions: Sendable {
        public let currentDate: String?
        public let lookbackDays: Int?
        public let maxSessions: Int?

        public init(currentDate: String? = nil, lookbackDays: Int? = nil, maxSessions: Int? = nil) {
            self.currentDate = currentDate
            self.lookbackDays = lookbackDays
            self.maxSessions = maxSessions
        }
    }

    /// `PainAccumulator` (painPatternEngine.ts:4) — the mutable per-area / per-exercise
    /// running tally.
    private struct PainAccumulator {
        var area: String
        var exerciseId: String?
        var frequency: Int
        var totalSeverity: Double
        var lastOccurredAt: String
    }

    // MARK: - excludedFlags (painPatternEngine.ts:18)

    /// `new Set<SessionDataFlag>(['test', 'excluded'])`.
    private static let excludedFlags: Set<String> = ["test", "excluded"]

    // MARK: - small helpers

    /// JS truthiness for an optional string (`a || b` skips `''`/nil).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    private static func pad2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

    // MARK: - sessionSortKey (painPatternEngine.ts:23)

    /// `session?.finishedAt || session?.startedAt || session?.date || ''`.
    private static func sessionSortKey(_ session: TrainingSession?) -> String {
        guard let session else { return "" }
        return truthy(session.finishedAt) ?? truthy(session.startedAt) ?? truthy(session.date) ?? ""
    }

    // MARK: - toTime (painPatternEngine.ts:25)

    /// `new Date(value).getTime()` → ms since epoch, or `nil` for the JS `NaN`. A faithful
    /// reproduction over the §11 ISO shapes the engine sees: a bare `YYYY-MM-DD` parses as
    /// UTC midnight (ECMAScript date-only → UTC), and a full `YYYY-MM-DDTHH:mm:ss(.sss)Z`
    /// parses as that exact UTC instant. Both reduce to integer-day math over
    /// `AnalyticsSupport.daysFromCivil` (AN-1 civil) plus the time-of-day — `zero : Date`.
    /// `if (!value) return NaN` is mirrored by the empty/nil → `nil` guard.
    private static func toTime(_ value: String?) -> Double? {
        guard let value, !value.isEmpty else { return nil }
        let chars = Array(value)
        // Leading `YYYY-MM-DD` (no `$` anchor — a full ISO matches by its date prefix).
        guard chars.count >= 10 else { return nil }
        func digit(_ i: Int) -> Int? { chars[i].isASCII && chars[i].isNumber ? chars[i].wholeNumberValue : nil }
        guard let y0 = digit(0), let y1 = digit(1), let y2 = digit(2), let y3 = digit(3),
              chars[4] == "-", let mo0 = digit(5), let mo1 = digit(6),
              chars[7] == "-", let d0 = digit(8), let d1 = digit(9) else { return nil }
        let y = y0 * 1000 + y1 * 100 + y2 * 10 + y3
        let mo = mo0 * 10 + mo1
        let d = d0 * 10 + d1
        guard mo >= 1, mo <= 12, d >= 1, d <= 31 else { return nil } // JS `Date.parse → NaN`
        let base = Double(AnalyticsSupport.daysFromCivil(y, mo, d)) * 86_400_000

        // Optional time-of-day: `THH:mm:ss(.sss)?Z?`. Absent → UTC midnight (date-only).
        guard chars.count > 10, chars[10] == "T" else { return base }
        func twoDigits(_ i: Int) -> Int? {
            guard i + 1 < chars.count, let a = digit(i), let b = digit(i + 1) else { return nil }
            return a * 10 + b
        }
        guard let hh = twoDigits(11), chars.count > 13, chars[13] == ":",
              let mm = twoDigits(14), chars.count > 16, chars[16] == ":",
              let ss = twoDigits(17) else { return nil }
        var timeMs = Double((hh * 3600 + mm * 60 + ss) * 1000)
        // Optional `.sss` fractional second (up to 3 digits → ms).
        if chars.count > 19, chars[19] == "." {
            var i = 20, frac = 0, places = 0
            while i < chars.count, places < 3, let dg = digit(i) {
                frac = frac * 10 + dg
                places += 1
                i += 1
            }
            while places < 3 { frac *= 10; places += 1 }
            timeMs += Double(frac)
        }
        return base + timeMs
    }

    // MARK: - recentNormalSessions (painPatternEngine.ts:31)

    /// The `history.filter(...).sort(...).filter(window).slice(0, maxSessions)` pipeline.
    /// `isTrainingSession` (painPatternEngine.ts:20) is a `null`/non-object guard — a
    /// no-op over Swift's non-optional `[TrainingSession]`, so it is omitted.
    private static func recentNormalSessions(
        _ history: [TrainingSession],
        _ options: BuildPainPatternsOptions
    ) -> [TrainingSession] {
        let lookbackDays = options.lookbackDays ?? 30
        let maxSessions = options.maxSessions ?? 12
        // `.filter(!excludedFlags.has(session.dataFlag || 'normal'))`.
        let filtered = history.filter { session in
            let flag = session._unknown["dataFlag"]?.stringValue ?? "normal" // `session.dataFlag || 'normal'`
            return !excludedFlags.contains(flag)
        }
        // `.sort((l, r) => String(sortKey(r)).localeCompare(String(sortKey(l))))` — DESCENDING
        // by sort-key string. For the §11 ISO `YYYY-MM-DD`/`…Z` strings, `localeCompare` is
        // plain lexicographic, so Swift `>` matches; the explicit original-index tiebreak
        // reproduces V8's guaranteed `Array.prototype.sort` stability.
        let sorted = stableSorted(filtered) { left, right in
            let l = sessionSortKey(left)
            let r = sessionSortKey(right)
            if r == l { return 0 }
            return r > l ? 1 : -1 // r.localeCompare(l): r>l → +
        }
        // `anchorTime = toTime(currentDate) || toTime(sortKey(sorted[0]))` — the JS `||`
        // falls through on NaN AND on the (epoch-0) `0`.
        let anchorCandidate = toTime(options.currentDate)
        let anchorTime: Double? = {
            if let a = anchorCandidate, a != 0 { return a }
            return toTime(sessionSortKey(sorted.first))
        }()
        // `minTime = isNaN(anchorTime) ? NaN : anchorTime - lookbackDays * MS_PER_DAY`.
        let minTime: Double? = anchorTime.map { $0 - Double(lookbackDays) * 24 * 60 * 60 * 1000 }
        let windowed = sorted.filter { session in
            guard let minTime, let anchorTime else { return true } // `isNaN(minTime) → return true`
            guard let time = toTime(sessionSortKey(session)) else { return false } // `isNaN(time) → false`
            return time >= minTime && time <= anchorTime + 24 * 60 * 60 * 1000
        }
        return Array(windowed.prefix(maxSessions))
    }

    // MARK: - painSeverityFromSet (painPatternEngine.ts:51)

    /// `painSeverity>0 ? painSeverity : /sharp|刺痛|剧烈/i ? 4 : /ache|酸|不适/i ? 2 : 2`.
    /// `set.painSeverity` is the typed `NumberRepr?`; `set.note` rides in the open bag.
    private static func painSeverityFromSet(_ set: TrainingSetLog) -> Double {
        let severity = E1RMEngine.number(set.painSeverity) // number(set.painSeverity)
        if severity > 0 { return severity }
        let note = set._unknown["note"]?.stringValue ?? "" // String(set.note || '')
        if matches(note, "sharp|刺痛|剧烈") { return 4 }
        if matches(note, "ache|酸|不适") { return 2 }
        return 2
    }

    /// `/pattern/i.test(value)` — case-insensitive substring/regex match.
    private static func matches(_ value: String, _ pattern: String) -> Bool {
        value.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    // MARK: - buildPainPatterns (painPatternEngine.ts:58)

    public static func buildPainPatterns(
        _ history: [TrainingSession] = [],
        _ options: BuildPainPatternsOptions = BuildPainPatternsOptions()
    ) -> [PainPattern] {
        var byArea = InsertionOrderedMap<PainAccumulator>()
        var byExercise = InsertionOrderedMap<PainAccumulator>()

        for session in recentNormalSessions(history, options) {
            let sessionDate = session.date ?? "" // `session.date` (always present in §11 inputs)
            for exercise in (session.exercises ?? []) {
                let sets = exercise.sets ?? [] // `Array.isArray(exercise.sets) ? exercise.sets : []`
                for set in sets where set.painFlag == true { // `.filter(set => set.painFlag)`
                    // `set.painArea || exercise.muscle || '未知部位'`.
                    let area = truthy(set.painArea)
                        ?? truthy(exercise._unknown["muscle"]?.stringValue)
                        ?? "未知部位"
                    let severity = painSeverityFromSet(set)
                    // `${area}:${exercise.baseId || exercise.id}` (undefined → "undefined").
                    let exId = truthy(exercise._unknown["baseId"]?.stringValue) ?? truthy(exercise.id)
                    let exerciseKey = "\(area):\(exId ?? "undefined")"

                    var nextArea = byArea.get(area)
                        ?? PainAccumulator(area: area, exerciseId: nil, frequency: 0, totalSeverity: 0, lastOccurredAt: sessionDate)
                    nextArea.frequency += 1
                    nextArea.totalSeverity += severity
                    nextArea.lastOccurredAt = nextArea.lastOccurredAt > sessionDate ? nextArea.lastOccurredAt : sessionDate
                    byArea.set(area, nextArea)

                    var nextExercise = byExercise.get(exerciseKey)
                        ?? PainAccumulator(area: area, exerciseId: exId, frequency: 0, totalSeverity: 0, lastOccurredAt: sessionDate)
                    nextExercise.frequency += 1
                    nextExercise.totalSeverity += severity
                    nextExercise.lastOccurredAt = nextExercise.lastOccurredAt > sessionDate ? nextExercise.lastOccurredAt : sessionDate
                    byExercise.set(exerciseKey, nextExercise)
                }
            }
        }

        // exercisePatterns (painPatternEngine.ts:91)
        let exercisePatterns: [PainPattern] = byExercise.values.map { item in
            let severityAvg = item.totalSeverity / Double(max(1, item.frequency))
            var suggestedAction: PainSuggestedAction = .watch
            if severityAvg >= 4 || item.frequency >= 4 { suggestedAction = .substitute }
            if severityAvg >= 4.5 && item.frequency >= 4 { suggestedAction = .deload }
            return PainPattern(
                area: item.area,
                exerciseId: item.exerciseId,
                frequency: item.frequency,
                severityAvg: roundOne(severityAvg),
                lastOccurredAt: item.lastOccurredAt,
                suggestedAction: suggestedAction
            )
        }

        // areaPatterns (painPatternEngine.ts:106) — `.filter(frequency >= 2)`.
        var areaPatterns: [PainPattern] = byArea.values.filter { $0.frequency >= 2 }.map { item in
            let severityAvg = item.totalSeverity / Double(max(1, item.frequency))
            var suggestedAction: PainSuggestedAction = .watch
            if severityAvg >= 3.5 || item.frequency >= 4 { suggestedAction = .deload }
            if severityAvg >= 4.5 || item.frequency >= 6 { suggestedAction = .seekProfessional }
            return PainPattern(
                area: item.area,
                exerciseId: nil,
                frequency: item.frequency,
                severityAvg: roundOne(severityAvg),
                lastOccurredAt: item.lastOccurredAt,
                suggestedAction: suggestedAction
            )
        }

        // combined multi-area pattern (painPatternEngine.ts:122)
        let distinctAreas = byArea.keyOrder
        if distinctAreas.count >= 2 {
            let allValues = byArea.values
            let totalFrequency = allValues.reduce(0) { $0 + $1.frequency }
            let totalSeverity = allValues.reduce(0.0) { $0 + $1.totalSeverity }
            let severityAvg = totalSeverity / Double(max(1, totalFrequency))
            // `[...byArea.values()].map(lastOccurredAt).sort().slice(-1)[0] || ''` — max by
            // ascending lexicographic sort.
            let lastOccurredAt = allValues.map { $0.lastOccurredAt }.sorted().last ?? ""
            areaPatterns.append(PainPattern(
                area: distinctAreas.joined(separator: " / "),
                exerciseId: nil,
                frequency: totalFrequency,
                severityAvg: roundOne(severityAvg),
                lastOccurredAt: lastOccurredAt,
                suggestedAction: severityAvg >= 4 ? .deload : .watch
            ))
        }

        // `[...exercisePatterns, ...areaPatterns].sort(severityAvg desc, then frequency desc)`
        // over the ROUNDED output values; V8-stable.
        return stableSorted(exercisePatterns + areaPatterns) { left, right in
            if right.severityAvg != left.severityAvg { return right.severityAvg > left.severityAvg ? 1 : -1 }
            if right.frequency != left.frequency { return right.frequency > left.frequency ? 1 : -1 }
            return 0
        }
    }

    // MARK: - rounding (`Math.round(value * 10) / 10`)

    /// `Math.round(value * 10) / 10` via `AnalyticsSupport.jsMathRound` (half toward +∞).
    private static func roundOne(_ value: Double) -> Double {
        Double(AnalyticsSupport.jsMathRound(value * 10)) / 10
    }

    // MARK: - stable sort (V8 `Array.prototype.sort` semantics)

    /// A STABLE sort driven by a JS-style three-way comparator (negative = left first).
    /// Ties keep their original relative order, mirroring V8's guaranteed stability.
    private static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }
}

// MARK: - Insertion-ordered map (JS `Map` semantics)

/// A minimal ordered map: keys keep their first-insertion slot, and re-setting an
/// existing key updates the value WITHOUT moving it — exactly like a JS `Map`. (A
/// file-scoped copy of the same shape SmartReplacementEngine uses; fileprivate so the
/// two never collide.)
fileprivate struct InsertionOrderedMap<Value> {
    private(set) var keyOrder: [String] = []
    private var storage: [String: Value] = [:]

    func get(_ key: String) -> Value? { storage[key] }

    mutating func set(_ key: String, _ value: Value) {
        if storage[key] == nil { keyOrder.append(key) }
        storage[key] = value
    }

    var values: [Value] { keyOrder.map { storage[$0]! } }
}
