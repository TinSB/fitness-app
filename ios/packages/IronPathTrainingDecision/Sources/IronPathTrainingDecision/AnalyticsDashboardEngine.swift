// AnalyticsDashboardEngine — AN-3 analytics.ts dashboard port (the in-scope exports).
//
// Faithful line-by-line Swift port of the PURE analytics dashboard functions in
// `retired web reference` (the AN-3 boundary set — every export the analytics /
// insights track CALLs):
//   - buildMuscleVolumeDashboard (analytics.ts:112)
//   - buildExerciseTrend         (analytics.ts:152)
//   - trendStatus                (analytics.ts:178)
//   - buildPrs                   (analytics.ts:188)
//   - buildWeeklyReport          (analytics.ts:293)
//   - buildAdherenceReport       (analytics.ts:406)
//   - CORE_TREND_EXERCISES       (analytics.ts:84)
// + every private helper they read (ratio / analyticsHistory / incrementReason /
//   mostCommonReason / setCountForExercise / supportPlannedFromBlock /
//   recordQualityForSet / combineRecordQuality / completedHighQualitySets / roundOne /
//   getVolumeStatus / buildVolumeNotes) and the engineUtils helpers sessionVolume /
//   sessionCompletedSets / exerciseVolume (engineUtils.ts:110-116, ported in place).
//
// OUT OF SCOPE (not CALLed by the analytics track, UI/DOM or non-injectable clock):
//   makeCsv / downloadText / buildMonthStats / buildRecentSessionBars.
//
// Reuses (does NOT re-port) the already-ported dependencies:
//   - effectiveSetEngine.{buildEffectiveVolumeSummary,evaluateEffectiveSet} → EffectiveSetEngine.*
//   - e1rmEngine.{getExerciseRecordPoolId,buildE1RMProfile}                → E1RMEngine.*
//   - engineUtils.{completedSets,number,setVolume}                         → E1RMEngine.* / AnalyticsSupport.setVolume
//   - replacementEngine.hasInvalidExerciseIdentity                         → E1RMEngine.hasInvalidExerciseIdentity
//   - i18n/formatters.formatExerciseName (= formatExerciseDisplayName)     → ExerciseLibrary.formatExerciseDisplayName
//   - the analytics `analyticsHistory` dataFlag filter                     → E1RMEngine.isAnalyticsSession (byte-identical predicate)
//   - `Math.round(x)` / the JS toFixed-free `Math.round(x*10)/10`          → AnalyticsSupport.jsMathRound
//
// PURE: consumes `[TrainingSession]` history (a §11 clean input); no IO, no randomness.
// **Zero `: Date`** — `buildWeeklyReport`'s sole wall-clock (`new Date()`) is replaced by
// an INJECTED `asOfDate` (the §11.2 deterministic clock); the 7-day window is exact UTC ms
// arithmetic over `E1RMEngine.safeDateMs` (= `new Date(value)` semantics). NOT wired into
// any UI/decision output (that is AN-6/AN-7).

import Foundation
import IronPathDomain

public enum AnalyticsDashboardEngine {

    // MARK: - CORE_TREND_EXERCISES (analytics.ts:84)

    public struct CoreTrendExercise: Equatable, Sendable {
        public let id: String
        public let label: String
    }

    public static let coreTrendExercises: [CoreTrendExercise] = [
        CoreTrendExercise(id: "bench-press", label: "卧推"),
        CoreTrendExercise(id: "squat", label: "深蹲"),
        CoreTrendExercise(id: "romanian-deadlift", label: "RDL"),
        CoreTrendExercise(id: "lat-pulldown", label: "下拉"),
    ]

    // MARK: - Numeric / string helpers

    /// `ratio` (analytics.ts:40): `planned > 0 ? Math.round((actual / planned) * 100) : 0`.
    static func ratio(_ actual: Double, _ planned: Double) -> Double {
        planned > 0 ? Double(AnalyticsSupport.jsMathRound((actual / planned) * 100)) : 0
    }

    /// `roundOne` (analytics.ts:91): `Math.round(value * 10) / 10`. NOT `toFixed` — the
    /// JS multiply-then-`Math.round` is reproduced bit-identically via `jsMathRound`.
    static func roundOne(_ value: Double) -> Double {
        Double(AnalyticsSupport.jsMathRound(value * 10)) / 10
    }

    /// `analyticsHistory` (analytics.ts:41): `dataFlag !== 'test' && dataFlag !== 'excluded'`.
    /// Byte-identical predicate to the already-ported `E1RMEngine.isAnalyticsSession`.
    static func analyticsHistory(_ history: [TrainingSession]) -> [TrainingSession] {
        history.filter { E1RMEngine.isAnalyticsSession($0) }
    }

