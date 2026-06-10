// TodayPrescriptionEngine — 今日处方（M2-2）：今天练什么、几组、多重、几次。
//
// 纯函数：吃 CleanTrainingDecisionInput + M2-1 裁决（不重复判断练不练），
// 同输入必同输出（goldens 锁定）。日计划不是冻结模板：由「槽位规则 × 目录
// 顺序第一个未用且匹配」从 catalog 现算（FR-ON3：不锁死硬编码模板，可重算）；
// 槽位的组数/次数区间是生成参数，沿 legacy 模板口径（事实性复用，已留痕）。
//
// 最小渐进 = 双重渐进三分支（goldens 锁定阈值）。RIR 一律取 min 口径
// （最差一组）：任何一组打到力竭就不该加重——安全优先于抗噪，这是显式
// 产品拍板（2026-06-09 审查后），改口径必须连 §6.0.1 与 goldens 一起改：
//   全组打满 repMax 且 min RIR ≥ 1.0(含 1.0；无 RIR 数据视为有余力) → +2.5kg，次数重置 repMin；
//   上次力竭(min RIR ≤ 0.5) 或 最高组未到 repMin → −2.5kg；
//   否则持平，次数目标 repMax（区间内推进）。
// 加重无上限（精英重量合法递增，有意为之）。
// 裁决调制在渐进之后：light ×0.9；deload ×0.8 且组数 −1(下限 2)；rest → 无处方。
// 重量一律 2.5kg 取整、下限 2.5kg；调制后若取整弹回原重量且原重量 > 2.5，
// 强制下调一格——轻练/减载必须真减，小重量动作不得被取整吃掉。
// 组形（top/backoff 拆分）归 M3-1。

import Foundation
import RedeDataHealth

public enum TodayPrescriptionEngine {
    private static let incrementKg = 2.5
    private static let nearFailureMeanRir = 0.5
    private static let progressMinMeanRir = 1.0
    private static let lightMultiplier = 0.9
    private static let deloadMultiplier = 0.8
    private static let targetRir = 2.0

    /// 槽位 = 生成规则：按 pattern（可选 kind/equipment 收窄）在 catalog
    /// 声明顺序里取第一个未用条目。
    struct Slot {
        let pattern: String
        var kind: String?
        var equipment: String?
        let sets: Int
        let repMin: Int
        let repMax: Int
        let rest: Int
    }

    static func daySequence(splitType: String?) -> [String] {
        let normalized = (splitType ?? "").lowercased()
        if normalized.contains("push") || normalized.contains("ppl") {
            return ["push-a", "pull-a", "legs-a"]
        }
        return ["upper", "lower"]
    }

    static func slots(dayCode: String) -> [Slot] {
        switch dayCode {
        case "push-a":
            return [
                Slot(pattern: "horizontal-press", kind: "compound", sets: 3, repMin: 6, repMax: 8, rest: 180),
                Slot(pattern: "incline-press", sets: 3, repMin: 8, repMax: 10, rest: 120),
                Slot(pattern: "horizontal-press", kind: "machine", sets: 2, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "fly", sets: 2, repMin: 12, repMax: 15, rest: 75),
                Slot(pattern: "lateral-raise", sets: 4, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "triceps-extension", sets: 3, repMin: 10, repMax: 15, rest: 75),
            ]
        case "pull-a":
            return [
                Slot(pattern: "vertical-pull", sets: 3, repMin: 8, repMax: 10, rest: 120),
                Slot(pattern: "horizontal-pull", equipment: "cable", sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "horizontal-pull", equipment: "barbell", sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "rear-delt", sets: 3, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "curl", sets: 3, repMin: 8, repMax: 12, rest: 75),
                Slot(pattern: "curl", sets: 2, repMin: 10, repMax: 15, rest: 75),
            ]
        case "legs-a":
            return [
                Slot(pattern: "squat-pattern", kind: "compound", equipment: "barbell", sets: 4, repMin: 5, repMax: 8, rest: 210),
                Slot(pattern: "hinge", equipment: "barbell", sets: 3, repMin: 6, repMax: 10, rest: 180),
                Slot(pattern: "squat-pattern", kind: "machine", sets: 3, repMin: 10, repMax: 15, rest: 120),
                Slot(pattern: "knee-flexion", sets: 3, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "calf-raise", sets: 4, repMin: 10, repMax: 20, rest: 60),
            ]
        case "lower":
            return [
                Slot(pattern: "squat-pattern", kind: "compound", equipment: "machine", sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "hinge", equipment: "dumbbell", sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "squat-pattern", kind: "machine", sets: 3, repMin: 10, repMax: 15, rest: 120),
                Slot(pattern: "knee-flexion", sets: 3, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "calf-raise", sets: 4, repMin: 12, repMax: 20, rest: 60),
            ]
        default: // "upper"
            return [
                Slot(pattern: "horizontal-press", equipment: "dumbbell", sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "vertical-pull", sets: 3, repMin: 8, repMax: 10, rest: 120),
                Slot(pattern: "vertical-press", sets: 3, repMin: 6, repMax: 10, rest: 120),
                Slot(pattern: "horizontal-pull", equipment: "dumbbell", sets: 3, repMin: 8, repMax: 12, rest: 90),
                Slot(pattern: "lateral-raise", sets: 3, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "triceps-extension", sets: 2, repMin: 10, repMax: 15, rest: 60),
                Slot(pattern: "curl", equipment: "dumbbell", sets: 2, repMin: 10, repMax: 15, rest: 60),
            ]
        }
    }

