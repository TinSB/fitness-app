// MuscleLevelCopy — MLE Development 块双语文案（批次 B B3 2026-07-07，FR-PR6）。
//
// 红线（§6.5.11 + Copy Baseline §3.4）：
// · 置信度零 UI 读数——走行为表达（校准中/更保守），本文件不存在「置信度」字样。
// · 禁羞辱：无「你的 X 很弱 / 等级低=身材差」类文案；补足语义中性（「正在补足」
//   是计划视角，不是身体评判）。
// · maintain 不出语义标签（8 行全贴「维持即可」=标签噪音；等级本身就是维持的表达
//   ——批次执行中对交接件原稿的收敛，交接件 B3 段已同步改写，收口写回 §6.5.11）。
// · recover 按 trend 拆两条文案：detraining（只是没练）=「先找回节奏」，避免
//   「恢复优先」误读成伤病/超量信号（审查 M7；pain/safety 喂数未接，接入后走恢复优先）。
// · 跨包枚举经本地镜像（RedeL10n 不依赖 RedeLocalSnapshot，同 ShareDurationBandLabel 先例）。

import Foundation

/// MuscleGroupID 的镜像（app 层从 rawValue 映射；未知值由 app 层如实跳过）。
public enum MuscleGroupLabel: String, CaseIterable, Equatable, Sendable {
    case chest, back, quads, hamstrings, glutes
    case shoulders, biceps, triceps, calves, core
}

/// TrainingTier 的镜像。
public enum TrainingTierLabel: String, CaseIterable, Equatable, Sendable {
    case calibrating, beginner, novicePlus, intermediate, advanced, elite
}

/// 需要出语义标签的 decision 子集（maintain/insufficientData 无标签，见文件头拍板）。
public enum MuscleDecisionLabel: String, CaseIterable, Equatable, Sendable {
    case prioritize, recover
}

/// evidence/limitation code 的人话翻译键（引擎 code 字符串 → 依据行；app 层映射）。
/// 九个 code 与引擎产出全集一一对应（审查 M4：漏配=依据行静默丢失，测试全量锁）。
public enum MuscleEvidenceLabel: String, CaseIterable, Equatable, Sendable {
    case exposureRecentSets
    case e1rmRising, e1rmHolding, e1rmDeclining
    case noBaselineWindow, noRecentWindow, shortHistory
    case noStrengthSignal, milestoneFloorApplied
    case confidenceLevelCapApplied
}

extension RedeStrings {
    // MARK: - Development 区块（FR-PR6）

    /// 区块标题。
    public var developmentTitle: String { tML("发展", "Development") }

    /// 肌群显示名。
    public func muscleGroupName(_ group: MuscleGroupLabel) -> String {
        switch group {
        case .chest: return tML("胸部", "Chest")
        case .back: return tML("背部", "Back")
        case .quads: return tML("腿前侧", "Quads")
        case .hamstrings: return tML("腿后侧", "Hamstrings")
        case .glutes: return tML("臀部", "Glutes")
        case .shoulders: return tML("肩部", "Shoulders")
        case .biceps: return tML("肱二头", "Biceps")
        case .triceps: return tML("肱三头", "Triceps")
        case .calves: return tML("小腿", "Calves")
        case .core: return tML("核心", "Core")
        }
    }

    /// 整体级别标签（§6.5.4 拍板文案）。
    public func trainingTierName(_ tier: TrainingTierLabel) -> String {
        switch tier {
        case .calibrating: return tML("校准中", "Calibrating")
        case .beginner: return tML("初级", "Beginner")
        case .novicePlus: return tML("进阶初期", "Novice+")
        case .intermediate: return tML("中级", "Intermediate")
        case .advanced: return tML("高级", "Advanced")
        case .elite: return tML("精英", "Elite")
        }
    }

    /// 整体级别行前缀。
    public var developmentTierLabel: String { tML("整体级别", "Overall level") }

    /// 均衡度行（0-100 整数）。
    public func developmentBalanceLine(_ score: Int) -> String {
        tML("均衡度 \(score)", "Balance \(score)")
    }

    /// 等级显示（Lv.N 两语通用，语义留函数便于未来分语言）。
    public func developmentLevel(_ level: Int) -> String { "Lv.\(level)" }

    /// decision 语义标签（仅 prioritize/recover，见文件头拍板）。
    public func muscleDecisionLabel(_ decision: MuscleDecisionLabel) -> String {
        switch decision {
        case .prioritize: return tML("正在补足", "Building up")
        case .recover: return tML("恢复优先", "Recovery first")
        }
    }

    /// recover × detraining 的替代标签（文件头拆分：没练≠受伤）。
    public var muscleDecisionEaseBackIn: String { tML("先找回节奏", "Ease back in") }

    /// 展开依据的 a11y 提示（审查 M6：hint 要说操作，不是塞区块标题）。
    public var developmentExpandHint: String { tML("查看依据", "Show reasoning") }

    /// 设置页训练背景行标签（FR-PR6 上线后与系统评估等级区分：这是自报输入，
    /// 不是系统判定——§6.5.14 legacy merge，两套「等级」不得打架）。
    public var settingsSelfReportedBackgroundLabel: String { tML("自报背景", "Self-reported") }

    /// 全员校准态正文（§6.5.9 #3；两拍全角空格、无句号无破折号——Copy Baseline §3.4/§3.5）。
    public var developmentCalibratingBody: String {
        tML("正在校准肌群等级　继续训练会逐个解锁出分",
          "Calibrating muscle levels. Keep training and each one unlocks")
    }

    /// 部分解锁时，其余校准中肌群的折叠行（en 单复数分支，审查 M8）。
    public func developmentRemainingCalibrating(_ count: Int) -> String {
        count == 1
            ? tML("其余 1 个肌群正在校准", "1 more muscle calibrating")
            : tML("其余 \(count) 个肌群正在校准", "\(count) more muscles calibrating")
    }

    /// evidence/limitation 人话（展开的依据行；引擎 code → 中性解释，禁恐吓）。
    public func muscleEvidenceLine(_ evidence: MuscleEvidenceLabel) -> String {
        switch evidence {
        case .exposureRecentSets: return tML("近期训练量扎实", "Solid recent training volume")
        case .e1rmRising: return tML("强度在稳定上升", "Strength trending up")
        case .e1rmHolding: return tML("强度保持稳定", "Strength holding steady")
        case .e1rmDeclining: return tML("近期强度略有回落", "Strength slightly down lately")
        case .noBaselineWindow: return tML("还在建立强度基线", "Still building a strength baseline")
        case .noRecentWindow: return tML("近期缺少该肌群的训练", "No recent training for this muscle")
        case .shortHistory: return tML("训练数据还不够", "Not enough training data yet")
        case .noStrengthSignal: return tML("暂无可比的强度数据", "No comparable strength data yet")
        case .milestoneFloorApplied: return tML("力量突破抬升了等级起点", "A strength milestone raised this level")
        case .confidenceLevelCapApplied:
            return tML("数据量还撑不起更高等级　继续练会解锁", "More training data unlocks higher levels")
        }
    }

    /// Development 块分享入口（MLE B5，FR-SH3 入口延续样式）。
    public var developmentShareAction: String { tML("分享发展画像", "Share development") }

    /// 解锁行 a11y：肌群 + 等级 + 可选语义。
    public func developmentRowA11y(muscle: String, level: Int, decision: String?) -> String {
        let base = tML("\(muscle)，等级 \(level)", "\(muscle), level \(level)")
        guard let decision else { return base }
        return base + tML("，\(decision)", ", \(decision)")
    }

    private func tML(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
