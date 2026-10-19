// WarmupLadderEngine — FR-TR10 热身阶梯生成（系统逻辑 §6.3）。
//
// 纯函数大脑：吃工作组顶重 + 动作事实（loadType/equipment/kind/startWeight）+ 单位，
// 产出确定性、保守的热身阶梯（typed WarmupStep，零文案、kg 口径）。同输入必同阶梯。
//
// **关键契约（FR-TR10 设计）**：热身是**流内临时引导**——never 落 canonical、never 进
// observationsByExercise/completedInCurrentExercise（否则毒化 NextSetEngine + 污染 PR/volume/
// e1RM/等级统计）。本引擎只产建议，不接 flow/不写盘（流接线=切片2、UI=切片4）。
//
// 阶梯重量一律经 LoadGrid 吸附到「器械×单位」真实档位（不出现非档位重量），单调不减、
// 严格小于工作重（热身不等于工作组）、不低于最小可加载。assisted 方向反转（更多辅助=更轻=更安全）。
//
// 数值为 **MVP 保守起步值，待 owner 真机校准**（同 FR-PR7 里程碑阈值惯例）：
//  - 空杆 = 20kg（lb 模式吸附为 45lb）。
//  - compound 三级 50/70/90% × 次 5/3/1；isolation/accessory 两级 60/80% × 次 5/3。
//  - 杠铃/史密斯额外前置「空杆 ×8」动作模式预热。
//  - 自重/弹力带无重量轴：compound 出 1 步纯次数动作模式预热，孤立类 0 步。
// 跳过偏好学习（friction/tolerance + confidence）明示后置为独立 slice（系统逻辑 §6.3 热身段）。
//
// 少点几下（训练流审查 P1，2026-10-18）：
//  - **台阶最小间隔**：相邻两级至少差 max(两格, 工作重 10%)，最高一级离工作重至少两格
//    （assisted 镜像：离工作辅助量至少两格）。杠铃 70 lb 此前给 45 → 50 → 65（50 只比空杆重 5 lb，
//    白做一组），现在只剩空杆一步。轻负荷因此自然收敛到 1 步；复合动作「至少 1 步」的安全保留不变。
//  - **已热过的部位**（scope = .alreadyWarm，判定在 TrainFlowState）：复合动作最多 1 步过渡
//   （取完整阶梯里最接近 70% 且离工作重至少两格的一级），孤立/辅助动作不热身。

import Foundation

/// 单条热身步（typed，零文案、kg 口径）；movementPrep 无重量轴（targetWeightKg = 0）。
public struct WarmupStep: Equatable, Sendable {
    public enum Kind: String, Equatable, Sendable {
        case emptyBar       // 空杆预热（杠铃/史密斯）
        case percent        // 工作重百分比阶梯（含 bodyweight-plus 外挂、assisted 辅助量）
        case movementPrep   // 无重量轴动作模式预热（自重/弹力带，纯次数）
    }
    public let index: Int               // 1 起算
    public let targetWeightKg: Double    // movementPrep = 0；bodyweight-plus = 外挂负重；assisted = 辅助量
    public let targetReps: Int
    public let kind: Kind
    public init(index: Int, targetWeightKg: Double, targetReps: Int, kind: Kind) {
        self.index = index
        self.targetWeightKg = targetWeightKg
        self.targetReps = targetReps
        self.kind = kind
    }
}

/// 这个动作的主练肌群本场有没有热过。
public enum WarmupScope: Equatable, Sendable {
    /// 本场第一次练到这个部位：完整阶梯。
    case full
    /// 主练肌群本场已经练过：复合动作最多 1 步过渡，孤立/辅助动作不热身。
    case alreadyWarm