    public static func plan(
        input: CleanTrainingDecisionInput,
        verdict: TodayVerdict,
        catalog: ExerciseCatalog = .minimal
    ) -> TodayPrescription? {
        guard verdict.call != .rest else { return nil }

        let sequence = daySequence(splitType: input.program.splitType)
        let dayCode = sequence[input.sessions.count % sequence.count]

        var dayReasons: [DayPrescriptionReason] = []
        var usedIds: Set<String> = []
        var exercises: [ExercisePrescriptionPlan] = []

        for slot in slots(dayCode: dayCode) {
            guard let entry = catalog.entries.first(where: { entry in
                entry.movementPattern == slot.pattern
                    && (slot.kind == nil || entry.kind == slot.kind)
                    && (slot.equipment == nil || entry.equipment == slot.equipment)
                    && !usedIds.contains(entry.id)
            }) else {
                dayReasons.append(.slotUnfilled(pattern: slot.pattern))
                continue
            }
            usedIds.insert(entry.id)
            exercises.append(prescribe(entry: entry, slot: slot, input: input, verdict: verdict))
        }

        switch verdict.call {
        case .light: dayReasons.append(.verdictLightReduced)
        case .deload: dayReasons.append(.verdictDeloadReduced)
        case .train, .rest: break
        }

        return TodayPrescription(dayCode: dayCode, exercises: exercises, dayReasons: dayReasons)
    }

    // MARK: 单动作渐进 + 裁决调制

    private static func prescribe(
        entry: ExerciseCatalogEntry,
        slot: Slot,
        input: CleanTrainingDecisionInput,
        verdict: TodayVerdict
    ) -> ExercisePrescriptionPlan {
        let last = lastPerformance(exerciseId: entry.id, sessions: input.sessions)

        let baseWeight: Double
        let targetReps: Int
        let change: ChangeDirection
        let reason: PrescriptionReason
        if let last {
            if let minRir = last.minRir, minRir <= nearFailureMeanRir {
                baseWeight = max(incrementKg, last.topWeightKg - incrementKg)
                targetReps = slot.repMin
                change = .ease
                reason = .nearFailureLastTime
            } else if last.maxReps < slot.repMin {
                baseWeight = max(incrementKg, last.topWeightKg - incrementKg)
                targetReps = slot.repMin
                change = .ease
                reason = .belowRepFloor
            } else if last.minReps >= slot.repMax, last.minRir.map({ $0 >= progressMinMeanRir }) ?? true {
                // 无上限：精英重量的 +2.5kg 是合法递增，有意不设 cap。
                baseWeight = last.topWeightKg + incrementKg
                targetReps = slot.repMin
                change = .increase
                reason = .repCeilingReached
            } else {
                baseWeight = last.topWeightKg
                targetReps = slot.repMax
                change = .hold
                reason = .holdProgressing
            }
        } else {
            baseWeight = entry.startWeightKg
            targetReps = slot.repMin
            change = .start
            reason = .firstExposure
        }

        var weight = roundToIncrement(baseWeight)
        var sets = slot.sets
        switch verdict.call {
        case .light:
            weight = modulated(base: weight, multiplier: lightMultiplier)
        case .deload:
            weight = modulated(base: weight, multiplier: deloadMultiplier)
            sets = max(2, sets - 1)
        case .train, .rest:
            break
        }

        return ExercisePrescriptionPlan(
            exerciseId: entry.id,
            sets: sets,
            restSeconds: slot.rest,
            repLowerBound: slot.repMin,
            repUpperBound: slot.repMax,
            targetReps: targetReps,
            targetWeightKg: weight,
            targetRir: targetRir,
            previousWeightKg: last?.topWeightKg,
            previousTopReps: last?.repsAtTop,
            nextProjectedWeightKg: roundToIncrement(weight + incrementKg),
            change: change,
            reason: reason
        )
    }

    /// 轻练/减载的实际负重：×乘数后 2.5 取整；若弹回原值且仍有下调空间，
    /// 强制下调一格（调制必须真减，小重量不得被取整吃掉）。
    private static func modulated(base: Double, multiplier: Double) -> Double {
        let rounded = roundToIncrement(base * multiplier)
        guard rounded >= base, base > incrementKg else { return rounded }
        return max(incrementKg, base - incrementKg)
    }

    private struct LastPerformance {
        let topWeightKg: Double
        /// 顶组（最重一组）的次数。
        let repsAtTop: Int
        let minReps: Int
        let maxReps: Int
        /// min 口径：最差一组的 RIR（安全优先，见文件头拍板说明）。
        let minRir: Double?
    }

    /// 最近一次包含该动作的 session（按天序号最大者）的工作组摘要。
    private static func lastPerformance(
        exerciseId: String,
        sessions: [CleanTrainingSession]
    ) -> LastPerformance? {
        let candidates = sessions.compactMap { session -> (day: Int, sets: [CleanLoggedSet])? in
            guard let day = TrainingDay.dayNumber(fromISO: session.date) else { return nil }
            let sets = session.exercises.filter { $0.exerciseId == exerciseId }.flatMap(\.sets)
            guard !sets.isEmpty else { return nil }
            return (day, sets)
        }
        guard let latest = candidates.max(by: { $0.day < $1.day }) else { return nil }

        let reps = latest.sets.map(\.reps)
        let rirs = latest.sets.compactMap(\.rir)
        let topSet = latest.sets.max { $0.weight < $1.weight }
        return LastPerformance(
            topWeightKg: topSet?.weight ?? 0,
            repsAtTop: topSet?.reps ?? 0,
            minReps: reps.min() ?? 0,
            maxReps: reps.max() ?? 0,
            minRir: rirs.min()
        )
    }

    private static func roundToIncrement(_ weightKg: Double) -> Double {
        max(incrementKg, (weightKg / incrementKg).rounded() * incrementKg)
    }
}
