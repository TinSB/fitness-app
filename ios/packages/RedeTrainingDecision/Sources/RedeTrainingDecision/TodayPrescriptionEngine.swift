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
//   全组打满 repMax 且 min RIR ≥ 1.0(含 1.0；无 RIR 数据视为有余力) → +一档，次数重置 repMin；
//   上次力竭(min RIR ≤ 0.5) 或 最高组未到 repMin → −一档；
//   否则持平，次数目标 repMax（区间内推进）。
// 加重无上限（精英重量合法递增，有意为之）。
// 「一档」= 该动作器械×用户单位的真实档位步长（LoadGrid，2026-06-13「宁大勿小」）：
// kg+自由重量=2.5（与旧口径等价，goldens 零变化）；lb=5lb 真实格子；选重机更粗。
// 裁决调制在渐进之后：light ×0.9；deload ×0.8 且组数 −1(下限 2)；rest → 无处方。
// 重量一律按步长取整、下限一档；调制后若取整弹回原重量且原重量 > 一档，
// 强制下调一格——轻练/减载必须真减，小重量动作不得被取整吃掉。
// 组形（top/backoff 拆分）归 M3-1。

import Foundation
import RedeDataHealth

public enum TodayPrescriptionEngine {
    private static let nearFailureMeanRir = 0.5
    private static let progressMinMeanRir = 1.0
    // 自重次数进阶（owner 拍板 2026-06-13）：起步 12、上限 25 提示换难度、下限 8。
    private static let bodyweightStartReps = 12
    private static let bodyweightRepCeiling = 25
    private static let bodyweightRepFloor = 8
    private static let bodyweightRepStep = 2
    private static let lightMultiplier = 0.9
    private static let deloadMultiplier = 0.8
    private static let targetRir = 2.0

