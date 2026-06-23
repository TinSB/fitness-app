// PlanWeekProjection — FR-PL2 计划页只读周排期投影（纯派生，不写真相）。
//
// 复用今日处方引擎的 daySequence（日序轮转）+ slots（每日槽位）——同一真源，故计划页展示的
// 未来安排与今日页处方永不分叉（审查同源原则）。从「已完成训练次数」的轮转位起，投影未来
// N 周、每周 daysPerWeek 个训练日；每日给训练日 code、动作数、去重后的模式码。
//
// 零行为变更：只读引擎已有的 daySequence/slots，不改任何处方逻辑（既有引擎测试即回归兜底）。
//
// 只展示「结构层」（训练日序 + 槽位数 + 模式），不区分目标：strength 目标在今日页走
// slots().map(strengthShaped)，但 strengthShaped 只改强度参数（组数/次数/RIR/休息），
// 不增删槽位、不改 pattern，故排期的 exerciseCount/patternCodes 对 strength 与 general 一致。
// 审查 m-1：若将来 strengthShaped 改成可增删槽位，此处展示需相应区分目标。

import Foundation

/// 单个未来训练日的只读投影。
public struct PlanDayProjection: Equatable, Sendable {
    public let dayCode: String        // push-a / upper / full-a …（RedeL10n.trainingDayName 渲染）
    public let exerciseCount: Int     // 该日槽位数
    public let patternCodes: [String] // 去重、按槽位序（RedeL10n.movementPatternLabel 渲染）
    public init(dayCode: String, exerciseCount: Int, patternCodes: [String]) {
        self.dayCode = dayCode
        self.exerciseCount = exerciseCount
        self.patternCodes = patternCodes
    }
}

public enum PlanWeekProjection {
    /// 从当前轮转位（= 已完成训练次数）起，投影 `weeks` 周、每周 `daysPerWeek` 个训练日。
    /// 第一天 = 今日页此刻的训练日（同 `sessions.count % sequence.count` 口径），两页永不分叉。
    /// daysPerWeek ≤ 0 / weeks ≤ 0 / completedSessionCount < 0 → 空数组。
    public static func weeks(
        splitType: String?,
        daysPerWeek: Int,
        completedSessionCount: Int,
        weeks: Int = 2,
        customization: PlanCustomizationInput = .empty,
        catalog: ExerciseCatalog = .minimal
    ) -> [[PlanDayProjection]] {
        // FR-PL7② 自定义日序（默认 nil → 现状）；与今日页 plan() 同走 resolvedDaySequence，两页永不分叉。
        let sequence = TodayPrescriptionEngine.resolvedDaySequence(splitType: splitType, override: customization.daySequence)
        guard !sequence.isEmpty, daysPerWeek > 0, weeks > 0, completedSessionCount >= 0 else { return [] }
        var result: [[PlanDayProjection]] = []
        var cursor = completedSessionCount
        for _ in 0..<weeks {
            var week: [PlanDayProjection] = []
            for _ in 0..<daysPerWeek {
                let dayCode = sequence[cursor % sequence.count]
                week.append(projection(dayCode: dayCode, customization: customization, catalog: catalog))
                cursor += 1
            }
            result.append(week)
        }
        return result
    }

    /// 单日结构投影：有有效自定义清单 → count/patterns 来自自定义动作（catalog 查 pattern；非 catalog/
    /// 弃用项跳过；全空回退默认）；否则默认模板槽位（现状逐字节不变）。
    /// 注：投影不含场景过滤（无 profile），与引擎可能在「越场景动作」上有极少差异——结构预览可接受。
    private static func projection(
        dayCode: String,
        customization: PlanCustomizationInput,
        catalog: ExerciseCatalog
    ) -> PlanDayProjection {
        if let specs = customization.dayPlans[dayCode], !specs.isEmpty {
            // 与引擎 customSlots 口径对齐：跳过弃用/非可处方（场景过滤无 profile 故略，差异极小可接受）。
            let resolved = specs.compactMap { catalog.entry(id: $0.exerciseId) }
                .filter { !$0.deprecated && EquipmentRegistry.prescribableLoadTypes.contains($0.loadType) }
            if !resolved.isEmpty {
                var seen = Set<String>()
                var patterns: [String] = []
                for ex in resolved where seen.insert(ex.movementPattern).inserted { patterns.append(ex.movementPattern) }
                return PlanDayProjection(dayCode: dayCode, exerciseCount: resolved.count, patternCodes: patterns)
            }
        }
        let daySlots = TodayPrescriptionEngine.slots(dayCode: dayCode)
        var seen = Set<String>()
        var patterns: [String] = []
        for slot in daySlots where seen.insert(slot.pattern).inserted { patterns.append(slot.pattern) }
        return PlanDayProjection(dayCode: dayCode, exerciseCount: daySlots.count, patternCodes: patterns)
    }
}
