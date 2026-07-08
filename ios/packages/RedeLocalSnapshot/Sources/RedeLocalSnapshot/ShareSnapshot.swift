// ShareSnapshot — 本地分享卡的只读派生展示对象（FR-SH1 S0，系统逻辑 §9.2/§9.3）。
//
// 隐私红线（SH2，§9.3）用**类型层结构性缺失**强制实现：本类型**只声明允许公开的字段**，
// 禁止字段（健身房位置/器械品牌/精确时间/HealthKit/体重/疼痛/RIR 明细/失败组/个人标识）
// 根本不存在——无法被序列化进卡片，编译期即杜绝泄露。易腐的精确量（训练时长秒）经
// SharePrivacyFilter **有损分桶**成"时长区间"（§9.3 允许"时长区间"、禁止"精确时间"）。
//
// 绝不写回 canonical AppData（§9.6 S0：纯本地、不联网、不建账号、不做归因）。
// app 组合层从 SessionSummary / StrengthMilestone 等已有派生映射出本类型的构造参数。
import Foundation

/// 训练时长区间（有损：只暴露粗粒度档，不暴露精确秒/分——§9.3 禁"精确时间"）。
public enum ShareDurationBand: String, Equatable, Sendable, CaseIterable {
    case under30, m30to45, m45to60, m60to90, over90

    /// 秒 → 区间档。负/0 归入 under30（防御）。
    public static func from(seconds: Int) -> ShareDurationBand {
        let m = max(0, seconds) / 60
        switch m {
        case ..<30: return .under30
        case 30..<45: return .m30to45
        case 45..<60: return .m45to60
        case 60..<90: return .m60to90
        default: return .over90
        }
    }
}

/// 一张分享卡的完整内容（仅允许字段）。生成日期为"日"粒度（无精确时刻）。
public struct ShareSnapshot: Equatable, Sendable {
    public let generatedDateISO: String   // yyyy-MM-dd（日粒度，§9.3 允许"生成日期"）
    public let content: Content

    public enum Content: Equatable, Sendable {
        case workoutSummary(WorkoutSummary)
        case personalRecord(PersonalRecord)
        case muscleLevel(MuscleLevel)
    }

    /// 训练总结卡：训练分类 + 完成动作/组数 + 时长区间 + 动作模式 + 是否破 PR。
    public struct WorkoutSummary: Equatable, Sendable {
        public let dayCode: String?            // 训练分类码（UI 本地化为名；如 push-a）。nil = 不显分类
        public let exerciseCount: Int          // 完成动作数
        public let setCount: Int               // 完成组数
        public let durationBand: ShareDurationBand
        public let patterns: [String]          // 动作模式码（去重保序、至多 6；UI 本地化）
        public let hadPR: Bool                 // 本场是否破 PR（仅布尔亮点，不带敏感明细）
        public init(dayCode: String?, exerciseCount: Int, setCount: Int,
                    durationBand: ShareDurationBand, patterns: [String], hadPR: Bool) {
            self.dayCode = dayCode
            self.exerciseCount = exerciseCount
            self.setCount = setCount
            self.durationBand = durationBand
            self.patterns = patterns
            self.hadPR = hadPR
        }
    }

    /// 肌群发展画像卡（MLE B5，§6.5.12 允许字段的 V1 收敛）：整体级别 + 均衡度 +
    /// 已解锁肌群等级列表（rawValue 码，UI 本地化）。契约 projection 的
    /// confidenceLabel **结构性缺失**（Copy Baseline §3.4 置信度零 UI 读数——比
    /// 契约的 String? nil 更硬）；levelProgress/safeEvidenceSummary/milestoneBadge
    /// V1 不进卡（版面克制 + 里程碑面归 PR 卡，收口写回 §6.5.12）。
    public struct MuscleLevel: Equatable, Sendable {
        public struct MuscleRow: Equatable, Sendable {
            public let muscleRaw: String       // MuscleGroupID rawValue（UI 本地化为名）
            public let level: Int              // 已解锁等级（≥1）
            public let trendRaw: String        // MuscleLevelTrend rawValue（UI 映射箭头）
            public init(muscleRaw: String, level: Int, trendRaw: String) {
                self.muscleRaw = muscleRaw
                self.level = level
                self.trendRaw = trendRaw
            }
        }
        public let tierRaw: String?            // TrainingTier rawValue；nil = 不显整体级别
        public let balanceScore: Int?          // 0-100 取整；nil = 解锁不足不显（不编数）
        public let muscles: [MuscleRow]        // 等级降序、至多 6（版面）
        public init(tierRaw: String?, balanceScore: Int?, muscles: [MuscleRow]) {
            self.tierRaw = tierRaw
            self.balanceScore = balanceScore
            self.muscles = muscles
        }
    }

