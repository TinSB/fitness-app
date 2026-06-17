// StrengthMilestoneCatalog — FR-PR7 力量里程碑（杠铃配片，只认实测）。
//
// 命名阈值 = 杠上配片里程碑（业界公认）。MVP 起步值，待真实使用校准（同引擎其它阈值口径）。
// kg / lb 双梯分存、**禁互转**（225 lb 与 100 kg 是地区化表达，非精确等值）：按用户单位评定。
//
// v1 只认「实测达成」——用 ProgressSnapshot 的 bestWeightKg（真实完成顶组），不产 e1RM 估算
// 里程碑（避免把估算冒充真实完成，诚信红线）。eligible 动作（杠铃大项）由 app 层从目录注入
// （RedeLocalSnapshot 与目录解耦）。纯函数、无 IO、确定性。

public struct StrengthMilestone: Equatable, Sendable {
    public let exerciseId: String
    public let achievedThreshold: Int  // 用户单位下已跨过的最高阈值（如 100 / 225）
    public let unitLabel: String       // "kg" / "lb"
    public init(exerciseId: String, achievedThreshold: Int, unitLabel: String) {
        self.exerciseId = exerciseId
        self.achievedThreshold = achievedThreshold
        self.unitLabel = unitLabel
    }
}

public enum StrengthMilestoneCatalog {
    /// MVP 起步阈值（待校准）：kg / lb 双梯，分存不互转。
    public static let kgLadder = [60, 100, 140, 180]
    public static let lbLadder = [135, 225, 315, 405]
    static let lbPerKg = 2.204_622_621_8

    /// 已达成里程碑：对每个 eligible 动作，按用户单位梯取「实测最佳顶组」跨过的最高阈值。
    /// 无达成（未到最低阈值）或非 eligible → 不产出。返回按 exerciseId 升序（确定性）。
    public static func achieved(
        bestWeightKgByExercise: [String: Double],
        eligibleExerciseIds: Set<String>,
        unitSystem: String?
    ) -> [StrengthMilestone] {
        let isLb = unitSystem?.lowercased() == "lb"
        let ladder = isLb ? lbLadder : kgLadder
        let unitLabel = isLb ? "lb" : "kg"
        var result: [StrengthMilestone] = []
        for id in eligibleExerciseIds.sorted() {
            guard let bestKg = bestWeightKgByExercise[id], bestKg > 0 else { continue }
            let displayWeight = isLb ? bestKg * lbPerKg : bestKg
            // 最高 ≤ 实测重量的阈值（+ε 容浮点）；未到最低 → 跳过。
            guard let achieved = ladder.last(where: { Double($0) <= displayWeight + 1e-6 }) else { continue }
            result.append(StrengthMilestone(exerciseId: id, achievedThreshold: achieved, unitLabel: unitLabel))
        }
        return result
    }
}
