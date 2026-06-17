// CoachActionEngine — FR-T5 教练动作生成（系统逻辑 §6.4/§6.5.10）。
//
// 纯函数大脑：吃 app 层摊平的 primitives（CoachActionInput），产出优先级排序的 typed 教练动作。
// 引擎零文案、不落 engine output（系统逻辑 §6）——文案由 RedeL10n 按 reasonCode 渲染（切片6），
// 采纳/撤销由写闸落库（换动作=切片3 已通；补量/dismiss=切片5）。本切片只产建议，不接 UI、不写盘。
//
// 信号来源（app 层注入，不破包解耦）：
//  - stalledExerciseIds：本日处方里命中到顶/毕业 reason 的动作（换动作 hint）。
//  - sessionsLast7 / plannedDaysPerWeek / call / totalSessionCount：补量频率维度（来自 TodayVerdict）。
//  - dataFindingCount：DataQualityReport 的问题数（修数据 hint）。
//
// v1 范围：换动作（到顶）+ 补量（频率，无肌群无组数）+ 修数据。肌群级补量依赖未实现的 MLE/贡献权重，
// 推后（系统逻辑 §6.5.2 红线：无权重禁猜肌群）。
// 降频（切片6a，温和政策）：换动作/修数据同 actionKey 连续 ≥2 次暂不处理后不再出；补量本周已采纳
// （volumeBoostAdoptedThisWeek）或本周已暂不处理（≥1）后本周不再出。dismissals/采纳态由 app 从落库读出注入。

public enum CoachActionKind: Equatable, Sendable {
    case dataReview      // 修数据：有可疑记录，去进展页核对（只读导航）
    case exerciseSwap    // 换动作：某动作到顶/毕业，可换更难变体（采纳→换动作覆盖）
    case volumeBoost     // 补量：本周练得比计划少，可补一次（频率维度；采纳→补量意图）
}

/// 单条教练动作（typed，零文案）。文案/采纳写入由上层按 kind + reasonCode 处理。
public struct CoachAction: Equatable, Sendable {
    public let kind: CoachActionKind
    public let reasonCode: String        // typed code（如 dataHasFindings / ceilingReached / belowWeeklyPlan）
    public let exerciseId: String?       // exerciseSwap：到顶的动作 id
    public let count: Int?               // dataReview：可疑条数；volumeBoost：本周还差几次
    /// 降频/dismiss 标识键（引擎产出）：UI 点「暂不处理」即 dismiss 此 key；引擎据 dismissals[key] 降频。
    /// dataReview→"dataReview"；exerciseSwap→"exerciseSwap:<id>"；volumeBoost→"volumeBoost:<weekStartISO>"。
    public let actionKey: String
    public init(kind: CoachActionKind, reasonCode: String, exerciseId: String? = nil, count: Int? = nil, actionKey: String = "") {
        self.kind = kind
        self.reasonCode = reasonCode
        self.exerciseId = exerciseId
        self.count = count
        self.actionKey = actionKey
    }
}

/// 生成器输入（app 层把裁决/处方/数据质量摊平成 primitives 注入；clean input contract，§8）。
public struct CoachActionInput: Equatable, Sendable {
    public let call: TodayCall           // TodayVerdict.call（用枚举，守门编译期穷举安全，审查 M-1）
    public let sessionsLast7: Int
    public let plannedDaysPerWeek: Int
    public let totalSessionCount: Int    // 新用户守门（0 = 全新，不催补量）
    public let stalledExerciseIds: [String]  // 本日处方里到顶/毕业的动作（按出现序）
    public let dataFindingCount: Int     // 数据质量问题数（>0 触发修数据）
    // 降频/窗口（切片6a）：app 从 AppData.coachDismissals / volumeBoostWeeks + 本周锚点摊平注入。
    public let weekStartISO: String              // 本周 ISO 周一（补量按周抑制；默认空=不按周抑制）
    public let dismissals: [String: Int]         // actionKey → 累计暂不处理次数（降频源）
    public let volumeBoostAdoptedThisWeek: Bool  // 本周是否已采纳补量（采纳后本周不再出）
    public init(
        call: TodayCall, sessionsLast7: Int, plannedDaysPerWeek: Int, totalSessionCount: Int,
        stalledExerciseIds: [String], dataFindingCount: Int,
        weekStartISO: String = "", dismissals: [String: Int] = [:], volumeBoostAdoptedThisWeek: Bool = false
    ) {
        self.call = call
        self.sessionsLast7 = sessionsLast7
        self.plannedDaysPerWeek = plannedDaysPerWeek
        self.totalSessionCount = totalSessionCount
        self.stalledExerciseIds = stalledExerciseIds
        self.dataFindingCount = dataFindingCount
        self.weekStartISO = weekStartISO
        self.dismissals = dismissals
        self.volumeBoostAdoptedThisWeek = volumeBoostAdoptedThisWeek
    }
}

public enum CoachActionEngine {
    /// 产出优先级排序的教练动作：修数据 > 换动作 > 补量（数据可信 > 动作 > 量；§6.4/§6.5.10）。
    /// UI 层决定显示几条（设计：每屏 ≤1）。纯函数、确定性。
    public static func actions(input: CoachActionInput) -> [CoachAction] {
        // 降频（切片6a，温和政策）：换动作/修数据同 key 连续 ≥2 次暂不处理后不再出；
        // 补量本周已采纳或本周已暂不处理（≥1）后本周不再出。dismissals 来自落库的累计计数。
        func dismissed(_ key: String) -> Int { input.dismissals[key] ?? 0 }

        var out: [CoachAction] = []

        // ① 修数据（最高优先）：有可疑/被丢记录就提示去核对；连续 2 次暂不处理后不再出。
        if input.dataFindingCount > 0, dismissed("dataReview") < 2 {
            out.append(CoachAction(kind: .dataReview, reasonCode: "dataHasFindings",
                                   count: input.dataFindingCount, actionKey: "dataReview"))
        }

        // ② 换动作：本日处方里到顶/毕业的动作，可换更难变体（按出现序）；同动作连续 2 次暂不处理后不再出。
        for id in input.stalledExerciseIds {
            let key = "exerciseSwap:\(id)"
            if dismissed(key) < 2 {
                out.append(CoachAction(kind: .exerciseSwap, reasonCode: "ceilingReached", exerciseId: id, actionKey: key))
            }
        }

        // ③ 补量（频率，最低优先）：仅活跃日（train/light，绝不在 rest/deload 催量）、非新用户、
        // 本周已练 < 计划时出。无肌群无组数（§6.5.2 红线）。count = 本周还差几次。
        // 本周已采纳或已暂不处理（≥1）→ 本周不再出。
        if [TodayCall.train, .light].contains(input.call),
           input.totalSessionCount > 0,
           input.plannedDaysPerWeek > 0,
           input.sessionsLast7 >= 0,   // 防御非法负输入（审查 M-2）：负值不催、count 不虚高
           input.sessionsLast7 < input.plannedDaysPerWeek {
            let key = "volumeBoost:\(input.weekStartISO)"
            if !input.volumeBoostAdoptedThisWeek, dismissed(key) < 1 {
                out.append(CoachAction(
                    kind: .volumeBoost, reasonCode: "belowWeeklyPlan",
                    count: input.plannedDaysPerWeek - input.sessionsLast7, actionKey: key
                ))
            }
        }

        return out
    }
}
