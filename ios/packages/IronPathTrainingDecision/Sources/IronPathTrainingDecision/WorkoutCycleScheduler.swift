// WorkoutCycleScheduler — SC-1 scheduling-track leaf port (1/1 of this slice).
//
// Faithful line-by-line Swift port of the PURE `buildWorkoutCycleState` from
// `src/engines/workoutCycleScheduler.ts:85` + its private helpers
// (`uniqueTemplateIds` ts:19 / `dateKey` ts:29 / `sessionSortKey` ts:35 /
// `dayNumber` ts:38 / `daysBetween` ts:45 / `isNormalCompletedSession` ts:52 /
// `resolveSessionTemplateId` ts:61 / `templateLabel` ts:66 / `templateListLabel`
// ts:78 / `completedSetFrom` ts:80). The TS engine imports ONLY the
// `TrainingSession` type (workoutCycleScheduler.ts:1) — it is genuinely
// self-contained: no `./engines` import, no data table, no formatter, no clock.
//
// PURE / READ-ONLY: derives the push/pull/legs (or any ordered template) cycle
// position from completed-session history + the explicitly-injected `currentDate`.
// Zero `: Date` — "今天" is the caller-supplied `currentDate` string, never the wall
// clock; all date math is integer civil-calendar arithmetic. The TS `dayNumber`'s
// `Date.UTC(y, m-1, d) / 86400000` is exactly the day-number underlying
// `AnalyticsSupport.daysFromCivil(y, m, d)` (days since 1970-01-01), reused verbatim.
// No IO, no randomness, no write path. NOT wired into any UI (that is SC-4); this
// slice only adds the function and parity-pins it (§19.2). The companion
// `recoveryAwareScheduler` is DEFERRED to a later slice: it is NOT self-contained —
// it imports the un-ported `exerciseRecoveryConflictEngine` + the
// EXERCISE_KNOWLEDGE_OVERRIDES values + a shared `formatExerciseName`, none of which
// exist natively yet (porting them is out of this slice's "only these engines" bound).

import Foundation
import IronPathDomain

public enum WorkoutCycleScheduler {

    /// `WorkoutCycleState` (workoutCycleScheduler.ts:3). `lastCompletedTemplateId` /
    /// `nextTemplateId` follow the TS `canonicalStringify` drop-undefined rule
    /// (omitted from the golden when the engine returns `undefined`).
    public struct WorkoutCycleState: Equatable, Sendable {
        public let orderedTemplateIds: [String]
        public let completedInCurrentCycle: [String]
        public let missingInCurrentCycle: [String]
        public let lastCompletedTemplateId: String?
        public let isCycleComplete: Bool
        public let nextTemplateId: String?
        public let reason: String

        public init(
            orderedTemplateIds: [String],
            completedInCurrentCycle: [String],
            missingInCurrentCycle: [String],
            lastCompletedTemplateId: String?,
            isCycleComplete: Bool,
            nextTemplateId: String?,
            reason: String
        ) {
            self.orderedTemplateIds = orderedTemplateIds
            self.completedInCurrentCycle = completedInCurrentCycle
            self.missingInCurrentCycle = missingInCurrentCycle
            self.lastCompletedTemplateId = lastCompletedTemplateId
            self.isCycleComplete = isCycleComplete
            self.nextTemplateId = nextTemplateId
            self.reason = reason
        }
    }

    // MARK: - JS-truthiness string helper

    /// `value || ''` / `... || next` fall-through: a non-empty string is truthy,
    /// `undefined`/`null`/`''` are falsy.
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    // MARK: - uniqueTemplateIds (workoutCycleScheduler.ts:19)

