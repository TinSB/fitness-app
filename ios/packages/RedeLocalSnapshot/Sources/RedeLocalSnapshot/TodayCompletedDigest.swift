// TodayCompletedDigest — 今日页最近一场总结（T1 2026-07-05 练完态；K3 2026-07-16 放宽到最近一场）。
//
// 练完 60–90 分钟回到今日页，此前只有两行字 + 空屏——高光时刻零回报，且已建成的
// 分享卡（FR-SH1/SH3「完成后轻量入口」）没接到这个时刻。本类型从**已落盘**历史派生
// 总结块（与进度页同一 snapshot 链，口径永不分叉）+ 分享快照（经 SharePrivacyFilter，
// 隐私结构性缺失免费继承）。杀进程重开仍在（数据源非内存 flow）。
//
// K3（2026-07-16）：today-only 门槛放宽为「最近一场」——休息日/停练回归日也能看到
// 上一场回执（3 练/周用户一周 4 天见空屏的修复）。练完态语义不变：UI 按 dateISO 是否
// 等于今天分流区头（「今天这场」/「上一场 · 日期」）；分享快照日期 = 场次真实日期
//（不把旧场标成今天——不编数据）。
//
// 诚实边界：record 缺失不猜动作数、整体退化 nil（UI 退回原状兜底）；时长缺失不编
// 时长档——训练总结卡不出（档位必填），PR 卡保留。dayCode / durationMinutes 来自
// canonical（clean 链不带这两项），由 app 层传入。

import Foundation

/// 总结块字段 + 分享快照（只读派生，不写真相）。dateISO = 该场真实日期（区头分流用）。
public struct TodayCompletedDigest: Equatable, Sendable {
    public let dateISO: String
    public let dayCode: String?
    public let exerciseCount: Int
    public let setCount: Int
    public let totalVolumeKg: Double
    public let durationBand: ShareDurationBand?
    public let prCount: Int
    public let shareSnapshots: [ShareSnapshot]
}

public enum TodayCompletedDigestBuilder {
    /// 口径留痕（审查 MINOR 2026-07-05）：exerciseCount 用 record（**完成落盘**的动作数）；
    /// 训练小结当场分享卡用处方数（SessionShareSnapshotBuilder「今天这套练什么」）——跳过
    /// 动作时两处数字有意不同：当场卡说这套、事后总结说实际完成。
    /// 输入契约：prExerciseIds 非空时 topSet 必非 nil（生产唯一数据源 ProgressSnapshotBuilder
    /// 保证；直接手拼 HistoryEntry 时需自行遵守，违反则 PR 徽标显示而 PR 卡缺席）。
    public static func digest(
        latest: ProgressSnapshot.HistoryEntry?,
        record: SnapshotSessionRecord?,
        dayCode: String?,
        durationMinutes: Int?,
        patterns: [String]
    ) -> TodayCompletedDigest? {
        guard let latest, let record, !record.exercises.isEmpty else {
            return nil
        }

        var snapshots: [ShareSnapshot] = []
        if let durationMinutes {
            snapshots.append(SharePrivacyFilter.workoutSummary(
                generatedDateISO: String(latest.dateISO.prefix(10)),
                dayCode: dayCode,
                exerciseCount: record.exercises.count,
                setCount: latest.setCount,
                durationSeconds: durationMinutes * 60,
                patterns: patterns,
                hadPR: !latest.prExerciseIds.isEmpty
            ))
        }
        if !latest.prExerciseIds.isEmpty, let top = latest.topSet {
            snapshots.append(SharePrivacyFilter.personalRecord(
                generatedDateISO: String(latest.dateISO.prefix(10)),
                exerciseId: top.exerciseId,
                weightKg: top.weightKg,
                reps: top.reps,
                isEstimated: false
            ))
        }

        // prefix(10) 归一（审查 MINOR：clean 层合法保留长 ISO 串——区头「今天」判定与
        // K4 周合计行的等值比较、分享快照日期契约都要求纯 yyyy-MM-dd，裁定 3）
        return TodayCompletedDigest(
            dateISO: String(latest.dateISO.prefix(10)),
            dayCode: dayCode,
            exerciseCount: record.exercises.count,
            setCount: latest.setCount,
            totalVolumeKg: latest.totalVolumeKg,
            durationBand: durationMinutes.map { ShareDurationBand.from(seconds: $0 * 60) },
            prCount: latest.prExerciseIds.count,
            shareSnapshots: snapshots
        )
    }
}
