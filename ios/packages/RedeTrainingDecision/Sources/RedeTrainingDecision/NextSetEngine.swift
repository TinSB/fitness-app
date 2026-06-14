// NextSetEngine — 会话内下一组建议（M3-1 最小版，§6.3 合同的确定性子集）。
//
// 原则：尊重 session 内执行事实——用户上一组实际用的重量是下一组的基线
// （§6.3：第一组完成 85，第二组建议继续 85；完全按计划执行则保持计划形状）。
// 安全瀑布：疼痛 > 力竭 > 次数掉底 > 延续。无 RIR 数据不猜。
// 组形学习/历史掉速模型/器械校准明示后置。引擎零文案。

public struct CompletedSetObservation: Equatable, Sendable, Codable {
    public let weightKg: Double
    public let reps: Int
    public let rir: Double?
    public let painReported: Bool

    public init(weightKg: Double, reps: Int, rir: Double? = nil, painReported: Bool = false) {
        self.weightKg = weightKg
        self.reps = reps
        self.rir = rir
        self.painReported = painReported
    }
}

public enum NextSetReason: Equatable, Sendable {
    case onPlan
    case lastSetNearFailure
    case belowRepFloor
    case painReported

    public var code: String {
        switch self {
        case .onPlan: return "onPlan"
        case .lastSetNearFailure: return "lastSetNearFailure"
        case .belowRepFloor: return "belowRepFloor"
        case .painReported: return "painReported"
        }
    }
}

public enum NextSetSafetyFlag: String, Equatable, Sendable {
    case painReported
}

public struct NextSetRecommendation: Equatable, Sendable {
    /// 1 起算（来自 PlannedSet.index）。
    public let setIndex: Int
    public let targetWeightKg: Double
    public let targetReps: Int
    public let targetRir: Double
    public let restSeconds: Int
    public let reason: NextSetReason
    public let safetyFlags: [NextSetSafetyFlag]

    public init(
        setIndex: Int, targetWeightKg: Double, targetReps: Int, targetRir: Double,
        restSeconds: Int, reason: NextSetReason, safetyFlags: [NextSetSafetyFlag]
    ) {
        self.setIndex = setIndex
        self.targetWeightKg = targetWeightKg
        self.targetReps = targetReps
        self.targetRir = targetRir
        self.restSeconds = restSeconds
        self.reason = reason
        self.safetyFlags = safetyFlags
    }
}

public enum NextSetEngine {
    private static let nearFailureRir = 0.5

    /// 全部计划组完成 → nil（动作结束）。
    public static func recommend(
        plan: ExerciseSetPlan,
        completed: [CompletedSetObservation]
    ) -> NextSetRecommendation? {
        guard completed.count < plan.sets.count else { return nil }
        let plannedSet = plan.sets[completed.count]

        guard let last = completed.last else {
            return NextSetRecommendation(
                setIndex: plannedSet.index,
                targetWeightKg: plannedSet.targetWeightKg,
                targetReps: plannedSet.targetReps,
                targetRir: plannedSet.targetRir,
                restSeconds: plan.restSeconds,
                reason: .onPlan,
                safetyFlags: []
            )
        }

        // 执行事实是基线：用户实际重量延续到下一组。
        // 回退一档 = 该动作步长（随计划自目录透传，§6.1）：侧平举不再被
        // 全局 2.5 一刀切成 −33%。自重动作无重量轴：重量恒 0、不走减重瀑布，
        // 但疼痛/力竭信号仍如实标记（reason/safetyFlags 不变，2026-06-13）。
        // 负重语义决定缓降方向（wave-9）：external 减重、自重不动、辅助器械加辅助。
        // 辅助方向反转是安全红线——疼痛/力竭加辅助 = 更轻 = 安全；若套 external 减重
        // 瀑布则辅助变少 = 更难 = 受伤。
        let base = last.weightKg
        let eased: Double
        switch plan.loadType {
        case "bodyweight":      eased = base                          // 无重量轴
        case "assisted":        eased = base + plan.stepKg            // 加辅助 = 更轻 = 安全方向
        case "bodyweight-plus": eased = max(plan.stepKg, base - plan.stepKg)   // 减外挂负重（方向同 external，显式声明 wave-11）
        default:                eased = max(plan.stepKg, base - plan.stepKg)   // external 减重
        }

        let weight: Double
        let reason: NextSetReason
        var safetyFlags: [NextSetSafetyFlag] = []
        if last.painReported {
            weight = eased
            reason = .painReported
            safetyFlags = [.painReported]
        } else if let rir = last.rir, rir <= nearFailureRir {
            weight = eased
            reason = .lastSetNearFailure
        } else if last.reps < plan.repLowerBound {
            weight = eased
            reason = .belowRepFloor
        } else {
            weight = base
            reason = .onPlan
        }

        return NextSetRecommendation(
            setIndex: plannedSet.index,
            targetWeightKg: weight,
            targetReps: plannedSet.targetReps,
            targetRir: plannedSet.targetRir,
            restSeconds: plan.restSeconds,
            reason: reason,
            safetyFlags: safetyFlags
        )
    }
}
