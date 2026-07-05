// PlanScheduleDigest — 计划页排期折叠视图模型（T2 2026-07-05，纯派生）。
//
// 背景：PlanWeekProjection 逐日投影直接渲染时，同一训练日类型的完整构成（模式清单）
// 会随周×天逐字重复（上/下肢 4 天 2 段 = 8 行里重复 4 遍）——数据结构 dump 观感。
// 折叠为「类型只展开一次 + 分段 dayCode 序列」：构成看类型行（保 FR-PL6 下钻编辑），
// 先后顺序看序列（保 FR-PL2「接下来/再往后」分段语义，不引入日历周字面）。
// 同 dayCode 构成恒一致（投影按 dayCode 派生），去重保留首现。

import Foundation

/// 排期折叠结果：类型（首现顺序、每类一份完整构成）+ 各分段的 dayCode 序列。
public struct PlanScheduleDigest: Equatable, Sendable {
    public let dayTypes: [PlanDayProjection]
    public let segments: [[String]]
    public init(dayTypes: [PlanDayProjection], segments: [[String]]) {
        self.dayTypes = dayTypes
        self.segments = segments
    }
}

public enum PlanScheduleDigestBuilder {
    public static func digest(from projection: [[PlanDayProjection]]) -> PlanScheduleDigest {
        var seen = Set<String>()
        var types: [PlanDayProjection] = []
        for day in projection.joined() where seen.insert(day.dayCode).inserted {
            types.append(day)
        }
        return PlanScheduleDigest(
            dayTypes: types,
            segments: projection.map { $0.map(\.dayCode) }
        )
    }
}