    /// 按本场已经实际记过组的动作判断当前动作的主练肌群热没热（肌群口径 = MuscleContributionTable，
    /// 主练 1.0、辅练 0.5，同组取大不累加）：
    ///  - 复合动作：主练肌群在前面某个动作里当过主练（1.0）才算热过——只当过辅练的（卧推后的肩推）
    ///    换了发力模式和主动肌，仍给完整阶梯。
    ///  - 孤立 / 辅助动作：主练肌群前面练到过就算热过（辅练也算），负荷本来就轻。
    ///  - 动作不在目录或主肌群无契约归宿（forearm）→ 完整阶梯（原行为）。
    /// 只看记过组的动作：跳过 / 换掉 / 删掉没练的动作不算热身过。
    public static func decide(
        exerciseId: String,
        kind: String,
        workedExerciseIds: some Sequence<String>,
        catalog: ExerciseCatalog
    ) -> WarmupScope {
        guard let primary = MuscleGroupMapping.primaryGroup(forExerciseId: exerciseId, catalog: catalog)
        else { return .full }
        var level = 0.0
        for id in workedExerciseIds {
            for contribution in MuscleContributionTable.contributions(exerciseId: id, catalog: catalog)
            where contribution.muscle == primary {
                level = max(level, contribution.weight)
            }
        }
        let threshold = kind == "compound" ? MuscleContributionTable.primaryWeight : MuscleContributionTable.secondaryWeight
        return level >= threshold ? .alreadyWarm : .full
    }
}

public enum WarmupLadderEngine {
    // MARK: 保守起步常量（待 owner 真机校准）
    private static let emptyBarRefKg = 20.0          // 标准奥杆；lb 模式吸附为 45lb
    private static let movementPrepReps = 10         // 自重/弹力带动作模式预热次数
    private static let emptyBarReps = 8              // 杠铃空杆预热次数
    // 百分比阶梯（顶重占比，次数）：compound 三级、isolation/accessory 两级。
    private static let compoundLadder: [(pct: Double, reps: Int)] = [(0.5, 5), (0.7, 3), (0.9, 1)]
    private static let isolationLadder: [(pct: Double, reps: Int)] = [(0.6, 5), (0.8, 3)]
    // 台阶最小间隔：相邻两级 ≥ max(minGapSteps 格, 工作重 × minGapFraction)；最高一级离工作重 ≥ minGapSteps 格。
    private static let minGapSteps = 2.0
    private static let minGapFraction = 0.1
    // 已热部位的过渡步取完整阶梯里最接近工作重这个比例的一级（assisted 方向反转取 1.2×）。
    private static let bridgeFraction = 0.7

    /// 产出保守热身阶梯。空数组 = 无需热身（轻负荷 / 低风险孤立 / 已热部位的孤立动作 /
    /// 未知 loadType，安全降级）。
    public static func generate(
        workWeightKg: Double,
        loadType: String,
        equipment: String,
        kind: String,
        startWeightKg: Double,
        unit: LoadUnit,
        scope: WarmupScope = .full
    ) -> [WarmupStep] {
        let full = fullLadder(workWeightKg: workWeightKg, loadType: loadType, equipment: equipment,
                              kind: kind, startWeightKg: startWeightKg, unit: unit)
        guard scope == .alreadyWarm else { return full }
        guard kind == "compound" else { return [] }
        // 过渡步只取带负重的一级：已经热过的部位，空杆 / 纯自重那一步没有意义；离工作重不足两格的
        //（工作重贴着起始重量时，那一级多半是被夹到起始重量的保底级）也没有意义——宁可不热。
        let step = loadType == "bodyweight-plus"
            ? LoadGrid.addedLoadStepKg(unit: unit) : LoadGrid.stepKg(equipment: equipment, unit: unit)
        let rungs = full.filter {
            $0.kind == .percent && abs(workWeightKg - $0.targetWeightKg) >= minGapSteps * step - 1e-6
        }
        let target = workWeightKg * (loadType == "assisted" ? 1.2 : bridgeFraction)
        guard let pick = rungs.min(by: { abs($0.targetWeightKg - target) < abs($1.targetWeightKg - target) })
        else { return [] }
        return [WarmupStep(index: 1, targetWeightKg: pick.targetWeightKg, targetReps: pick.targetReps, kind: .percent)]
    }