    /// `uniqueTemplateIds` (ts:19): dedupe by the TRIMMED id, dropping empties, but
    /// KEEP the ORIGINAL (untrimmed) id of the first occurrence — exactly the TS
    /// `ids.filter(...)` (the dedup key is `String(id||'').trim()`, the kept value is
    /// the original `id`).
    private static func uniqueTemplateIds(_ ids: [String]) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for id in ids {
            let value = id.trimmingCharacters(in: .whitespacesAndNewlines)
            if value.isEmpty || seen.contains(value) { continue }
            seen.insert(value)
            out.append(id)
        }
        return out
    }

    // MARK: - dateKey (workoutCycleScheduler.ts:29)

    /// `dateKey` (ts:29): the FIRST `YYYY-MM-DD` substring ANYWHERE in `value`
    /// (`/\d{4}-\d{2}-\d{2}/.match`, NOT anchored), or `''`. ASCII `[0-9]` only,
    /// mirroring JS `\d` (which never matches non-ASCII digits) — scanned manually so
    /// there is no ICU `\d` Unicode-digit divergence.
    private static func dateKey(_ value: String?) -> String {
        let text = Array(value ?? "")
        guard text.count >= 10 else { return "" }
        func isDigit(_ i: Int) -> Bool { text[i].isASCII && text[i].isNumber }
        var i = 0
        let last = text.count - 10
        while i <= last {
            if isDigit(i), isDigit(i + 1), isDigit(i + 2), isDigit(i + 3),
               text[i + 4] == "-", isDigit(i + 5), isDigit(i + 6),
               text[i + 7] == "-", isDigit(i + 8), isDigit(i + 9) {
                return String(text[i ..< i + 10])
            }
            i += 1
        }
        return ""
    }

    // MARK: - sessionSortKey (workoutCycleScheduler.ts:35)

    /// `sessionSortKey` (ts:35): `String(finishedAt || startedAt || date || '')`.
    private static func sessionSortKey(_ session: TrainingSession) -> String {
        truthy(session.finishedAt) ?? truthy(session.startedAt) ?? truthy(session.date) ?? ""
    }

    // MARK: - dayNumber / daysBetween (workoutCycleScheduler.ts:38 / :45)

    /// `dayNumber` (ts:38): `Date.UTC(year, month-1, day) / 86400000` for a clean
    /// `^\d{4}-\d{2}-\d{2}$` key, else `NaN` (→ nil). `dateKey` only ever feeds a
    /// 10-char `YYYY-MM-DD` (or `''`), so the anchored re-match always succeeds on a
    /// non-empty key. The midnight-UTC ms divided by MS_PER_DAY is exactly the day
    /// number `AnalyticsSupport.daysFromCivil(y, m, d)` returns (days since 1970-01-01).
    private static func dayNumber(_ key: String) -> Int? {
        let c = Array(key)
        guard c.count == 10 else { return nil }
        func d(_ i: Int) -> Bool { c[i].isASCII && c[i].isNumber }
        guard d(0), d(1), d(2), d(3), c[4] == "-", d(5), d(6), c[7] == "-", d(8), d(9) else { return nil }
        let year = (c[0].wholeNumberValue! * 1000) + (c[1].wholeNumberValue! * 100)
            + (c[2].wholeNumberValue! * 10) + c[3].wholeNumberValue!
        let month = (c[5].wholeNumberValue! * 10) + c[6].wholeNumberValue!
        let day = (c[8].wholeNumberValue! * 10) + c[9].wholeNumberValue!
        return AnalyticsSupport.daysFromCivil(year, month, day)
    }

    /// `daysBetween` (ts:45): `dayNumber(dateKey(to)) - dayNumber(dateKey(from))`, or
    /// `0` if either is non-finite (`NaN`).
    private static func daysBetween(_ from: String?, _ to: String?) -> Int {
        guard let start = dayNumber(dateKey(from)), let end = dayNumber(dateKey(to)) else { return 0 }
        return end - start
    }

    // MARK: - isNormalCompletedSession (workoutCycleScheduler.ts:52)

    /// `isNormalCompletedSession` (ts:52). `completed !== true` → excluded (strict
    /// `=== true` required; `completed` is the typed `Bool?`). `dataFlag` rides in the
    /// open bag; `dataFlag || 'normal'` maps undefined/'' → 'normal'; 'test'/'excluded'
    /// are excluded. Finally a session is kept unless `currentDate` AND `sessionDate`
    /// both resolve and `sessionDate > currentDate`.
    private static func isNormalCompletedSession(_ session: TrainingSession, _ currentDate: String?) -> Bool {
        if session.completed != true { return false }
        let rawFlag = session._unknown["dataFlag"]?.stringValue
        let flag = (rawFlag == nil || rawFlag!.isEmpty) ? "normal" : rawFlag!
        if flag == "test" || flag == "excluded" { return false }
        let current = dateKey(currentDate)
        let sessionDate = dateKey(truthy(session.finishedAt) ?? truthy(session.startedAt) ?? truthy(session.date))
        return current.isEmpty || sessionDate.isEmpty || sessionDate <= current
    }

    // MARK: - resolveSessionTemplateId (workoutCycleScheduler.ts:61)

    /// `resolveSessionTemplateId` (ts:61): the FIRST of
    /// `[sourceProgramTemplateId, programTemplateId, templateId]` (truthy, in that
    /// precedence) that is a member of `orderedSet`. All three ride in the open bag
    /// (none are documented `TrainingSession` keys). The TS `.filter(Boolean).map(String)`
    /// reduces, for the §11 clean string-id domain, to "non-empty string id".
    private static func resolveSessionTemplateId(_ session: TrainingSession, _ orderedSet: Set<String>) -> String? {
        let candidates = [
            session._unknown["sourceProgramTemplateId"]?.stringValue,
            session._unknown["programTemplateId"]?.stringValue,
            session._unknown["templateId"]?.stringValue,
        ].compactMap { truthy($0) }
        return candidates.first { orderedSet.contains($0) }
    }

    // MARK: - templateLabel / templateListLabel (workoutCycleScheduler.ts:66 / :78)

    /// `templateLabel` (ts:66): the fixed push/pull/legs label map, else the id with
    /// `-` → ` ` (`id.replace(/-/g, ' ')`).
    private static func templateLabel(_ id: String) -> String {
        let labels: [String: String] = [
            "push-a": "推 A",
            "pull-a": "拉 A",
            "legs-a": "腿 A",
            "push": "推",
            "pull": "拉",
            "legs": "腿",
        ]
        return labels[id] ?? id.replacingOccurrences(of: "-", with: " ")
    }

    /// `templateListLabel` (ts:78): `ids.map(templateLabel).join('、')`.
    private static func templateListLabel(_ ids: [String]) -> String {
        ids.map(templateLabel).joined(separator: "、")
    }

    // MARK: - completedSetFrom (workoutCycleScheduler.ts:80)

    /// `completedSetFrom` (ts:80): `ordered.filter(id => new Set(ids).has(id))`.
    private static func completedSetFrom(_ ids: [String], _ ordered: [String]) -> [String] {
        let completed = Set(ids)
        return ordered.filter { completed.contains($0) }
    }

    // MARK: - buildWorkoutCycleState (workoutCycleScheduler.ts:85)

    public static func buildWorkoutCycleState(
        history: [TrainingSession] = [],
        orderedTemplateIds: [String],
        currentDate: String? = nil
    ) -> WorkoutCycleState {
        let ordered = uniqueTemplateIds(orderedTemplateIds)
        if ordered.isEmpty {
            // ts:91-99
            return WorkoutCycleState(
                orderedTemplateIds: [],
                completedInCurrentCycle: [],
                missingInCurrentCycle: [],
                lastCompletedTemplateId: nil,
                isCycleComplete: false,
                nextTemplateId: nil,
                reason: "当前没有可用训练日顺序，暂时无法判断下次训练。"
            )
        }

        let orderedSet = Set(ordered)
        // ts:102-104 — `[...history].filter(isNormal).sort(sessionSortKey localeCompare ASC)`.
        // The `localeCompare` over §11-clean ASCII ISO sort keys reproduces with a code-point
        // string comparison (the same precedent as `PlateauDetectionEngine.relevantSessions` /
        // `E1RMEngine.collectCandidates`); `stableSorted` keeps JS `Array.sort` tie order.
        let completedSessions = stableSorted(
            history.filter { isNormalCompletedSession($0, currentDate) }
        ) { left, right in
            let l = sessionSortKey(left), r = sessionSortKey(right)
            return l < r ? -1 : (l > r ? 1 : 0)
        }

        // ts:106-117 — restart when the latest completed session is > 30 days before currentDate.
        if let latestPplSession = completedSessions.last,
           let cd = truthy(currentDate),
           daysBetween(
                truthy(latestPplSession.finishedAt) ?? truthy(latestPplSession.startedAt) ?? truthy(latestPplSession.date),
                cd
           ) > 30 {
            return WorkoutCycleState(
                orderedTemplateIds: ordered,
                completedInCurrentCycle: [],
                missingInCurrentCycle: ordered,
                lastCompletedTemplateId: resolveSessionTemplateId(latestPplSession, orderedSet),
                isCycleComplete: false,
                nextTemplateId: ordered[0],
                reason: "距离上次主轮转较久，系统从新一轮开始，建议从\(templateLabel(ordered[0]))开始。"
            )
        }

        // ts:119-134 — accumulate completed template ids into rolling cycles.
        var currentCycleCompleted = Set<String>()
        var lastClosedCycleCompleted: [String] = []
        var lastCompletedTemplateId: String?
        var closedCycleCount = 0

        for session in completedSessions {
            guard let templateId = resolveSessionTemplateId(session, orderedSet) else { continue }
            lastCompletedTemplateId = templateId
            currentCycleCompleted.insert(templateId)
            if currentCycleCompleted.count == ordered.count {
                lastClosedCycleCompleted = completedSetFrom(Array(currentCycleCompleted), ordered)
                currentCycleCompleted.removeAll()
                closedCycleCount += 1
            }
        }

        // ts:136-147
        let hasOpenCycle = currentCycleCompleted.count > 0
        let completedInCurrentCycle: [String] = hasOpenCycle
            ? ordered.filter { currentCycleCompleted.contains($0) }
            : (closedCycleCount > 0 ? lastClosedCycleCompleted : [])
        let openMissingInCurrentCycle = ordered.filter { !currentCycleCompleted.contains($0) }
        let missingInCurrentCycle: [String] = hasOpenCycle
            ? openMissingInCurrentCycle
            : (closedCycleCount > 0 ? [] : ordered)
        let isCycleComplete = !hasOpenCycle && closedCycleCount > 0
        // `missingInCurrentCycle[0] || ordered[0]`: a falsy (empty/absent) first element
        // falls through to ordered[0]. Ordered ids are non-empty (uniqueTemplateIds drops
        // empty-trimmed), so this is `missing.first ?? ordered[0]` in practice.
        let nextTemplateId: String = isCycleComplete
            ? ordered[0]
            : (truthy(missingInCurrentCycle.first ?? "") ?? ordered[0])

        let reason: String
        if isCycleComplete {
            // ts:144 — NOTE: the TS reason hardcodes "推、拉、腿" regardless of the actual
            // ordered ids; reproduced verbatim.
            reason = "上一轮推、拉、腿已完成；下次进入新一轮，建议从\(templateLabel(ordered[0]))开始。"
        } else if !completedInCurrentCycle.isEmpty {
            reason = "当前这一轮已完成\(templateListLabel(completedInCurrentCycle))，还缺\(templateListLabel(missingInCurrentCycle))，因此今天建议\(templateLabel(nextTemplateId))。"
        } else {
            reason = "还没有本轮正式完成记录，建议从\(templateLabel(ordered[0]))开始。"
        }

        return WorkoutCycleState(
            orderedTemplateIds: ordered,
            completedInCurrentCycle: completedInCurrentCycle,
            missingInCurrentCycle: missingInCurrentCycle,
            lastCompletedTemplateId: lastCompletedTemplateId,
            isCycleComplete: isCycleComplete,
            nextTemplateId: nextTemplateId,
            reason: reason
        )
    }

    // MARK: - stableSorted (JS `Array.prototype.sort` stability)

    /// A STABLE sort driven by a JS-style three-way comparator (negative = left first).
    /// Ties (comparator == 0) keep their original relative order, mirroring
    /// `Array.prototype.sort`'s guaranteed stability — the same helper shape each
    /// already-ported engine carries (SmartReplacement / AnalyticsDashboard / PainPattern).
    private static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }
}
