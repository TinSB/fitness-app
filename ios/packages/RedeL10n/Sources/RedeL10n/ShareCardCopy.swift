// FR-SH1 S0 本地分享卡双语文案。§7.3 中性、价值先行、不羞辱不施压；诚实标注估算。
import Foundation

extension RedeStrings {
    /// 训练总结卡标题。
    public var shareCardWorkoutTitle: String { locale == .zh ? "训练完成" : "Workout done" }
    /// PR / 里程碑卡标题。
    public var shareCardPRTitle: String { locale == .zh ? "个人纪录" : "Personal record" }
    /// 破纪录微标（训练总结卡上）。
    public var shareCardPRBadge: String { locale == .zh ? "刷新纪录" : "New PR" }
    /// e1RM 估算微标（诚实标注，非实测）。
    public var shareCardEstimated: String { locale == .zh ? "估算" : "Estimated" }

    public var shareCardStatExercises: String { locale == .zh ? "动作" : "Exercises" }
    public var shareCardStatSets: String { locale == .zh ? "组" : "Sets" }
    public var shareCardStatDuration: String { locale == .zh ? "时长" : "Duration" }

    /// 时长区间显示名（有损档，不报精确时间）。
    public func shareCardDurationBand(_ band: ShareDurationBandLabel) -> String {
        switch band {
        case .under30: return locale == .zh ? "<30 分" : "<30 min"
        case .m30to45: return locale == .zh ? "30–45 分" : "30–45 min"
        case .m45to60: return locale == .zh ? "45–60 分" : "45–60 min"
        case .m60to90: return locale == .zh ? "60–90 分" : "60–90 min"
        case .over90:  return locale == .zh ? ">90 分" : ">90 min"
        }
    }

    /// 品牌标语（卡片页脚；中性、点出"决策在前"定位）。
    public var shareCardTagline: String {
        locale == .zh ? "替你决定今天该练什么" : "Decides what to train today"
    }
    /// 下载入口提示（App 未上架时的兜底：引导到 App Store 搜索）。
    public var shareCardDownloadHint: String {
        locale == .zh ? "App Store 搜索 Rede" : "Find Rede on the App Store"
    }
    /// 分享动作按钮。
    public var shareCardShareAction: String { locale == .zh ? "分享" : "Share" }
    /// 预览无内容兜底。
    public var shareCardNothing: String { locale == .zh ? "暂无可分享的内容" : "Nothing to share yet" }
}

/// RedeL10n 不依赖 RedeLocalSnapshot，故用本地镜像枚举传递时长档（app 层从
/// `ShareDurationBand` 映射到此，避免跨包依赖）。
public enum ShareDurationBandLabel: Equatable, Sendable {
    case under30, m30to45, m45to60, m60to90, over90
}
