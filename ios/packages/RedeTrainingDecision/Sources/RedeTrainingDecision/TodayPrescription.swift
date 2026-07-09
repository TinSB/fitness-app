// TodayPrescription — 今日处方输出（PRD FR-T2：动作、组数、目标重量与次数区间）。
//
// 全部 typed、kg 口径、零文案：lb 换算与「lb · ×5 · RIR 2」拼接归渲染层
// （FR-SE1 单位切换）；reason code 是 RedeL10n 双语模板的挂点（FR-T3 禁词
// 结构化满足）。previous→target→change 三元组同时喂 Receipt Change 行、
// 训练页 why 行与 Rail next 三个槽位。输出是纯派生，永不写回 AppData。

public enum ChangeDirection: String, Equatable, Sendable, Codable {
    case start
    case increase
    case hold
    case ease
}

/// 单动作处方理由（渐进决策的那条分支）。
public enum PrescriptionReason: Equatable, Sendable, Codable {
    case firstExposure
    case repCeilingReached
    case nearFailureLastTime
    case belowRepFloor
    case holdProgressing
    /// 自重动作加次数到顶——提示加配重或换更难变体（owner 拍板 2026-06-13）。
    case bodyweightCeilingReached
    /// 辅助器械辅助降到最小一片还有余力——自动换自重版毕业（owner 拍板 2026-06-13，wave-9）。
    case assistedGraduated
    /// 负重自重外挂负重减到最小一片还吃力——自动回退换自重孪生（owner 拍板 2026-06-14，wave-11）。
    case bodyweightPlusDegraded
    /// 弹力带加次数到顶——提示换重一档的带子（owner 拍板 2026-06-14，wave-12）。
    /// 区别于自重到顶（.bodyweightCeilingReached「加配重/换更难变体」）：弹力带换更重的带子才是真实进阶路径。
    case bandCeilingReached

    public var code: String {
        switch self {
        case .firstExposure: return "firstExposure"
        case .repCeilingReached: return "repCeilingReached"
        case .nearFailureLastTime: return "nearFailureLastTime"
        case .belowRepFloor: return "belowRepFloor"
        case .holdProgressing: return "holdProgressing"
        case .bodyweightCeilingReached: return "bodyweightCeilingReached"
        case .assistedGraduated: return "assistedGraduated"
        case .bodyweightPlusDegraded: return "bodyweightPlusDegraded"
        case .bandCeilingReached: return "bandCeilingReached"
        }
    }

    /// 到顶/毕业里程事件：换动作教练卡触发源（FR-T5 stalledExerciseIds）+ 处方行里程标注同口径。
    /// **穷举无 default**：新增 ceiling/graduation case 时编译器强制本处与两个 app 消费点同步更新，
    /// 杜绝无声漂移（审查）。注意：有重量动作的 `repCeilingReached` 只是加重、不触发换动作。
    public var isCeilingOrGraduationMilestone: Bool {
        switch self {
        case .bodyweightCeilingReached, .assistedGraduated, .bodyweightPlusDegraded, .bandCeilingReached:
            return true
        case .firstExposure, .repCeilingReached, .nearFailureLastTime, .belowRepFloor, .holdProgressing:
            return false
        }
    }
}

/// 日级处方理由（裁决调制与生成限制）。
public enum DayPrescriptionReason: Equatable, Sendable, Codable {
    case verdictLightReduced
    case verdictDeloadReduced
    case comebackCycleRestart
    case carriedOverFromLastWeek
    case slotUnfilled(pattern: String)

    public var code: String {
        switch self {
        case .verdictLightReduced: return "verdictLightReduced"
        case .verdictDeloadReduced: return "verdictDeloadReduced"
        case .comebackCycleRestart: return "comebackCycleRestart"
        case .carriedOverFromLastWeek: return "carriedOverFromLastWeek"
        case .slotUnfilled: return "slotUnfilled"
        }
    }
}