    private static func fullLadder(
        workWeightKg: Double,
        loadType: String,
        equipment: String,
        kind: String,
        startWeightKg: Double,
        unit: LoadUnit
    ) -> [WarmupStep] {
        let isCompound = (kind == "compound")
        switch loadType {
        case "external":
            return externalLadder(workWeightKg: workWeightKg, equipment: equipment, isCompound: isCompound, startWeightKg: startWeightKg, unit: unit)
        case "bodyweight-plus":
            return bodyweightPlusLadder(addedWorkKg: workWeightKg, isCompound: isCompound, unit: unit)
        case "assisted":
            return assistedLadder(workAssistKg: workWeightKg, equipment: equipment, isCompound: isCompound, unit: unit)
        case "bodyweight", "band":
            return isCompound ? [WarmupStep(index: 1, targetWeightKg: 0, targetReps: movementPrepReps, kind: .movementPrep)] : []
        default:
            return []  // 未知负重语义不猜，安全降级（无热身）
        }
    }

    // MARK: external（杠铃/哑铃/绳索/挂片机/选重机/史密斯）

    private static func externalLadder(workWeightKg: Double, equipment: String, isCompound: Bool, startWeightKg: Double, unit: LoadUnit) -> [WarmupStep] {
        let isBarbell = (equipment == "barbell" || equipment == "smith")
        let floor = isBarbell
            ? LoadGrid.snapKg(emptyBarRefKg, equipment: "barbell", unit: unit)
            : max(LoadGrid.snapKg(startWeightKg, equipment: equipment, unit: unit), LoadGrid.stepKg(equipment: equipment, unit: unit))
        // 工作重不高于地板 → 已在最低档，无需热身。
        guard workWeightKg > floor else { return [] }

        var weighted: [(w: Double, reps: Int, kind: WarmupStep.Kind)] = []
        // 杠铃/史密斯前置空杆动作模式预热。
        if isBarbell {
            weighted.append((floor, emptyBarReps, .emptyBar))
        }
        // 百分比阶梯：吸附档位、夹在 [floor, work)、严格小于工作重（热身≠工作组）。
        for rung in (isCompound ? compoundLadder : isolationLadder) {
            let snapped = LoadGrid.snapKg(workWeightKg * rung.pct, equipment: equipment, unit: unit)
            let clamped = min(max(snapped, floor), workWeightKg)
            if clamped < workWeightKg {
                weighted.append((clamped, rung.reps, .percent))
            }
        }
        var steps = spaced(dedupeMonotonic(weighted), workWeightKg: workWeightKg,
                           stepKg: LoadGrid.stepKg(equipment: equipment, unit: unit))
        // 安全保留：compound 至少 1 级（系统逻辑 §6.3「高风险场景仍保留最小安全 warm-up」）——全被夹没时补一档地板。
        if isCompound && steps.isEmpty {
            steps = [WarmupStep(index: 1, targetWeightKg: floor, targetReps: emptyBarReps, kind: isBarbell ? .emptyBar : .percent)]
        }
        return steps
    }

    // MARK: bodyweight-plus（负重自重：work = 外挂负重；先纯自重再加负重）

    private static func bodyweightPlusLadder(addedWorkKg: Double, isCompound: Bool, unit: LoadUnit) -> [WarmupStep] {
        // 第一级永远纯自重（外挂 0）作动作模式预热。
        var weighted: [(w: Double, reps: Int, kind: WarmupStep.Kind)] = [(0, emptyBarReps, .movementPrep)]
        let addedStep = LoadGrid.addedLoadStepKg(unit: unit)
        if addedWorkKg >= addedStep {
            // 外挂负重轴用挂片档（barbell 格）吸附；取 ~60% 一档，严格小于工作外挂。
            let snapped = (addedWorkKg * 0.6 / addedStep).rounded() * addedStep
            let clamped = min(max(snapped, addedStep), addedWorkKg)
            if clamped < addedWorkKg {
                weighted.append((clamped, isCompound ? 3 : 5, .percent))
            }
        }
        return spaced(dedupeMonotonic(weighted), workWeightKg: addedWorkKg, stepKg: addedStep)
    }

