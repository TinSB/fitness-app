import Foundation

// 手机 → 表的今日处方（切片 3，2026-08-15）。
//
// **全部是已渲染好的显示串，不是原始数值**。这不是偷懒，是这个项目的既定分工：
// 手机是唯一决策方，表上没有设置页（方案锁定：计划/进展/设置/动作库/引导都留在手机）。
// 表既然永远不需要换单位、换语言、重排动作，它就永远不需要重新渲染——
// 那么把 kg 值、器械梯子、locale、单位偏好一路同步过去只是在制造漂移面。
//
// 具体避掉的坑：重量显示必须先吸附到「器械 × 当前显示单位」的真实梯子再格式化
//（LoadDisplay 的显示吸附契约，复发过：裸换算会让 kg 侧 30kg 在 lb 侧显成配不出的 66lb）。
// 那套逻辑在 app 层、有 33 处调用点。表上重写一遍 = 迟早两块屏幕对同一次训练显示不同重量。
// 传字符串，这个问题在结构上就不存在。
//
// 相对地，**exerciseId 是语义身份、必须传**：一天里允许出现同名动作，
// 没有稳定 id 表上的行就没有 identity。切片 4 记组也要靠它回填。
public struct WatchPrescription: Codable, Equatable, Sendable {
    /// 处方对应的**本地日**（yyyy-MM-dd）。必传：applicationContext 会一直留在表上，
    /// 手机关机三天后表上显示的还是最后那份——不带日期的话，用户没法分辨
    /// 「今天的计划」和「三天前的残影」。表侧据此判断是否过期。
    public let dateISO: String
    /// 已本地化的训练日名（「上肢」/「Upper」）。空 = 今天不是训练日。
    public let dayTitle: String
    /// 有序动作清单。**空数组是合法且有意义的**：休息日就该是空的，
    /// 表上要显示「今天休息」而不是继续显示上一次的动作。
    public let exercises: [Item]

    public struct Item: Codable, Equatable, Sendable {
        /// 语义身份（切片 4 记组回填用）。同一天允许同名动作，所以行的 identity 只能靠它。
        public let exerciseId: String
        /// 已本地化的动作名。
        public let name: String
        /// 「4 组」这类已渲染的组数串。传串而不传 Int，理由同上：数字后面跟什么词是语言问题。
        public let setsText: String
        /// 已渲染的目标，如「60 kg · ×8-10」「自重 · ×12」。重量已过器械梯子吸附。
        public let targetText: String

        public init(exerciseId: String, name: String, setsText: String, targetText: String) {
            self.exerciseId = exerciseId
            self.name = name
            self.setsText = setsText
            self.targetText = targetText
        }
    }

    public init(dateISO: String, dayTitle: String, exercises: [Item]) {
        self.dateISO = dateISO
        self.dayTitle = dayTitle
        self.exercises = exercises
    }

    // MARK: - 编解码

    /// 编码失败返回 nil 而不是抛：调用点是「顺手推一份给表」，
    /// 它不该因为编码问题中断今日页加载。失败就是这次不推，下次 loadToday 还会再来。
    public var encoded: Data? { try? JSONEncoder().encode(self) }

    public init?(decoding data: Data) {
        guard let decoded = try? JSONDecoder().decode(WatchPrescription.self, from: data) else { return nil }
        self = decoded
    }
}