    /// PR / 里程碑卡：动作 + 重量(kg canonical) + 次数 + 是否估算（e1RM）。
    /// 动作名（§9.2 PR 卡明列"动作"）+ PR 摘要属允许字段；重量按渲染时当前单位偏好显示
    /// （S0 不持久化快照、生成即当前单位，故不在快照里另存单位——避免两个真相源，审查 MAJOR）。
    public struct PersonalRecord: Equatable, Sendable {
        public let exerciseId: String          // UI 本地化为动作名
        public let weightKg: Double            // kg canonical；卡层按当前单位偏好格式化显示
        public let reps: Int
        public let isEstimated: Bool           // e1RM 估算 vs 实测（FR-PR7 诚实标注）
        public init(exerciseId: String, weightKg: Double, reps: Int, isEstimated: Bool) {
            self.exerciseId = exerciseId
            self.weightKg = weightKg
            self.reps = reps
            self.isEstimated = isEstimated
        }
    }
}

/// 隐私过滤 + 有损变换的唯一入口（SH2）。app 层只能经此构造 ShareSnapshot，
/// 不得绕过直接塞原始训练数据——保证精确时间/RIR/体重等永不进卡。
public enum SharePrivacyFilter {
    /// 训练总结卡。patterns 去重保序 + 截断至 6（避免泄露完整动作清单的细粒度顺序信息、也为版面）。
    public static func workoutSummary(
        generatedDateISO: String, dayCode: String?, exerciseCount: Int, setCount: Int,
        durationSeconds: Int, patterns: [String], hadPR: Bool
    ) -> ShareSnapshot {
        var seen = Set<String>()
        let cleanPatterns = patterns.filter { !$0.isEmpty && seen.insert($0).inserted }.prefix(6)
        return ShareSnapshot(
            generatedDateISO: generatedDateISO,
            content: .workoutSummary(.init(
                dayCode: dayCode,
                exerciseCount: max(0, exerciseCount),
                setCount: max(0, setCount),
                durationBand: ShareDurationBand.from(seconds: durationSeconds),
                patterns: Array(cleanPatterns),
                hadPR: hadPR
            ))
        )
    }

    /// PR / 里程碑卡。
    public static func personalRecord(
        generatedDateISO: String, exerciseId: String, weightKg: Double, reps: Int, isEstimated: Bool
    ) -> ShareSnapshot {
        ShareSnapshot(
            generatedDateISO: generatedDateISO,
            content: .personalRecord(.init(
                exerciseId: exerciseId,
                weightKg: max(0, weightKg),
                reps: max(0, reps),
                isEstimated: isEstimated
            ))
        )
    }

    /// 肌群发展画像卡（MLE B5）。调用方只传**已解锁**肌群（校准中不进卡——占位级
    /// 不是可分享成绩）；此处再做等级降序（同级按 muscleRaw 稳定）+ 截断 6 + 钳制。
    public static func muscleLevel(
        generatedDateISO: String, tierRaw: String?, balanceScore: Double?,
        muscles: [ShareSnapshot.MuscleLevel.MuscleRow]
    ) -> ShareSnapshot {
        let ordered = muscles
            .filter { $0.level >= 1 }
            .sorted { $0.level != $1.level ? $0.level > $1.level : $0.muscleRaw < $1.muscleRaw }
            .prefix(6)
        let balance = balanceScore.map { Int(min(max($0, 0), 100).rounded()) }
        return ShareSnapshot(
            generatedDateISO: generatedDateISO,
            content: .muscleLevel(.init(tierRaw: tierRaw, balanceScore: balance,
                                        muscles: Array(ordered)))
        )
    }
}