    /// JS `Number.prototype.toString` for the analytics decimal domain (positive,
    /// finite, ≤ a few decimals — weights / reps / e1rmKg(.5) / roundOne(.1) / counts).
    /// Integers drop the Swift `.0`; everything else uses Swift's shortest round-trip
    /// description, which matches V8's shortest-round-trip `toString` for this range.
    static func jsNumberString(_ value: Double) -> String {
        if value == value.rounded(.towardZero) && abs(value) < 1e15 {
            return String(Int(value))
        }
        return String(value)
    }

    /// `nonEmpty` — JS truthiness for an optional string (`a || b` skips `''`/nil).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    // MARK: - engineUtils volume helpers (engineUtils.ts:110-116) — ported in place

    /// `exerciseVolume` (engineUtils.ts:110).
    static func exerciseVolume(_ exercise: ExercisePrescription) -> Double {
        E1RMEngine.completedSets(exercise).reduce(0) { $0 + AnalyticsSupport.setVolume($1) }
    }

    /// `sessionVolume` (engineUtils.ts:113).
    static func sessionVolume(_ session: TrainingSession) -> Double {
        (session.exercises ?? []).reduce(0) { $0 + exerciseVolume($1) }
    }

    /// `sessionCompletedSets` (engineUtils.ts:115).
    static func sessionCompletedSets(_ session: TrainingSession) -> Double {
        (session.exercises ?? []).reduce(0) { $0 + Double(E1RMEngine.completedSets($1).count) }
    }

    // MARK: - record-quality helpers (analytics.ts:61-82)

    public struct RecordQuality: Equatable, Sendable {
        public let quality: String
        public let reasons: [String]
    }

    /// `recordQualityForSet` (analytics.ts:61). `evaluateEffectiveSet(set)` is called with
    /// NO exercise (the analytics PR path), so the identity guard is `set.identityInvalid` only.
    static func recordQualityForSet(_ set: TrainingSetLog) -> RecordQuality {
        let effective = EffectiveSetEngine.evaluateEffectiveSet(set)
        if set.techniqueQuality == "poor" {
            return RecordQuality(quality: "low_confidence", reasons: ["动作质量较差，不能标记为高质量记录。"])
        }
        if set.painFlag == true {
            return RecordQuality(quality: "low_confidence", reasons: ["该组出现不适，不能标记为高质量记录。"])
        }
        if !effective.isEffective {
            return RecordQuality(quality: "standard", reasons: effective.reasons)
        }
        return RecordQuality(quality: "high_quality", reasons: ["动作质量和努力程度达到高质量记录标准。"])
    }

    /// `combineRecordQuality` (analytics.ts:69).
    static func combineRecordQuality(_ sets: [TrainingSetLog]) -> RecordQuality {
        if sets.isEmpty {
            return RecordQuality(quality: "low_confidence", reasons: ["缺少可用工作组。"])
        }
        let qualities = sets.map(recordQualityForSet)
        if qualities.contains(where: { $0.quality == "low_confidence" }) {
            return RecordQuality(quality: "low_confidence", reasons: orderedUnique(qualities.flatMap { $0.reasons }))
        }
        if qualities.allSatisfy({ $0.quality == "high_quality" }) {
            return RecordQuality(quality: "high_quality", reasons: ["本次记录由高质量工作组构成。"])
        }
        return RecordQuality(quality: "standard", reasons: orderedUnique(qualities.flatMap { $0.reasons }))
    }

    /// `completedHighQualitySets` (analytics.ts:79).
    static func completedHighQualitySets(_ exercise: ExercisePrescription) -> [TrainingSetLog] {
        if E1RMEngine.hasInvalidExerciseIdentity(exercise) { return [] }
        return E1RMEngine.completedSets(exercise).filter { recordQualityForSet($0).quality != "low_confidence" }
    }