public struct ExercisePrescriptionPlan: Equatable, Sendable, Codable {
    public let exerciseId: String
    public let sets: Int
    /// 组间休息秒数（slot 生成参数，沿 legacy 模板口径）。
    public let restSeconds: Int
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
    /// 下次投影（target + 一档取整）——Rail「下次」节点素材。
    public let nextProjectedWeightKg: Double
    /// 渐进一档（kg）= 该动作器械×用户单位的真实档位步长（LoadGrid 解析值）；
    /// 快改档位/刻度轨/组内安全瀑布同源消费。
    public let progressionStepKg: Double
    public let change: ChangeDirection
    public let reason: PrescriptionReason
    /// 负重语义（external / bodyweight / …）：渲染层据此判定「显示重量」还是
    /// 「仅次数」（自重动作无外部负重，targetWeightKg=0）。默认 external 兼容旧 draft。
    public let loadType: String
    /// 器械类（dumbbell/barbell/cable/…）：渲染层据此取「器械×单位真实梯子」吸附显示重量
    /// （§8 显示吸附契约）。默认 dumbbell 兼容旧 draft。
    public let equipment: String

    public init(
        exerciseId: String, sets: Int, restSeconds: Int, repLowerBound: Int, repUpperBound: Int,
        targetReps: Int, targetWeightKg: Double, targetRir: Double,
        previousWeightKg: Double?, previousTopReps: Int?, nextProjectedWeightKg: Double,
        progressionStepKg: Double,   // 无默认值：忘传=编译错（同 rank 的 M2 教训）；decode 缺省仅为旧 draft 兼容
        change: ChangeDirection, reason: PrescriptionReason, loadType: String = "external",
        equipment: String = "dumbbell"
    ) {
        self.exerciseId = exerciseId
        self.sets = sets
        self.restSeconds = restSeconds
        self.repLowerBound = repLowerBound
        self.repUpperBound = repUpperBound
        self.targetReps = targetReps
        self.targetWeightKg = targetWeightKg
        self.targetRir = targetRir
        self.previousWeightKg = previousWeightKg
        self.previousTopReps = previousTopReps
        self.nextProjectedWeightKg = nextProjectedWeightKg
        self.progressionStepKg = progressionStepKg
        self.change = change
        self.reason = reason
        self.loadType = loadType
        self.equipment = equipment
    }

    enum CodingKeys: String, CodingKey {
        case exerciseId, sets, restSeconds, repLowerBound, repUpperBound
        case targetReps, targetWeightKg, targetRir, previousWeightKg, previousTopReps
        case nextProjectedWeightKg, progressionStepKg, change, reason, loadType, equipment
    }

    /// 自定义解码仅为 progressionStepKg 缺省 2.5：当日旧 draft（升级前落盘）
    /// 仍可恢复，不因新字段整场作废。
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        exerciseId = try c.decode(String.self, forKey: .exerciseId)
        sets = try c.decode(Int.self, forKey: .sets)
        restSeconds = try c.decode(Int.self, forKey: .restSeconds)
        repLowerBound = try c.decode(Int.self, forKey: .repLowerBound)
        repUpperBound = try c.decode(Int.self, forKey: .repUpperBound)
        targetReps = try c.decode(Int.self, forKey: .targetReps)
        targetWeightKg = try c.decode(Double.self, forKey: .targetWeightKg)
        targetRir = try c.decode(Double.self, forKey: .targetRir)
        previousWeightKg = try c.decodeIfPresent(Double.self, forKey: .previousWeightKg)
        previousTopReps = try c.decodeIfPresent(Int.self, forKey: .previousTopReps)
        nextProjectedWeightKg = try c.decode(Double.self, forKey: .nextProjectedWeightKg)
        progressionStepKg = try c.decodeIfPresent(Double.self, forKey: .progressionStepKg) ?? 2.5
        change = try c.decode(ChangeDirection.self, forKey: .change)
        reason = try c.decode(PrescriptionReason.self, forKey: .reason)
        loadType = try c.decodeIfPresent(String.self, forKey: .loadType) ?? "external"
        equipment = try c.decodeIfPresent(String.self, forKey: .equipment) ?? "dumbbell"
    }
}

public struct TodayPrescription: Equatable, Sendable, Codable {
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
