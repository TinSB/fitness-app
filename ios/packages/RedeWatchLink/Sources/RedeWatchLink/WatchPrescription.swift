import Foundation

// 手机 → 表的今日处方（切片 3，2026-08-15）。
//
// **全部是已渲染好的显示串，不是原始数值**。这不是偷懒，是这个项目的既定分工：
// 手机是唯一决策方，表上没有设置页（方案锁定：计划/进展/设置/动作库/引导都留在手机）。
// 表既然永远不需要换单位、换语言、重排动作，它就永远不需要重新渲染——
// 那么把 kg 值、器械梯子、locale、单位偏好一路同步过去只是在制造漂移面。
//
// 具体避掉的坑：重量显示必须先吸附到「器械 × 当前显示单位」的真实梯子再格式化
//（重量按用户事实如实转述：落格是引擎生成处方时的职责，见 RedeComponents 顶部边界注释）。
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
    /// 手机 app 当前的界面语言（"zh" / "en"）。**表跟随手机 app 的语言，不跟随表的系统语言**：
    /// 动作名、目标串都是手机按 app 语言渲染的，表自己那几个词（「休息」「下一组」）
    /// 若按表的系统语言取，同一屏就会中英混排——app 内有独立的语言开关，这不是假想场景。
    /// 可选：旧手机不带这一位时表退回系统语言（与之前行为一致）。
    public let localeCode: String?
    /// 今天已经练完的组数（v3.2）。> 0 且没有进行中的训练 = 今天练完了：
    /// 表上清单头显示「今天练完了 · N 组」、第一行不再画 Emberline。
    /// nil / 0 = 今天还没练。手机按 canonical 记录里今天日期的场次数出来，**另加**今天开练、刚到小结
    /// 还没点保存的这一场，以及刚存好、今日还没重载的那一场（2026-10-19：最后一组一记完表上就该
    /// 说练完了，而不是退回开练前的清单；存的那一下也不闪回）。
    public let completedSetsToday: Int?
    /// 训练是否进行中（v3.3）：flow 存在且还没到小结。**表上的 HKWorkoutSession 跟这一位走，
    /// 不跟「表上有没有记组屏」走**——手机弹「结束训练？」确认层时 active 是 nil（表退回清单），
    /// 但训练没结束；之前拿 active 判会把 HK 会话收掉写进健康、点「继续训练」再新开一条，
    /// 健康里一场被拆成两段（审查 M1）。旧手机不带这一位时退回 active != nil。
    public let trainingInProgress: Bool?
    /// 刚结束的那场是怎么结束的（v3.3）："completed"（到小结 / 已保存）或 "abandoned"（放弃、什么都不存）。
    /// 表据此决定 HK 会话是 finishWorkout（写进健康）还是 discardWorkout（放弃的训练不该进健康）。
    /// 只在 trainingInProgress == false 时有意义；进行中为 nil。
    public let sessionOutcome: String?

    public struct Item: Codable, Equatable, Sendable {
        /// 语义身份（切片 4 记组回填用）。同一天允许同名动作，所以行的 identity 只能靠它。
        public let exerciseId: String
        /// 已本地化的动作名。
        public let name: String
        /// 「4 组」这类已渲染的组数串。传串而不传 Int，理由同上：数字后面跟什么词是语言问题。
        public let setsText: String
        /// 已渲染的整串目标，如「60 kg × 8」；自重 / 弹力带只有「× 8」。重量已过器械梯子吸附。
        /// 无障碍标签与旧手机的退路都用它。
        public let targetText: String
        /// targetText 的分段（2026-10，视觉对齐）：表上清单行按「数值大、单位小」排字阶。
        /// 可选 additive：旧手机不带这一位时解码为 nil，表退回整串 targetText 同字号。
        /// 分段由手机用 RedeL10n.targetParts 渲染，各段拼起来与 targetText 逐字一致；表不解析字符串。
        public let targetParts: TargetParts?

        public init(exerciseId: String, name: String, setsText: String, targetText: String,
                    targetParts: TargetParts? = nil) {
            self.exerciseId = exerciseId
            self.name = name
            self.setsText = setsText
            self.targetText = targetText
            self.targetParts = targetParts
        }
    }

    /// 目标串的分段，字段与 RedeL10n.TargetParts 同义（本包不依赖 L10n，故各自一份）。
    public struct TargetParts: Codable, Equatable, Sendable {
        public let prefix: String?   // 「辅助」「负重」（en 侧多为 nil）
        public let value: String?    // 「37.5」「+10」；自重 / 弹力带为 nil
        public let unit: String?     // 「kg」「lb」；辅助与负重不带单位
        public let reps: String      // 「× 6」

        public init(prefix: String?, value: String?, unit: String?, reps: String) {
            self.prefix = prefix
            self.value = value
            self.unit = unit
            self.reps = reps
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
        /// 休息倒计时的**绝对结束时刻**（切片 5）。nil = 没在休息或已暂停。
        ///
        /// 传时刻而不传剩余秒数：传秒数的话消息延迟多久倒计时就差多久，
        /// 而且表侧每秒都得等手机发一条。传时刻，表自己按墙钟算——
        /// 延迟、丢包、app 被挂起后重开都不影响准确性。
        public let restEndsAt: Date?
        /// 这一段休息的总时长（进度环分母）。手机上「+30 秒」会让它同步增长。
        public let restTotalSeconds: Int
        /// 暂停中冻结的剩余秒数。非 nil = 手机上把倒计时按停了。
        public let restPausedRemaining: Int?
        /// 这一步是**热身**还是正式组。
        ///
        /// 必传，而且是这条载荷里最要紧的一位：手机在热身（空杆）时表上若显示正式组重量，
        /// 用户照着练就会直接上重量——那是会受伤的。2026-08-15 owner 真机拍到过。
        /// 热身**不落库**：表上点完成只是推进热身步，次数也不可改（热身次数不记录）。
        public let isWarmup: Bool
        /// 表上可调的三个量的**素材**（v2，2026-08-15）。nil = 旧手机没推（表退回只调次数）。
        ///
        /// 重量为什么以「梯子」形式给：表上改重量必须落在「器械 × 显示单位」的真实格子上
        ///（LoadGrid：kg 杠铃 2.5 一格、lb 哑铃轻段 2.5lb 中段 5lb……）。那套梯子在手机侧
        /// 已经和 33 处显示调用点对齐，表上重算一遍迟早两块屏对不上。所以手机把目标前后
        /// 各若干格**连同显示串**一起推过来，表只做一件事：用表冠在格子间选。
        public let adjust: Adjust?
        /// 休息屏环下那一行「等下做什么」，手机渲染（v3）：「下一组 · 第 3 组 · 60 kg × 6」，
        /// 或本动作已做完时的「接下来 · 高位下拉」。与手机休息屏 restPreviewText 逐字同源。
        /// 只在 isResting 时有值；旧手机不带这一位时表退回「下一组 + targetText」——
        /// 那个退路在动作最后一组休息时会显示「× 0」（targetReps 此时没有建议），所以这一位要有。
        public let restPreviewText: String?
        /// 同一句预告的分层版（v4，2026-10-19）：小标「下一组 · 第 3 组」/「接下来」+ 主值（下一组目标分段，
        /// 或下一个动作名）。表上分两层排，不再把整句压成一行 10pt 小字。只在 isResting 时有值；
        /// 旧手机不带时表退回 restPreviewText 整句。
        public let restPreview: RestPreview?
        /// 点完成这一组后手机会开始的休息时长（秒）——已含本场对这个动作的调整与 15 秒下限，
        /// 与手机 `restSeconds(for:)` 同一个数（v4，Master v3.9 §5 第 6 条：owner 2026-10-19 拍板
        /// 「点完成即休息」）。表记完这一组**立刻**按它开始倒计时，不等手机醒来；手机接手后以手机那份为准。
        /// nil = 这一组之后没有休息（热身步 / 全场最后一组）、正在休息、或旧手机——表照旧等手机。
        public let restAfterSetSeconds: Int?
        /// 预休息时环下那一行（v4）：只说接下来是哪一组 / 哪个动作，**不带目标**——
        /// 下一组练多少要等手机按这一组的实际完成算，表不猜。手机接手后换成 restPreview。
        public let restAfterSetPreview: RestPreview?

        public init(exerciseId: String, exerciseName: String, setNumber: Int, setTotal: Int,
                    exerciseNumber: Int, exerciseTotal: Int, targetText: String,
                    targetWeightKg: Double, targetReps: Int, targetRir: Double,
                    isResting: Bool, isWarmup: Bool = false,
                    restEndsAt: Date? = nil, restTotalSeconds: Int = 0,
                    restPausedRemaining: Int? = nil, adjust: Adjust? = nil,
                    restPreviewText: String? = nil, restPreview: RestPreview? = nil,
                    restAfterSetSeconds: Int? = nil, restAfterSetPreview: RestPreview? = nil) {
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
            self.isWarmup = isWarmup
            self.restEndsAt = restEndsAt
            self.restTotalSeconds = restTotalSeconds
            self.restPausedRemaining = restPausedRemaining
            self.adjust = adjust
            self.restPreviewText = restPreviewText
            self.restPreview = restPreview
            self.restAfterSetSeconds = restAfterSetSeconds
            self.restAfterSetPreview = restAfterSetPreview
        }
    }

    /// 休息屏环下的预告，分两层（v4）：小标走仪表标签，主值走目标簇（数值大、单位小）或动作名。
    /// 全部由手机渲染——表不拼文案、不算目标。
    public struct RestPreview: Codable, Equatable, Sendable {
        /// 「下一组 · 第 3 组」/「接下来」。
        public let caption: String
        /// 换动作时的下一个动作名；同一动作的下一组为 nil。
        public let title: String?
        /// 下一组目标的分段；预休息（手机还没按实际完成算出下一组）或换动作时为 nil。
        public let parts: TargetParts?

        public init(caption: String, title: String? = nil, parts: TargetParts? = nil) {
            self.caption = caption
            self.title = title
            self.parts = parts
        }

        /// 整句（无障碍朗读用）：小标 + 主值。
        public var spoken: String {
            let main = title ?? parts.map { [$0.prefix, $0.value, $0.unit, $0.reps].compactMap { $0 }.joined(separator: " ") }
            return [caption, main].compactMap { $0 }.joined(separator: " · ")
        }
    }

    /// 表上快改的素材。与手机快改面板同源：重量走真实梯子，次数与 RIR 的可选范围
    /// 两端一样（次数 1…50；RIR「—」= 不记、0…5）——后两者范围固定，不必传。
    public struct Adjust: Codable, Equatable, Sendable {
        /// 升序的重量格子，**含目标那一格**。空数组 = 这个动作没有重量轴（自重 / 弹力带），
        /// 表上不显示重量瓦片——与手机「自重无重量轴」同一口径。
        public let weightRungs: [WeightRung]
        /// 重量瓦片下面那行小字：「kg」/「lb」；辅助器械「辅助 kg」；负重自重「负重 kg」。
        /// 手机渲染，理由同 targetText——单位与负荷类型的措辞都是手机的事。
        public let weightCaption: String

        public init(weightRungs: [WeightRung], weightCaption: String) {
            self.weightRungs = weightRungs
            self.weightCaption = weightCaption
        }
    }

    /// 梯子上的一格：回传用的 kg 原值 + 手机按当前单位渲染好的显示串（「62.5」/「135」）。
    public struct WeightRung: Codable, Equatable, Sendable {
        public let kg: Double
        public let text: String

        public init(kg: Double, text: String) {
            self.kg = kg
            self.text = text
        }
    }

    public init(dateISO: String, dayTitle: String, exercises: [Item], active: Active? = nil,
                localeCode: String? = nil, completedSetsToday: Int? = nil,
                trainingInProgress: Bool? = nil, sessionOutcome: String? = nil) {
        self.dateISO = dateISO
        self.dayTitle = dayTitle
        self.exercises = exercises
        self.active = active
        self.localeCode = localeCode
        self.completedSetsToday = completedSetsToday
        self.trainingInProgress = trainingInProgress
        self.sessionOutcome = sessionOutcome
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