    /// 槽位 = 生成规则：按 pattern（可选 kind/equipment 收窄）在 catalog
    /// 声明顺序里取第一个未用条目。
    struct Slot {
        let pattern: String
        var kind: String?
        /// 槽位器械偏好（类集合）：单器械槽 = 单元素集；「固定器械」槽 =
        /// EquipmentRegistry.machineClasses（machine 拆分后不再有 "machine" 字面量）。
        var equipment: Set<String>?
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
                Slot(pattern: "horizontal-press", kind: "accessory", sets: 2, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "fly", sets: 2, repMin: 12, repMax: 15, rest: 75),
                Slot(pattern: "lateral-raise", sets: 4, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "triceps-extension", sets: 3, repMin: 10, repMax: 15, rest: 75),
            ]
        case "pull-a":
            return [
                Slot(pattern: "vertical-pull", sets: 3, repMin: 8, repMax: 10, rest: 120),
                Slot(pattern: "horizontal-pull", equipment: ["cable"], sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "horizontal-pull", equipment: ["barbell"], sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "rear-delt", sets: 3, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "curl", sets: 3, repMin: 8, repMax: 12, rest: 75),
                Slot(pattern: "curl", sets: 2, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "shrug", sets: 3, repMin: 10, repMax: 15, rest: 60),
            ]
        case "legs-a":
            return [
                Slot(pattern: "squat-pattern", kind: "compound", equipment: ["barbell"], sets: 4, repMin: 5, repMax: 8, rest: 210),
                Slot(pattern: "hinge", equipment: ["barbell"], sets: 3, repMin: 6, repMax: 10, rest: 180),
                Slot(pattern: "squat-pattern", kind: "accessory", sets: 3, repMin: 10, repMax: 15, rest: 120),
                Slot(pattern: "knee-extension", sets: 3, repMin: 12, repMax: 15, rest: 75),
                Slot(pattern: "knee-flexion", sets: 3, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "calf-raise", sets: 4, repMin: 10, repMax: 20, rest: 60),
                Slot(pattern: "core", sets: 3, repMin: 12, repMax: 20, rest: 60),
            ]
        case "lower":
            return [
                Slot(pattern: "squat-pattern", kind: "compound", equipment: EquipmentRegistry.machineClasses, sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "hinge", equipment: ["dumbbell"], sets: 3, repMin: 8, repMax: 12, rest: 120),
                Slot(pattern: "squat-pattern", kind: "accessory", sets: 3, repMin: 10, repMax: 15, rest: 120),
                Slot(pattern: "knee-extension", sets: 3, repMin: 12, repMax: 15, rest: 75),
                Slot(pattern: "knee-flexion", sets: 3, repMin: 10, repMax: 15, rest: 75),
                Slot(pattern: "calf-raise", sets: 4, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "core", sets: 3, repMin: 12, repMax: 20, rest: 60),
            ]
        default: // "upper"
            return [
                Slot(pattern: "horizontal-press", equipment: ["dumbbell"], sets: 3, repMin: 6, repMax: 10, rest: 150),
                Slot(pattern: "vertical-pull", sets: 3, repMin: 8, repMax: 10, rest: 120),
                Slot(pattern: "vertical-press", sets: 3, repMin: 6, repMax: 10, rest: 120),
                Slot(pattern: "horizontal-pull", equipment: ["dumbbell"], sets: 3, repMin: 8, repMax: 12, rest: 90),
                Slot(pattern: "lateral-raise", sets: 3, repMin: 12, repMax: 20, rest: 60),
                Slot(pattern: "triceps-extension", sets: 2, repMin: 10, repMax: 15, rest: 60),
                Slot(pattern: "curl", equipment: ["dumbbell"], sets: 2, repMin: 10, repMax: 15, rest: 60),
                Slot(pattern: "shrug", sets: 3, repMin: 10, repMax: 15, rest: 60),
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

        // FR-EQ1（2026-06-11）：场景白名单硬过滤候选；槽位 equipment/machine-kind
        // 偏好与白名单冲突时软化（保 pattern 在可用器械里匹配），槽位无解=如实 unfilled。
        let allowed = EquipmentAccess.allowed(for: input.profile.equipmentScenario)

        var dayReasons: [DayPrescriptionReason] = []
        var usedIds: Set<String> = []
        var exercises: [ExercisePrescriptionPlan] = []

        // sticky swaps（wave-9，owner 拍板）：pattern 在当日**唯一出现**的槽，优先
        //「上次该 pattern 实际做的动作」（含换动作换入的）；同 pattern 多槽不 sticky
        //（歧义，回退 rank 默认）。让换动作选择跨天粘住，并使 prescribeAssisted 的
        // 进阶/冷启动/毕业经今日页可达（辅助引体不再每次靠手动换）。
        let daySlots = slots(dayCode: dayCode)
        let patternCounts = daySlots.reduce(into: [String: Int]()) { $0[$1.pattern, default: 0] += 1 }
        let lastActual = lastActualByPattern(sessions: input.sessions, catalog: catalog)

        for slot in daySlots {
            // 槽位器械偏好按类集合匹配；与白名单求交，交集空 = 偏好软化
            //（单元素集行为与旧单值严格等价）
            let slotEquipment: Set<String>? = slot.equipment.flatMap { pref in
                guard let allowed else { return pref }
                let usable = pref.intersection(allowed)
                return usable.isEmpty ? nil : usable
            }
            // kind 只软化 "accessory"（辅助容量槽默认住在固定器械上）；
            // "compound" 永不软化——动作性质约束（如深蹲主槽必须复合）与器械
            // 可得性无关。软化键 = 白名单 ∩ 注册表 machine 类（不再拴字符串
            // "machine"——P1 拆 plate-loaded/selectorized 后零改动）。
            let slotKind = slot.kind.flatMap { kind in
                (kind == "accessory" && allowed != nil
                    && allowed!.isDisjoint(with: EquipmentRegistry.machineClasses)) ? nil : kind
            }
            // 内容系统 P0（2026-06-11）：匹配去顺序化——(rank, id) 升序取首，
            // 文件顺序不再是合同；deprecated 条目不参与匹配（id 永生只为历史解析）
            let candidates = catalog.entries.filter { entry in
                !entry.deprecated
                    // §6.1：非 external 负重语义未获引擎支持，禁入处方
                    //（assisted 直接走现瀑布会方向反转——安全红线）
                    && EquipmentRegistry.prescribableLoadTypes.contains(entry.loadType)
                    && entry.movementPattern == slot.pattern
                    && (slotKind == nil || entry.kind == slotKind)
                    && (slotEquipment == nil || slotEquipment!.contains(entry.equipment))
                    && (allowed == nil || allowed!.contains(entry.equipment))
                    && !usedIds.contains(entry.id)
            }
            // sticky：唯一 pattern 槽优先「上次实际做的」（须仍是合法候选）；否则 rank 最小。
            let stickyPick = patternCounts[slot.pattern] == 1
                ? lastActual[slot.pattern].flatMap { pref in candidates.first { $0.id == pref } }
                : nil
            guard let entry = stickyPick ?? candidates.min(by: { ($0.rank, $0.id) < ($1.rank, $1.id) })
            else {
                dayReasons.append(.slotUnfilled(pattern: slot.pattern))
                continue
            }
            usedIds.insert(entry.id)
            exercises.append(prescribe(entry: entry, slot: slot, input: input, verdict: verdict, catalog: catalog))
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
        verdict: TodayVerdict,
        catalog: ExerciseCatalog
    ) -> ExercisePrescriptionPlan {
        let last = lastPerformance(exerciseId: entry.id, sessions: input.sessions)

        // 自重分支（2026-06-13，owner 拍板）：无外部负重，按次数进阶；到顶提示换难度。
        // 重量轴的渐进/取整/调制全部不适用——单独一条路径。
        if entry.loadType == "bodyweight" {
            return prescribeBodyweight(entry: entry, slot: slot, last: last, verdict: verdict)
        }

        // 弹力带分支（wave-12，owner 拍板 A 案「按次数进阶」）：复用自重引擎（无 kg 轴、按次数），
        // 唯一分叉是到顶 reason——弹力带换更重的带子（.bandCeilingReached）才是真实进阶路径，
        // 不是自重的「加配重/换更难变体」。loadType 透传 band 供显示层判定（同自重渲染：仅次数）。
        if entry.loadType == "band" {
            return prescribeBodyweight(
                entry: entry, slot: slot, last: last, verdict: verdict,
                loadType: "band", ceilingReason: .bandCeilingReached
            )
        }

        // 辅助器械分支（wave-9，owner 拍板）：辅助量轴方向反转——进阶=减辅助、
        // 挣扎/力竭=加辅助、轻练/减载=加辅助、新手冷启动=更多辅助、降到最小一片
        // 还有余力=毕业换自重孪生。绝不把 external 减重瀑布套上去（安全方向反转红线）。
        if entry.loadType == "assisted" {
            return prescribeAssisted(entry: entry, slot: slot, last: last, input: input, verdict: verdict, catalog: catalog)
        }

        // 负重自重分支（wave-11，owner 拍板）：重量轴=外挂负重(≥0)，方向同 external
        //（加负重=更难），但档位取挂片档、减到最小一片还吃力则自动回退换自重孪生。
        if entry.loadType == "bodyweight-plus" {
            return prescribeBodyweightPlus(entry: entry, slot: slot, last: last, input: input, verdict: verdict, catalog: catalog)
        }

        // 档位系统（2026-06-13）：渐进一档 = 器械×用户单位的真实档位步长（LoadGrid，
        // 宁大勿小）。roundToIncrement 到它即把重量吸附到真实格子——磅用户落 5lb
        // 倍数、公斤用户落 2.5kg 倍数。kg + 自由重量 = 2.5，与旧 per-entry 步长等价。
        let step = LoadGrid.stepKg(
            equipment: entry.equipment,
            unit: LoadUnit(unitSystem: input.profile.unitSystem)
        )

        let baseWeight: Double
        let targetReps: Int
        let change: ChangeDirection
        let reason: PrescriptionReason
        if let last {
            if let minRir = last.minRir, minRir <= nearFailureMeanRir {
                baseWeight = max(step, last.topWeightKg - step)
                targetReps = slot.repMin
                change = .ease
                reason = .nearFailureLastTime
            } else if last.maxReps < slot.repMin {
                baseWeight = max(step, last.topWeightKg - step)
                targetReps = slot.repMin
                change = .ease
                reason = .belowRepFloor
            } else if last.minReps >= slot.repMax, last.minRir.map({ $0 >= progressMinMeanRir }) ?? true {
                // 无上限：精英重量的 +一档 是合法递增，有意不设 cap。
                baseWeight = last.topWeightKg + step
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
            // M5-1 首练定档：自报背景只作冷启动先验，缩放仅作用于 firstExposure；
            // 一旦有真实记录（上面分支），实际执行即基线，先验不再参与。
            // 与裁决调制（light ×0.9 / deload ×0.8）叠乘是有意设计（拍板 2026-06-10）：
            // 先验定起点基线、调制定当日急性状态，两者正交；下限一档（per-entry 步长）兜底。
            baseWeight = ColdStartPrior.scaledStartKg(
                entry.startWeightKg, trainingLevel: input.profile.trainingLevel, stepKg: step
            )
            targetReps = slot.repMin
            change = .start
            reason = .firstExposure
        }

        var weight = roundToIncrement(baseWeight, step: step)
        var sets = slot.sets
        switch verdict.call {
        case .light:
            weight = modulated(base: weight, multiplier: lightMultiplier, step: step)
        case .deload:
            weight = modulated(base: weight, multiplier: deloadMultiplier, step: step)
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
            nextProjectedWeightKg: roundToIncrement(weight + step, step: step),
            progressionStepKg: step,
            change: change,
            reason: reason,
            loadType: entry.loadType
        )
    }

    /// 轻练/减载的实际负重：×乘数后按步长取整；若弹回原值且仍有下调空间，
    /// 强制下调一格（调制必须真减，小重量不得被取整吃掉）。
    private static func modulated(base: Double, multiplier: Double, step: Double) -> Double {
        let rounded = roundToIncrement(base * multiplier, step: step)
        guard rounded >= base, base > step else { return rounded }
        return max(step, base - step)
    }

    /// 该动作最近一次工作顶组重量（供换动作后的小结 PR 口径：换入动作
    /// 只和它自己的历史比，§6.2 修复 2026-06-11）；无历史 → nil。
    public static func lastTopWeightKg(exerciseId: String, sessions: [CleanTrainingSession]) -> Double? {
        lastPerformance(exerciseId: exerciseId, sessions: sessions)?.topWeightKg
    }

    /// 自重处方（owner 拍板 2026-06-13）：重量固定 0，按次数进阶到顶提示换难度。
    /// 上次力竭则保持、有余力则 +2 次、到 25 次封顶并提示加配重/换更难变体。
    /// wave-12：弹力带（band）复用本路径——只换两个参数：loadType（透传给显示层判渲染）
    /// 与 ceilingReason（到顶提示分叉：自重=加配重、弹力带=换重带）。毕业/回退孪生调用
    /// （assisted/bodyweight-plus → 自重）走默认值，行为零变化。
    private static func prescribeBodyweight(
        entry: ExerciseCatalogEntry,
        slot: Slot,
        last: LastPerformance?,
        verdict: TodayVerdict,
        forcedReason: PrescriptionReason? = nil,   // wave-9：assisted 毕业换自重时标 .assistedGraduated
        loadType: String = "bodyweight",
        ceilingReason: PrescriptionReason = .bodyweightCeilingReached
    ) -> ExercisePrescriptionPlan {
        var targetReps: Int
        let change: ChangeDirection
        let reason: PrescriptionReason
        if let last {
            let lastReps = last.repsAtTop
            if lastReps >= bodyweightRepCeiling {
                targetReps = bodyweightRepCeiling
                change = .hold
                reason = ceilingReason
            } else if let minRir = last.minRir, minRir <= nearFailureMeanRir {
                targetReps = max(bodyweightRepFloor, lastReps)
                change = .hold
                reason = .nearFailureLastTime   // 力竭保持（审查 MINOR-4：区分于进阶）
            } else {
                targetReps = min(bodyweightRepCeiling, lastReps + bodyweightRepStep)
                change = .increase
                reason = .holdProgressing
            }
        } else {
            targetReps = bodyweightStartReps
            change = .start
            reason = .firstExposure
        }

        var sets = slot.sets
        switch verdict.call {
        case .light:
            targetReps = max(bodyweightRepFloor, targetReps - bodyweightRepStep)
        case .deload:
            sets = max(2, sets - 1)
            targetReps = max(bodyweightRepFloor, targetReps - bodyweightRepStep)
        case .train, .rest:
            break
        }

        return ExercisePrescriptionPlan(
            exerciseId: entry.id,
            sets: sets,
            restSeconds: slot.rest,
            repLowerBound: bodyweightRepFloor,
            repUpperBound: bodyweightRepCeiling,
            targetReps: targetReps,
            targetWeightKg: 0,
            targetRir: targetRir,
            previousWeightKg: nil,
            previousTopReps: last?.repsAtTop,
            nextProjectedWeightKg: 0,
            progressionStepKg: 0,
            change: change,
            reason: forcedReason ?? reason,
            loadType: loadType
        )
    }

    /// 辅助器械处方（wave-9，owner 拍板）：辅助量 = 越多越轻松，方向相对 external 全反转。
    /// 变强→减辅助一档；力竭/挣扎→加辅助一档（安全方向）；轻练/减载→加辅助；
    /// 新手冷启动→更多辅助；减到最小一片以下→毕业换同族自重孪生（数轴不跨零）。
    private static func prescribeAssisted(
        entry: ExerciseCatalogEntry,
        slot: Slot,
        last: LastPerformance?,
        input: CleanTrainingDecisionInput,
        verdict: TodayVerdict,
        catalog: ExerciseCatalog
    ) -> ExercisePrescriptionPlan {
        let step = LoadGrid.stepKg(
            equipment: entry.equipment,
            unit: LoadUnit(unitSystem: input.profile.unitSystem)
        )

        let baseAssist: Double
        let targetReps: Int
        let change: ChangeDirection
        let reason: PrescriptionReason
        if let last {
            if let minRir = last.minRir, minRir <= nearFailureMeanRir {
                baseAssist = last.topWeightKg + step       // 力竭 → 加辅助（更轻=安全）
                targetReps = slot.repMin
                change = .ease
                reason = .nearFailureLastTime
            } else if last.maxReps < slot.repMin {
                baseAssist = last.topWeightKg + step        // 没到下限 → 加辅助
                targetReps = slot.repMin
                change = .ease
                reason = .belowRepFloor
            } else if last.minReps >= slot.repMax, last.minRir.map({ $0 >= progressMinMeanRir }) ?? true {
                let nextAssist = last.topWeightKg - step     // 变强 → 减辅助一档
                if nextAssist < step {
                    // 减到最小一片以下 = 不再需要辅助 → 自动毕业换自重孪生
                    if let twin = graduationTwin(for: entry, catalog: catalog) {
                        let twinLast = lastPerformance(exerciseId: twin.id, sessions: input.sessions)
                        // 「毕业」提示只在首次切换出现（无自重历史）；已练过自重版则走
                        // 正常次数进阶（审查 MINOR：避免 reason=毕业 / change=进阶 矛盾）。
                        return prescribeBodyweight(
                            entry: twin, slot: slot, last: twinLast, verdict: verdict,
                            forcedReason: twinLast == nil ? .assistedGraduated : nil
                        )
                    }
                    baseAssist = step                        // 无孪生兜底：保持最小辅助，不跨零
                    targetReps = slot.repMax
                    change = .hold
                    reason = .holdProgressing
                } else {
                    baseAssist = nextAssist
                    targetReps = slot.repMin
                    change = .increase
                    reason = .repCeilingReached
                }
            } else {
                baseAssist = last.topWeightKg                // 区间内 → 保持
                targetReps = slot.repMax
                change = .hold
                reason = .holdProgressing
            }
        } else {
            baseAssist = ColdStartPrior.scaledAssistKg(
                entry.startWeightKg, trainingLevel: input.profile.trainingLevel, stepKg: step
            )
            targetReps = slot.repMin
            change = .start
            reason = .firstExposure
        }

        // 调制反转：轻练/减载 = 加辅助（更轻），不是 ×0.9/0.8 减重。
        var assist = roundToIncrement(baseAssist, step: step)
        var sets = slot.sets
        switch verdict.call {
        case .light:
            assist = roundToIncrement(assist + step, step: step)
        case .deload:
            assist = roundToIncrement(assist + step * 2, step: step)
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
            targetWeightKg: assist,
            targetRir: targetRir,
            previousWeightKg: last?.topWeightKg,
            previousTopReps: last?.repsAtTop,
            // 下一步指向「少帮一档」（进阶方向）；最小一片兜底不跨零。
            nextProjectedWeightKg: max(step, roundToIncrement(assist - step, step: step)),
            progressionStepKg: step,
            change: change,
            reason: reason,
            loadType: entry.loadType
        )
    }

    /// 负重自重处方（wave-11，owner 拍板）：外挂负重轴方向同 external（加负重=更难），
    /// 档位取挂片档（addedLoadStepKg）；挣扎减负重，减到最小一片以下=太重→自动回退换
    /// 同族自重孪生（负重引体→自重引体）。冷启动复用 external 先验（新手加得少，方向就对）。
    private static func prescribeBodyweightPlus(
        entry: ExerciseCatalogEntry,
        slot: Slot,
        last: LastPerformance?,
        input: CleanTrainingDecisionInput,
        verdict: TodayVerdict,
        catalog: ExerciseCatalog
    ) -> ExercisePrescriptionPlan {
        let step = LoadGrid.addedLoadStepKg(unit: LoadUnit(unitSystem: input.profile.unitSystem))

        let baseLoad: Double
        let targetReps: Int
        let change: ChangeDirection
        let reason: PrescriptionReason
        if let last {
            // 挣扎口径：近力竭优先于掉出次数下限（同 external 分支次序）。
            let easeReason: PrescriptionReason? =
                (last.minRir.map { $0 <= nearFailureMeanRir } ?? false) ? .nearFailureLastTime
                : (last.maxReps < slot.repMin ? .belowRepFloor : nil)
            if let easeReason {
                let nextLoad = last.topWeightKg - step
                if nextLoad < step {
                    // 减到最小一片以下 = 连最轻外加负重都吃力 → 回退换自重孪生（数轴不跨零）。
                    // reason **无条件**标 degraded（审查 MAJOR）：正常阶梯是 自重→负重，回退时
                    // 已有自重历史，若学 assisted 用 twinLast==nil 条件则提示永不出现。回退是事件
                    // 不是里程碑，每次都该标；change 仍由自重历史决定（reason=为何切、change=次数向）。
                    if let twin = graduationTwin(for: entry, catalog: catalog) {
                        let twinLast = lastPerformance(exerciseId: twin.id, sessions: input.sessions)
                        return prescribeBodyweight(
                            entry: twin, slot: slot, last: twinLast, verdict: verdict,
                            forcedReason: .bodyweightPlusDegraded
                        )
                    }
                    // UNREACHABLE：现目录所有 bodyweight-plus 条目均有同族自重孪生；此兜底仅防御
                    // 未来孤立条目（不跨零，保持最小外加负重）。
                    baseLoad = step
                    targetReps = slot.repMax
                    change = .hold
                    reason = .holdProgressing
                } else {
                    baseLoad = nextLoad         // 减外挂负重一档
                    targetReps = slot.repMin
                    change = .ease
                    reason = easeReason
                }
            } else if last.minReps >= slot.repMax, last.minRir.map({ $0 >= progressMinMeanRir }) ?? true {
                baseLoad = last.topWeightKg + step   // 变强 → 加负重一档（无上限）
                targetReps = slot.repMin
                change = .increase
                reason = .repCeilingReached
            } else {
                baseLoad = last.topWeightKg          // 区间内 → 保持
                targetReps = slot.repMax
                change = .hold
                reason = .holdProgressing
            }
        } else {
            baseLoad = ColdStartPrior.scaledStartKg(
                entry.startWeightKg, trainingLevel: input.profile.trainingLevel, stepKg: step
            )
            targetReps = slot.repMin
            change = .start
            reason = .firstExposure
        }

        // 调制同 external：轻练/减载 ×乘数减外加负重（小负重不被取整吃掉）。
        var weight = roundToIncrement(baseLoad, step: step)
        var sets = slot.sets
        switch verdict.call {
        case .light:
            weight = modulated(base: weight, multiplier: lightMultiplier, step: step)
        case .deload:
            weight = modulated(base: weight, multiplier: deloadMultiplier, step: step)
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
            nextProjectedWeightKg: roundToIncrement(weight + step, step: step),
            progressionStepKg: step,
            change: change,
            reason: reason,
            loadType: entry.loadType
        )
    }

    /// 毕业孪生：同主族的 bodyweight 成员（辅助引体 → 自重引体）；无则 nil（兜底保持最小辅助）。
    private static func graduationTwin(for entry: ExerciseCatalogEntry, catalog: ExerciseCatalog) -> ExerciseCatalogEntry? {
        guard let primary = entry.substitutionGroups.first else { return nil }
        // 去顺序化（审查 MINOR）：同主族多个 bodyweight 成员时取 rank 最小（最基础）那个，
        // 不依赖 JSON 顺序——与处方主匹配同口径。
        return catalog.entries
            .filter { !$0.deprecated && $0.loadType == "bodyweight" && $0.substitutionGroups.first == primary }
            .min(by: { ($0.rank, $0.id) < ($1.rank, $1.id) })
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
    /// sticky swaps（wave-9，owner 拍板）：每个 movementPattern → 最近一场含该 pattern
    /// 的 session 里实际做的 exerciseId（含换动作换入的实际动作）。读「实际做了什么」
    /// 故自然 un-stick——换回默认即恢复默认。供 plan() 唯一出现的 pattern 槽位消费。
    private static func lastActualByPattern(
        sessions: [CleanTrainingSession],
        catalog: ExerciseCatalog
    ) -> [String: String] {
        let ordered = sessions.compactMap { session -> (day: Int, session: CleanTrainingSession)? in
            TrainingDay.dayNumber(fromISO: session.date).map { ($0, session) }
        }.sorted { $0.day > $1.day }   // 最新在前
        var result: [String: String] = [:]
        for (_, session) in ordered {
            for ex in session.exercises {
                guard let pattern = catalog.entry(id: ex.exerciseId)?.movementPattern else { continue }
                if result[pattern] == nil { result[pattern] = ex.exerciseId }
            }
        }
        return result
    }

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

    private static func roundToIncrement(_ weightKg: Double, step: Double) -> Double {
        max(step, (weightKg / step).rounded() * step)
    }
}