    // MARK: assisted（辅助器械：work = 辅助量，越大越轻；热身=更多辅助=更安全）

    private static func assistedLadder(workAssistKg: Double, equipment: String, isCompound: Bool, unit: LoadUnit) -> [WarmupStep] {
        guard workAssistKg > 0 else { return [] }
        let step = LoadGrid.stepKg(equipment: equipment, unit: unit)
        // 方向反转：热身辅助量 > 工作辅助量（更轻=更安全）。factors 降序（1.4>1.2）= 展示序从「最多辅助」
        // 到「逼近工作辅助」（先最轻、逐步加难）；绝不比工作组更难（辅助更少）。按值去重。
        let factors: [(f: Double, reps: Int)] = isCompound ? [(1.4, 5), (1.2, 3)] : [(1.3, 5)]
        // 台阶最小间隔（镜像）：离工作辅助量至少两格，相邻两级至少差 max(两格, 工作辅助量 10%)。
        // 复合动作全被筛掉时保留辅助最多的那一级（同 external 的「至少 1 级」）。
        let gapToWork = minGapSteps * step
        let gapBetween = max(gapToWork, workAssistKg * minGapFraction)
        var candidates: [(w: Double, reps: Int)] = []
        var kept: [(w: Double, reps: Int)] = []
        for rung in factors {
            let snapped = max(step, (workAssistKg * rung.f / step).rounded() * step)
            guard snapped > workAssistKg, !candidates.contains(where: { $0.w == snapped }) else { continue }
            candidates.append((snapped, rung.reps))
            if snapped - workAssistKg < gapToWork - 1e-6 { continue }
            if let last = kept.last, last.w - snapped < gapBetween - 1e-6 { continue }
            kept.append((snapped, rung.reps))
        }
        if kept.isEmpty, isCompound, let first = candidates.first { kept = [first] }
        return kept.enumerated().map {
            WarmupStep(index: $0.offset + 1, targetWeightKg: $0.element.w, targetReps: $0.element.reps, kind: .percent)
        }
    }

    // MARK: 工具

    /// 台阶最小间隔：从低到高保留，离上一保留级不足 max(两格, 工作重 10%) 的、离工作重不足两格的都丢掉，
    /// 再重新编号。输入已单调、去重。纯自重那一步（movementPrep）不在外挂负重轴上，不受「离工作重」约束。
    private static func spaced(_ steps: [WarmupStep], workWeightKg: Double, stepKg: Double) -> [WarmupStep] {
        let gapToWork = minGapSteps * stepKg
        let gapBetween = max(gapToWork, workWeightKg * minGapFraction)
        var kept: [WarmupStep] = []
        for step in steps {
            if step.kind != .movementPrep, workWeightKg - step.targetWeightKg < gapToWork - 1e-6 { continue }
            if let last = kept.last, step.targetWeightKg - last.targetWeightKg < gapBetween - 1e-6 { continue }
            kept.append(step)
        }
        return kept.enumerated().map {
            WarmupStep(index: $0.offset + 1, targetWeightKg: $0.element.targetWeightKg,
                       targetReps: $0.element.targetReps, kind: $0.element.kind)
        }
    }

    /// 单调不减去重 + 重新编号：按重量升序、相邻同重合并（保留更高次数=更靠前一档），1 起算。
    private static func dedupeMonotonic(_ raw: [(w: Double, reps: Int, kind: WarmupStep.Kind)]) -> [WarmupStep] {
        var out: [(w: Double, reps: Int, kind: WarmupStep.Kind)] = []
        for item in raw {
            if let last = out.last {
                if item.w < last.w { continue }          // 不减
                if abs(item.w - last.w) < 0.001 { continue } // 同重合并（保留先到的更高次数档）
            }
            out.append(item)
        }
        return out.enumerated().map {
            WarmupStep(index: $0.offset + 1, targetWeightKg: $0.element.w, targetReps: $0.element.reps, kind: $0.element.kind)
        }
    }
}
