// StrengthMilestoneCatalog — FR-PR7 力量里程碑（杠铃配片，只认实测）。
//
// 命名阈值 = 杠上配片里程碑（业界公认）。MVP 起步值，待真实使用校准（同引擎其它阈值口径）。
// kg / lb 双梯分存、**禁互转**（225 lb 与 100 kg 是地区化表达，非精确等值）：按用户单位评定。
//
// 两类里程碑：① **实测达成**——用 ProgressSnapshot 的 bestWeightKg（真实完成顶组），isEstimated=false；
// ② **估算达成**（FR-PR7）——用 bestE1RmKg 跨过比实测**更高**的档时产出，isEstimated=true、UI 明确标「估算」，
// **绝不把估算冒充真实完成**（诚信红线）：估算档 ≤ 实测档时不出，避免重复/冒充。eligible 动作（杠铃大项）
// 由 app 层从目录注入（RedeLocalSnapshot 与目录解耦）。纯函数、无 IO、确定性。

public struct StrengthMilestone: Equatable, Hashable, Sendable {
    public let exerciseId: String
    public let achievedThreshold: Int  // 用户单位下已跨过的最高阈值（如 100 / 225）
    public let unitLabel: String       // "kg" / "lb"
    public let isEstimated: Bool       // true = 仅 e1RM 估算达成（未实测），UI 标「估算」
    public init(exerciseId: String, achievedThreshold: Int, unitLabel: String, isEstimated: Bool = false) {
        self.exerciseId = exerciseId
        self.achievedThreshold = achievedThreshold
        self.unitLabel = unitLabel
        self.isEstimated = isEstimated
    }
}

public enum StrengthMilestoneCatalog {
    /// MVP 起步阈值（待校准）：kg / lb 双梯，分存不互转。
    public static let kgLadder = [60, 100, 140, 180]
    public static let lbLadder = [135, 225, 315, 405]
    static let lbPerKg = 2.204_622_621_8

    /// 已达成里程碑：对每个 eligible 动作产「实测达成」+（若估算更高）「估算达成」。
    /// 按用户单位梯评定，**禁互转**。返回按 exerciseId 升序、同动作实测在前估算在后（确定性）。
    /// `estimatedE1RmKgByExercise` 缺省空 = 仅实测（旧行为）。
    public static func achieved(
        bestWeightKgByExercise: [String: Double],
        estimatedE1RmKgByExercise: [String: Double] = [:],
        eligibleExerciseIds: Set<String>,
        unitSystem: String?
    ) -> [StrengthMilestone] {
        let isLb = unitSystem?.lowercased() == "lb"
        let ladder = isLb ? lbLadder : kgLadder
        let unitLabel = isLb ? "lb" : "kg"
        // 某 kg 重量在用户单位梯下跨过的最高阈值（+ε 容浮点）；未到最低或 ≤0 → nil。
        func crossed(_ kg: Double) -> Int? {
            guard kg > 0 else { return nil }
            let display = isLb ? kg * lbPerKg : kg
            return ladder.last(where: { Double($0) <= display + 1e-6 })
        }
        var result: [StrengthMilestone] = []
        for id in eligibleExerciseIds.sorted() {
            let actualThreshold = crossed(bestWeightKgByExercise[id] ?? 0)
            let estimatedThreshold = crossed(estimatedE1RmKgByExercise[id] ?? 0)
            if let actualThreshold {
                result.append(StrengthMilestone(exerciseId: id, achievedThreshold: actualThreshold, unitLabel: unitLabel, isEstimated: false))
            }
            // 估算里程碑仅在严格高于实测档时出（"已确认 X，估算到 Y"）；≤ 实测时不出——不冒充/不重复实测。
            if let estimatedThreshold, estimatedThreshold > (actualThreshold ?? 0) {
                result.append(StrengthMilestone(exerciseId: id, achievedThreshold: estimatedThreshold, unitLabel: unitLabel, isEstimated: true))
            }
        }
        return result
    }
}
