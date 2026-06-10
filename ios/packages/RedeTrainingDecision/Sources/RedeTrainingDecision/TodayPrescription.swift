// TodayPrescription — 今日处方输出（PRD FR-T2：动作、组数、目标重量与次数区间）。
//
// 全部 typed、kg 口径、零文案：lb 换算与「lb · ×5 · RIR 2」拼接归渲染层
// （FR-SE1 单位切换）；reason code 是 RedeL10n 双语模板的挂点（FR-T3 禁词
// 结构化满足）。previous→target→change 三元组同时喂 Receipt Change 行、
// 训练页 why 行与 Rail next 三个槽位。输出是纯派生，永不写回 AppData。

public enum ChangeDirection: String, Equatable, Sendable {
    case start
    case increase
    case hold
    case ease
}

/// 单动作处方理由（渐进决策的那条分支）。
public enum PrescriptionReason: Equatable, Sendable {
    case firstExposure
    case repCeilingReached
    case nearFailureLastTime
    case belowRepFloor
    case holdProgressing

    public var code: String {
        switch self {
        case .firstExposure: return "firstExposure"
        case .repCeilingReached: return "repCeilingReached"
        case .nearFailureLastTime: return "nearFailureLastTime"
        case .belowRepFloor: return "belowRepFloor"
        case .holdProgressing: return "holdProgressing"
        }
    }
}

/// 日级处方理由（裁决调制与生成限制）。
public enum DayPrescriptionReason: Equatable, Sendable {
    case verdictLightReduced
    case verdictDeloadReduced
    case slotUnfilled(pattern: String)

    public var code: String {
        switch self {
        case .verdictLightReduced: return "verdictLightReduced"
        case .verdictDeloadReduced: return "verdictDeloadReduced"
        case .slotUnfilled: return "slotUnfilled"
        }
    }
}

public struct ExercisePrescriptionPlan: Equatable, Sendable {
    public let exerciseId: String
    public let sets: Int
    public let repLowerBound: Int
    public let repUpperBound: Int
    /// 本次的次数目标：加重/回退/首练 → repLowerBound；持平 → repUpperBound（双重渐进）。
    public let targetReps: Int
    /// kg 口径；显示单位换算归渲染层。
    public let targetWeightKg: Double
    public let targetRir: Double
    /// 上次同动作的工作重量（Receipt Change 行素材）；首练为 nil。
    public let previousWeightKg: Double?
    /// 上次顶组（最重一组）的次数——Rail「上次」节点素材；首练为 nil。
    public let previousTopReps: Int?
    /// 下次投影（target + 2.5 取整）——Rail「下次」节点素材。
    public let nextProjectedWeightKg: Double
    public let change: ChangeDirection
    public let reason: PrescriptionReason

    public init(
        exerciseId: String, sets: Int, repLowerBound: Int, repUpperBound: Int,
        targetReps: Int, targetWeightKg: Double, targetRir: Double,
        previousWeightKg: Double?, previousTopReps: Int?, nextProjectedWeightKg: Double,
        change: ChangeDirection, reason: PrescriptionReason
    ) {
        self.exerciseId = exerciseId
        self.sets = sets
        self.repLowerBound = repLowerBound
        self.repUpperBound = repUpperBound
        self.targetReps = targetReps
        self.targetWeightKg = targetWeightKg
        self.targetRir = targetRir
        self.previousWeightKg = previousWeightKg
        self.previousTopReps = previousTopReps
        self.nextProjectedWeightKg = nextProjectedWeightKg
        self.change = change
        self.reason = reason
    }
}

public struct TodayPrescription: Equatable, Sendable {
    /// 训练日 code（push-a / upper …）——RedeL10n TEMPLATE_NAME_MAP 渲染双语名。
    public let dayCode: String
    /// 有序动作清单（顺序 = 槽位顺序，稳定）。
    public let exercises: [ExercisePrescriptionPlan]
    public let dayReasons: [DayPrescriptionReason]

    public init(dayCode: String, exercises: [ExercisePrescriptionPlan], dayReasons: [DayPrescriptionReason]) {
        self.dayCode = dayCode
        self.exercises = exercises
        self.dayReasons = dayReasons
    }
}
