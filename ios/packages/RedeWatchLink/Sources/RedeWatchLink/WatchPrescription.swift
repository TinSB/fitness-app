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
    /// 正在进行的那一场（切片 4）。nil = 还没开练 / 已练完，表上只显示清单。
    ///
    /// 为什么塞进同一份载荷而不另发一条：applicationContext **只有一个槽位**，
    /// 谁后写谁赢。两种 kind 各发一次的结果是互相覆盖（切片 3 已因此删掉 pongCtx）。
    public let active: Active?

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

    /// 训练进行时的当前一组。
    ///
    /// 这里**同时带显示串和原值**，两者用途不同、缺一不可：
    /// · targetText 是给人看的（已过器械梯子吸附 + 单位格式化，理由见文件头）
    /// · targetWeightKg / targetRir 是**回传原值**——表记完这一组要原样回给手机，
    ///   让它进 CompletedSetObservation。表不重算重量，只是把手机给的数原样送回。
    ///
    /// 唯独 reps 是表可以改的：重量是练之前配上器械的（照处方配），
    /// 次数是练出来的结果——最常偏离目标的就是它。
    public struct Active: Codable, Equatable, Sendable {
        public let exerciseId: String
        public let exerciseName: String
        /// 1-based，指**接下来要做的那一组**。回传时原样带上，手机据此判断是不是同一组。
        public let setNumber: Int
        public let setTotal: Int
        public let exerciseNumber: Int
        public let exerciseTotal: Int
        /// 已渲染的目标，如「37.5 kg × 6」。
        public let targetText: String
        public let targetWeightKg: Double
        public let targetReps: Int
        public let targetRir: Double
        /// 手机此刻在休息倒计时里。表上这时不该给「完成这一组」——那一组还没开始做。
        public let isResting: Bool

        public init(exerciseId: String, exerciseName: String, setNumber: Int, setTotal: Int,
                    exerciseNumber: Int, exerciseTotal: Int, targetText: String,
                    targetWeightKg: Double, targetReps: Int, targetRir: Double, isResting: Bool) {
            self.exerciseId = exerciseId
            self.exerciseName = exerciseName
            self.setNumber = setNumber
            self.setTotal = setTotal
            self.exerciseNumber = exerciseNumber
            self.exerciseTotal = exerciseTotal
            self.targetText = targetText
            self.targetWeightKg = targetWeightKg
            self.targetReps = targetReps
            self.targetRir = targetRir
            self.isResting = isResting
        }
    }

    public init(dateISO: String, dayTitle: String, exercises: [Item], active: Active? = nil) {
        self.dateISO = dateISO
        self.dayTitle = dayTitle
        self.exercises = exercises
        self.active = active
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