    /// `[...new Set(values)]` — order-preserving unique.
    private static func orderedUnique(_ values: [String]) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for v in values where !seen.contains(v) { seen.insert(v); out.append(v) }
        return out
    }

    /// A STABLE sort driven by a JS-style three-way comparator (negative = left first).
    /// Ties (comparator == 0) keep their ORIGINAL relative order via the pre-sort index,
    /// mirroring `Array.prototype.sort`'s GUARANTEED stability (ES2019). Swift's
    /// `sort(by:)`/`sorted(by:)` is ALSO contractually stable since Swift 5.8 (SE-0372
    /// "Document Sorting as Stable"; this repo is Swift 6.3.2), so a plain `.sorted` with
    /// the same comparator would already keep insertion order on ties. `stableSorted` is
    /// kept anyway to match the SmartReplacement / PainPattern / RecentPRDelta precedents
    /// and to make the "JS insertion order on ties" intent explicit in-line — a
    /// self-documenting three-way-comparator + original-index tiebreak, NOT because the
    /// stdlib sort is unstable. `internal` (not private) so the load-bearing tie test can
    /// assert the tiebreak directly.
    static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }

    // MARK: - buildMuscleVolumeDashboard (analytics.ts:112)

    /// The minimal `WeeklyPrescription` shape the dashboard consumes
    /// (analytics.ts:116/119 — `weekStart` + `muscles[].{muscle,target}`).
    public struct WeeklyPrescriptionInput: Sendable {
        public let weekStart: String?
        public let muscles: [MuscleTarget]
        public init(weekStart: String?, muscles: [MuscleTarget]) {
            self.weekStart = weekStart; self.muscles = muscles
        }
    }

    public struct MuscleTarget: Sendable {
        public let muscle: String
        public let target: Double
        public init(muscle: String, target: Double) { self.muscle = muscle; self.target = target }
    }

    public struct MuscleVolumeDashboardRow: Equatable, Sendable {
        public let muscleId: String
        public let muscleName: String
        public let targetSets: Double
        public let completedSets: Double
        public let effectiveSets: Double
        public let highConfidenceEffectiveSets: Double
        public let weightedEffectiveSets: Double
        public let remainingSets: Double
        public let status: String
        public let notes: [String]
    }

    /// `getVolumeStatus` (analytics.ts:93).
    static func getVolumeStatus(_ weightedEffectiveSets: Double, _ targetSets: Double) -> String {
        if targetSets <= 0 { return weightedEffectiveSets > 0 ? "high" : "low" }
        let ratioToTarget = weightedEffectiveSets / targetSets
        if ratioToTarget >= 1.15 { return "high" }
        if ratioToTarget >= 0.95 { return "on_target" }
        if ratioToTarget >= 0.75 { return "near_target" }
        return "low"
    }

    /// `buildVolumeNotes` (analytics.ts:102).
    static func buildVolumeNotes(_ status: String, effectiveSets: Double, highConfidenceEffectiveSets: Double, remainingSets: Double) -> [String] {
        var notes: [String] = ["加权有效组是训练量估算，不是精确生理测量。"]
        if status == "low" { notes.append("本周还差约 \(jsNumberString(roundOne(remainingSets))) 组加权有效组。") }
        if status == "near_target" { notes.append("本周训练量接近目标，后续优先补高质量工作组。") }
        if status == "on_target" { notes.append("本周训练量已基本达标，继续保持恢复质量。") }
        if status == "high" { notes.append("本周训练量可能偏高，注意恢复和动作质量。") }
        if effectiveSets > highConfidenceEffectiveSets { notes.append("部分有效组置信度不是高，建议结合 RIR 和动作质量复查。") }
        return notes
    }

    public static func buildMuscleVolumeDashboard(
        _ history: [TrainingSession],
        _ weeklyPrescription: WeeklyPrescriptionInput?
    ) -> [MuscleVolumeDashboardRow] {
        let weekStart = truthy(weeklyPrescription?.weekStart)
        let weekSessions: [TrainingSession]
        if let weekStart {
            weekSessions = history.filter { ($0.date ?? "") >= weekStart }
        } else {
            weekSessions = Array(history.prefix(7))
        }
        let effectiveSummary = EffectiveSetEngine.buildEffectiveVolumeSummary(weekSessions)

        // targets = new Map(muscles.map([muscle, number(target)])) — ordered, dedup by muscle.
        var targets: [(muscle: String, target: Double)] = []
        func targetsSet(_ muscle: String, _ target: Double) {
            if let idx = targets.firstIndex(where: { $0.muscle == muscle }) { targets[idx].target = target }
            else { targets.append((muscle, target)) }
        }
        for item in (weeklyPrescription?.muscles ?? []) { targetsSet(item.muscle, item.target) } // number(target) ≡ target
        // Object.keys(byMuscle).forEach(muscle => if (!targets.has(muscle)) targets.set(muscle, 0))
        for entry in effectiveSummary.byMuscle where !targets.contains(where: { $0.muscle == entry.muscle }) {
            targets.append((entry.muscle, 0))
        }

        var rows: [MuscleVolumeDashboardRow] = targets.map { (muscleId, targetSets) in
            let muscleSummary = effectiveSummary.muscle(muscleId)
            let completedSets = roundOne(Double(muscleSummary?.completedSets ?? 0))
            let effectiveSets = roundOne(Double(muscleSummary?.effectiveSets ?? 0))
            let highConfidenceEffectiveSets = roundOne(Double(muscleSummary?.highConfidenceEffectiveSets ?? 0))
            let weightedEffectiveSets = roundOne(muscleSummary?.weightedEffectiveSets ?? 0)
            let remainingSets = roundOne(Swift.max(0, targetSets - weightedEffectiveSets))
            let status = getVolumeStatus(weightedEffectiveSets, targetSets)
            return MuscleVolumeDashboardRow(
                muscleId: muscleId,
                muscleName: muscleId,
                targetSets: roundOne(targetSets),
                completedSets: completedSets,
                effectiveSets: effectiveSets,
                highConfidenceEffectiveSets: highConfidenceEffectiveSets,
                weightedEffectiveSets: weightedEffectiveSets,
                remainingSets: remainingSets,
                status: status,
                notes: buildVolumeNotes(status, effectiveSets: effectiveSets, highConfidenceEffectiveSets: highConfidenceEffectiveSets, remainingSets: remainingSets)
            )
        }

        // .sort(order[status] asc || remainingSets desc). JS `Array.prototype.sort` is
        // STABLE (ES2019); Swift's `sort(by:)` is ALSO stable since Swift 5.8 (SE-0372),
        // so this keeps ties either way — `stableSorted` (original-index tiebreak) is used
        // to make the JS insertion-order-on-ties intent explicit on (status, remainingSets)
        // ties, matching the repo precedents (not because the stdlib sort is unstable).
        func statusOrder(_ s: String) -> Int {
            switch s { case "low": return 0; case "near_target": return 1; case "on_target": return 2; case "high": return 3; default: return 0 }
        }
        rows = stableSorted(rows) { left, right in
            let ol = statusOrder(left.status), or = statusOrder(right.status)
            if ol != or { return ol < or ? -1 : 1 }
            if left.remainingSets != right.remainingSets { return left.remainingSets > right.remainingSets ? -1 : 1 }
            return 0
        }
        return rows
    }

    // MARK: - buildExerciseTrend (analytics.ts:152) + trendStatus (analytics.ts:178)

    public struct ExerciseTrendPoint: Equatable, Sendable {
        public let date: String
        public let name: String
        public let topWeight: Double
        public let topReps: Double
        public let volume: Double
    }

    public static func buildExerciseTrend(_ history: [TrainingSession], _ exerciseId: String) -> [ExerciseTrendPoint] {
        var points: [ExerciseTrendPoint] = []
        for session in analyticsHistory(history) {
            for exercise in (session.exercises ?? []) where E1RMEngine.getExerciseRecordPoolId(exercise) == exerciseId {
                let sets = completedHighQualitySets(exercise)
                var topSet: TrainingSetLog? = nil
                for set in sets {
                    guard let best = topSet else { topSet = set; continue }
                    if E1RMEngine.number(set.weight) > E1RMEngine.number(best.weight) { topSet = set }
                    else if E1RMEngine.number(set.weight) == E1RMEngine.number(best.weight)
                        && E1RMEngine.number(set.reps) > E1RMEngine.number(best.reps) { topSet = set }
                }
                points.append(ExerciseTrendPoint(
                    date: session.date ?? "",
                    name: formatExerciseName(exercise),
                    topWeight: topSet != nil ? E1RMEngine.number(topSet!.weight) : 0,
                    topReps: topSet != nil ? E1RMEngine.number(topSet!.reps) : 0,
                    volume: sets.reduce(0) { $0 + AnalyticsSupport.setVolume($1) }
                ))
            }
        }
        // .filter(item => item.topWeight || item.volume).slice(0, 6)
        return Array(points.filter { $0.topWeight != 0 || $0.volume != 0 }.prefix(6))
    }

    /// `trendStatus` (analytics.ts:178).
    public static func trendStatus(_ trend: [ExerciseTrendPoint]) -> String {
        if trend.count < 3 { return "数据不足" }
        let recentBest = trend.prefix(2).map { $0.topWeight * $0.topReps }.max() ?? -Double.infinity
        let olderBest = trend.dropFirst(2).map { $0.topWeight * $0.topReps }.max() ?? -Double.infinity
        if recentBest > olderBest { return "推进中" }
        if recentBest < olderBest * 0.95 { return "回落" }
        return "可能停滞"
    }

    // MARK: - buildPrs (analytics.ts:188)

    public struct PrItem: Equatable, Sendable {
        public let key: String
        public let exerciseId: String
        public let metric: String
        public let type: String
        public let exercise: String
        public let value: Double
        public let displayValue: String
        public let raw: Double
        public let date: String
        public let quality: String
        public let reasons: [String]
    }

    /// Ordered map mirroring a JS `Map<string, PrItem>` (set on an existing key updates
    /// the value but keeps its insertion position; a new key appends).
    private struct OrderedPrMap {
        private(set) var items: [PrItem] = []
        private var index: [String: Int] = [:]
        func get(_ key: String) -> PrItem? { index[key].map { items[$0] } }
        mutating func set(_ key: String, _ value: PrItem) {
            if let i = index[key] { items[i] = value } else { index[key] = items.count; items.append(value) }
        }
    }

    public static func buildPrs(_ rawHistory: [TrainingSession]) -> [PrItem] {
        let history = analyticsHistory(rawHistory)
        var maxWeight = OrderedPrMap()
        var fixedReps = OrderedPrMap()
        var sessionTotals = OrderedPrMap()
        var estimatedMaxes = OrderedPrMap()

        for session in history {
            let sessionDate = session.date ?? ""
            for exercise in (session.exercises ?? []) {
                if E1RMEngine.hasInvalidExerciseIdentity(exercise) { continue }
                let sets = E1RMEngine.completedSets(exercise).filter { $0._unknown["type"]?.stringValue != "warmup" }
                let usableSets = completedHighQualitySets(exercise)
                let total = sets.reduce(0) { $0 + AnalyticsSupport.setVolume($1) }
                let poolId = E1RMEngine.getExerciseRecordPoolId(exercise)
                if poolId.isEmpty { continue }
                let sessionKey = "\(poolId)-volume"
                let currentSessionTotal = sessionTotals.get(sessionKey)
                let totalQuality = combineRecordQuality(sets)
                let exerciseName = formatExerciseName(exercise)

                if total != 0 && (currentSessionTotal == nil || total > currentSessionTotal!.raw) {
                    sessionTotals.set(sessionKey, PrItem(
                        key: sessionKey, exerciseId: poolId, metric: "volume", type: "单次训练总量 PR",
                        exercise: exerciseName, value: total,
                        displayValue: "\(jsNumberString(Double(AnalyticsSupport.jsMathRound(total))))kg",
                        raw: total, date: sessionDate,
                        quality: totalQuality.quality, reasons: totalQuality.reasons
                    ))
                }

                for set in usableSets {
                    let weight = E1RMEngine.number(set.weight)
                    let reps = E1RMEngine.number(set.reps)
                    let weightKey = "\(poolId)-weight"
                    let repKey = "\(poolId)-\(jsNumberString(weight))-reps"
                    let currentWeight = maxWeight.get(weightKey)
                    let quality = recordQualityForSet(set)
                    if currentWeight == nil || weight > currentWeight!.raw {
                        maxWeight.set(weightKey, PrItem(
                            key: weightKey, exerciseId: poolId, metric: "max_weight", type: "最大重量 PR",
                            exercise: exerciseName, value: weight,
                            displayValue: "\(jsNumberString(weight))kg x \(jsNumberString(reps))",
                            raw: weight, date: sessionDate,
                            quality: quality.quality, reasons: quality.reasons
                        ))
                    }
                    let currentReps = fixedReps.get(repKey)
                    if currentReps == nil || reps > currentReps!.raw {
                        fixedReps.set(repKey, PrItem(
                            key: repKey, exerciseId: poolId, metric: "reps_at_weight", type: "固定重量次数 PR",
                            exercise: exerciseName, value: reps,
                            displayValue: "\(jsNumberString(weight))kg x \(jsNumberString(reps))",
                            raw: reps, date: sessionDate,
                            quality: quality.quality, reasons: quality.reasons
                        ))
                    }
                }

                let estimate = E1RMEngine.buildE1RMProfile(history, poolId).best
                if let estimate {
                    let key = "\(poolId)-e1rm"
                    let quality = estimate.confidence == "high" ? "high_quality" : (estimate.confidence == "low" ? "low_confidence" : "standard")
                    let current = estimatedMaxes.get(key)
                    if current == nil || estimate.e1rmKg > current!.raw {
                        estimatedMaxes.set(key, PrItem(
                            key: key, exerciseId: poolId, metric: "estimated_1rm", type: "估算 1RM PR",
                            exercise: exerciseName, value: estimate.e1rmKg,
                            displayValue: "\(jsNumberString(estimate.e1rmKg))kg",
                            raw: estimate.e1rmKg, date: estimate.sourceSet.date,
                            quality: quality, reasons: estimate.notes
                        ))
                    }
                }
            }
        }

        var combined = maxWeight.items + fixedReps.items + sessionTotals.items + estimatedMaxes.items
        // .sort((a, b) => b.date.localeCompare(a.date)) — descending date. JS
        // `Array.prototype.sort` is STABLE, so equal-date PRs keep their insertion order
        // (maxWeight → fixedReps → sessionTotals → estimatedMaxes); Swift's sort is ALSO
        // stable since Swift 5.8 (SE-0372), so `stableSorted` pins that order as an
        // explicit, self-documenting tiebreak (not because the stdlib sort is unstable).
        combined = stableSorted(combined) { left, right in
            left.date != right.date ? (left.date > right.date ? -1 : 1) : 0
        }
        return Array(combined.prefix(8))
    }

    // MARK: - buildWeeklyReport (analytics.ts:293) — zero `: Date` (injected `asOfDate`)

    public struct BodyWeight: Sendable {
        public let value: Double?
        public init(value: Double?) { self.value = value }
    }

    /// `buildWeeklyReport` (analytics.ts:293). `asOfDate` is the §11.2 injected clock (the
    /// generator passes deterministicClockIso); the live UI's `new Date()` is NOT reproduced.
    /// The 7-day window mirrors `new Date(now) ; setDate(getDate()-7)` as exact UTC ms
    /// arithmetic — `start = new Date(now.getTime() - 7 * 86_400_000)` — over the SAME
    /// `new Date(value)` parse the legacy web schema injected-clock path uses (E1RMEngine.safeDateMs).
    public static func buildWeeklyReport(_ rawHistory: [TrainingSession], _ bodyWeights: [BodyWeight], asOfDate: String) -> String {
        let history = analyticsHistory(rawHistory)
        let nowMs = E1RMEngine.safeDateMs(asOfDate) ?? 0
        let startMs = nowMs - 7 * 86_400_000 // new Date(now.getTime() - 7 * 86_400_000)
        let sessions = history.filter { session in
            guard let d = E1RMEngine.safeDateMs(session.date) else { return false } // new Date(undefined) → NaN ≥ start === false
            return d >= startMs
        }
        let volume = sessions.reduce(0) { $0 + sessionVolume($1) }
        let setsCount = sessions.reduce(0) { $0 + sessionCompletedSets($1) }
        let effectiveSummary = EffectiveSetEngine.buildEffectiveVolumeSummary(sessions)
        let latestWeight = bodyWeights.first?.value

        // focus = reduce(key = focus || templateName; acc[key] += 1) — ordered.
        var focus: [(key: String, count: Int)] = []
        for session in sessions {
            let key = truthy(session._unknown["focus"]?.stringValue)
                ?? truthy(session._unknown["templateName"]?.stringValue)
                ?? "undefined"
            if let idx = focus.firstIndex(where: { $0.key == key }) { focus[idx].count += 1 }
            else { focus.append((key, 1)) }
        }
        let focusJoined = focus.map { "\($0.key)\($0.count)次" }.joined(separator: " / ")
        let focusText = focusJoined.isEmpty ? "暂无" : focusJoined

        let weightText = (latestWeight != nil && latestWeight! != 0) ? "\(jsNumberString(latestWeight!))kg" : "未记录"

        return [
            "训练次数：\(sessions.count)",
            "完成组数：\(jsNumberString(setsCount))",
            "有效组数：\(effectiveSummary.effectiveSets)（有效分 \(jsNumberString(effectiveSummary.effectiveScore))）",
            "总训练量：\(jsNumberString(Double(AnalyticsSupport.jsMathRound(volume))))kg",
            "训练分布：\(focusText)",
            "当前体重：\(weightText)",
        ].joined(separator: "\n")
    }

    // MARK: - buildAdherenceReport (analytics.ts:406)

    public struct AdherenceSessionRow: Equatable, Sendable {
        public let sessionId: String
        public let date: String
        public let templateName: String
        public let plannedSets: Double
        public let actualSets: Double
        public let adherenceRate: Double
        public let mainPlannedSets: Double
        public let mainActualSets: Double
        public let correctionPlannedSets: Double
        public let correctionActualSets: Double
        public let functionalPlannedSets: Double
        public let functionalActualSets: Double
        public let hasSupportData: Bool
    }

    public struct SkippedExercise: Equatable, Sendable {
        public let exerciseId: String
        public let count: Double
        public let mostCommonReason: String?
    }

    public struct SkippedSupportExercise: Equatable, Sendable {
        public let exerciseId: String
        public let moduleId: String
        public let blockType: String
        public let count: Double
        public let mostCommonReason: String?
    }

    public struct AdherenceReport: Equatable, Sendable {
        public let recentSessionCount: Double
        public let plannedSets: Double
        public let actualSets: Double
        public let overallRate: Double
        public let mainlineRate: Double
        public let correctionRate: Double?
        public let functionalRate: Double?
        public let recentSessions: [AdherenceSessionRow]
        public let skippedExercises: [SkippedExercise]
        public let skippedSupportExercises: [SkippedSupportExercise]
        public let suggestions: [String]
        public let confidence: String
    }

    /// `setCountForExercise` (analytics.ts:50): array form → `.length`; else `number(sets)`.
    static func setCountForExercise(_ exercise: ExercisePrescription) -> Double {
        if let arr = exercise.sets { return Double(arr.count) }
        return E1RMEngine.number(exercise._unknown["sets"]?.numberValue)
    }

    /// `supportPlannedFromBlock` (analytics.ts:53).
    static func supportPlannedFromBlock(_ session: TrainingSession, _ blockType: String) -> Double {
        let key = blockType == "correction" ? "correctionBlock" : "functionalBlock"
        let blocks = session._unknown[key]?.arrayValue ?? []
        return blocks.reduce(0) { sum, module in
            let exercises = module.objectValue?["exercises"]?.arrayValue ?? []
            return sum + exercises.reduce(0) { $0 + Swift.max(0, E1RMEngine.number($1.objectValue?["sets"]?.numberValue)) }
        }
    }

    /// Ordered reason counter mirroring a JS `Record<string, number>` built by
    /// `incrementReason` (insertion order; `mostCommonReason` reads the first max key).
    private struct ReasonCounter {
        private(set) var entries: [(reason: String, count: Int)] = []
        mutating func increment(_ reason: String?) { // incrementReason (analytics.ts:43)
            guard let reason, !reason.isEmpty else { return } // if (!reason) return
            if let idx = entries.firstIndex(where: { $0.reason == reason }) { entries[idx].count += 1 }
            else { entries.append((reason, 1)) }
        }
        /// `mostCommonReason` (analytics.ts:47): max count, first-inserted among ties, or nil.
        var mostCommon: String? {
            entries.enumerated().max(by: { a, b in
                a.element.count != b.element.count ? a.element.count < b.element.count : a.offset > b.offset
            })?.element.reason
        }
    }

    private struct SkipAggregate { var count: Int = 0; var reasons = ReasonCounter() }

    public static func buildAdherenceReport(_ rawHistory: [TrainingSession]) -> AdherenceReport {
        let history = analyticsHistory(rawHistory)
        let recentSessions = Array(history.prefix(7))
        var skippedExercises: [(key: String, agg: SkipAggregate)] = []
        var skippedSupportExercises: [(key: String, agg: SkipAggregate)] = []
        var supportReasonCounts = ReasonCounter()

        var plannedSets: Double = 0
        var actualSets: Double = 0
        var mainPlannedSets: Double = 0
        var mainActualSets: Double = 0
        var correctionPlannedSets: Double = 0
        var correctionActualSets: Double = 0
        var functionalPlannedSets: Double = 0
        var functionalActualSets: Double = 0
        var supportDataSessions: Double = 0

        func upsertSkip(_ list: inout [(key: String, agg: SkipAggregate)], _ key: String, _ mutate: (inout SkipAggregate) -> Void) {
            if let idx = list.firstIndex(where: { $0.key == key }) { mutate(&list[idx].agg) }
            else { var agg = SkipAggregate(); mutate(&agg); list.append((key, agg)) }
        }

        var sessionRows: [AdherenceSessionRow] = []
        for session in recentSessions {
            let exercises = session.exercises ?? []
            let mainPlanned = exercises.reduce(0) { $0 + setCountForExercise($1) }
            let mainActual = exercises.reduce(0) { $0 + Double(E1RMEngine.completedSets($1).count) }
            let supportLogs = session._unknown["supportExerciseLogs"]?.arrayValue ?? []
            let hasSupportData = !supportLogs.isEmpty

            func sumSupport(_ block: String, _ field: (OrderedJSONObject) -> Double) -> Double {
                guard hasSupportData else { return 0 }
                return supportLogs.reduce(0) { sum, item in
                    guard let obj = item.objectValue, obj["blockType"]?.stringValue == block else { return sum }
                    return sum + field(obj)
                }
            }
            let correctionPlanned = sumSupport("correction") { E1RMEngine.number($0["plannedSets"]?.numberValue) }
            let correctionActual = sumSupport("correction") { Swift.min(E1RMEngine.number($0["completedSets"]?.numberValue), E1RMEngine.number($0["plannedSets"]?.numberValue)) }
            let functionalPlanned = sumSupport("functional") { E1RMEngine.number($0["plannedSets"]?.numberValue) }
            let functionalActual = sumSupport("functional") { Swift.min(E1RMEngine.number($0["completedSets"]?.numberValue), E1RMEngine.number($0["plannedSets"]?.numberValue)) }

            plannedSets += mainPlanned + correctionPlanned + functionalPlanned
            actualSets += mainActual + correctionActual + functionalActual
            mainPlannedSets += mainPlanned
            mainActualSets += mainActual
            correctionPlannedSets += correctionPlanned
            correctionActualSets += correctionActual
            functionalPlannedSets += functionalPlanned
            functionalActualSets += functionalActual
            if hasSupportData { supportDataSessions += 1 }

            for exercise in exercises {
                let planned = setCountForExercise(exercise)
                let actual = Double(E1RMEngine.completedSets(exercise).count)
                if planned > actual {
                    let key = truthy(exercise._unknown["baseId"]?.stringValue) ?? (exercise.id ?? "") // ex.baseId || ex.id
                    upsertSkip(&skippedExercises, key) { $0.count += 1 }
                }
            }

            for item in supportLogs {
                guard let obj = item.objectValue else { continue }
                if E1RMEngine.number(obj["completedSets"]?.numberValue) >= E1RMEngine.number(obj["plannedSets"]?.numberValue) { continue }
                let moduleId = obj["moduleId"]?.stringValue ?? ""
                let exerciseId = obj["exerciseId"]?.stringValue ?? ""
                let blockType = obj["blockType"]?.stringValue ?? ""
                let key = "\(moduleId):\(exerciseId):\(blockType)"
                let skippedReason = obj["skippedReason"]?.stringValue
                upsertSkip(&skippedSupportExercises, key) { $0.count += 1; $0.reasons.increment(skippedReason) }
                supportReasonCounts.increment(skippedReason)
            }

            let rowPlanned = mainPlanned + correctionPlanned + functionalPlanned
            let rowActual = mainActual + correctionActual + functionalActual
            sessionRows.append(AdherenceSessionRow(
                sessionId: session.id ?? "",
                date: session.date ?? "",
                templateName: session._unknown["templateName"]?.stringValue ?? "",
                plannedSets: rowPlanned,
                actualSets: rowActual,
                adherenceRate: ratio(rowActual, rowPlanned),
                mainPlannedSets: mainPlanned,
                mainActualSets: mainActual,
                correctionPlannedSets: correctionPlanned != 0 ? correctionPlanned : (hasSupportData ? 0 : supportPlannedFromBlock(session, "correction")),
                correctionActualSets: correctionActual,
                functionalPlannedSets: functionalPlanned != 0 ? functionalPlanned : (hasSupportData ? 0 : supportPlannedFromBlock(session, "functional")),
                functionalActualSets: functionalActual,
                hasSupportData: hasSupportData
            ))
        }

        let overallRate = ratio(actualSets, plannedSets)
        let mainlineRate = ratio(mainActualSets, mainPlannedSets)
        let correctionRate: Double? = correctionPlannedSets > 0 ? ratio(correctionActualSets, correctionPlannedSets) : nil
        let functionalRate: Double? = functionalPlannedSets > 0 ? ratio(functionalActualSets, functionalPlannedSets) : nil

        var suggestions: [String] = []
        let topSkipReason = supportReasonCounts.mostCommon
        if overallRate < 70 { suggestions.append("最近整体完成率偏低，下周先降低复杂度，让计划更容易执行。") }
        if mainlineRate < 75 { suggestions.append("主训练完成率也在下降，下周建议把周训练量下修 10%-20%。") }
        if let c = correctionRate, c < 60 { suggestions.append("纠偏模块经常做不完，先缩到最小有效剂量。") }
        if let f = functionalRate, f < 60 { suggestions.append("功能补丁完成率偏低，先只保留最关键的一项。") }
        if topSkipReason == "time" { suggestions.append("最近最常见的跳过原因是时间不足，优先缩短训练而不是继续堆内容。") }
        if topSkipReason == "pain" { suggestions.append("最近有较多因为不适而跳过的记录，下周应优先替代动作或降低负荷。") }
        if suggestions.isEmpty { suggestions.append("最近完成度稳定，可以继续按当前结构推进。") }

        let supportCoverage = !recentSessions.isEmpty ? supportDataSessions / Double(recentSessions.count) : 1
        let confidence = supportCoverage >= 0.75 ? "high" : (supportCoverage >= 0.35 ? "medium" : "low")

        // skippedExercises: map → sort by count desc → slice(0,5). JS Array.sort is
        // STABLE, so equal-count rows keep the Map insertion (first-seen) order; Swift's
        // sort is ALSO stable since Swift 5.8 (SE-0372), so `stableSorted` reproduces that
        // as an explicit, self-documenting tiebreak (not because the stdlib sort is unstable).
        var skippedExerciseRows = skippedExercises.map { (key, agg) in
            SkippedExercise(exerciseId: key, count: Double(agg.count), mostCommonReason: agg.reasons.mostCommon)
        }
        skippedExerciseRows = stableSorted(skippedExerciseRows) { $0.count != $1.count ? ($0.count > $1.count ? -1 : 1) : 0 }
        let skippedExerciseTop = Array(skippedExerciseRows.prefix(5))

        var skippedSupportRows = skippedSupportExercises.map { (key, agg) -> SkippedSupportExercise in
            let parts = key.split(separator: ":", omittingEmptySubsequences: false).map(String.init)
            return SkippedSupportExercise(
                exerciseId: parts.count > 1 ? parts[1] : "",
                moduleId: parts.count > 0 ? parts[0] : "",
                blockType: parts.count > 2 ? parts[2] : "",
                count: Double(agg.count),
                mostCommonReason: agg.reasons.mostCommon
            )
        }
        // sort by count desc → slice(0,6); JS-stable insertion order on count ties via stableSorted.
        skippedSupportRows = stableSorted(skippedSupportRows) { $0.count != $1.count ? ($0.count > $1.count ? -1 : 1) : 0 }
        let skippedSupportTop = Array(skippedSupportRows.prefix(6))

        return AdherenceReport(
            recentSessionCount: Double(recentSessions.count),
            plannedSets: plannedSets,
            actualSets: actualSets,
            overallRate: overallRate,
            mainlineRate: mainlineRate,
            correctionRate: correctionRate,
            functionalRate: functionalRate,
            recentSessions: sessionRows,
            skippedExercises: skippedExerciseTop,
            skippedSupportExercises: skippedSupportTop,
            suggestions: suggestions,
            confidence: confidence
        )
    }

    // MARK: - formatExerciseName (i18n/formatters.ts:492 → ExerciseLibrary.formatExerciseDisplayName)

    /// `formatExerciseName(exercise)` (formatters.ts:492) =
    /// `formatExerciseDisplayName(exercise, { fallback: '未命名动作' })` over the FULL
    /// exercise object (id / name / nameZh / actual/replacement/canonical ids). The decoded
    /// `ExercisePrescription` is re-encoded to its `JSONValue` so the SR-1 ported
    /// `ExerciseLibrary.formatExerciseDisplayName` reads the SAME field set legacy web schema sees.
    static func formatExerciseName(_ exercise: ExercisePrescription) -> String {
        ExerciseLibrary.formatExerciseDisplayName(exercise.encoded(), bilingual: false, fallback: "未命名动作")
    }
}
