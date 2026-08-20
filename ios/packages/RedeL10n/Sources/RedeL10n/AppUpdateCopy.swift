// AppUpdateCopy — FR-SE10 版本检查、更新信号与内置 What's New 双语文案。
//
// 只描述公开版本与已经随版本交付的事实；不生成远程营销文案，不附常驻说明小字。

extension RedeStrings {
    public var appUpdateSection: String {
        updateT("版本", "Version")
    }

    public var appUpdateVersion: String {
        updateT("版本", "Version")
    }

    public var appUpdateCheck: String {
        updateT("检查更新", "Check for Updates")
    }

    public var appUpdateWhatsNew: String {
        updateT("本次新增", "What's New")
    }

    public var appUpdateChecking: String {
        updateT("正在检查", "Checking")
    }

    public var appUpdateUpToDate: String {
        updateT("已是最新版本", "Up to Date")
    }

    public var appUpdateUnableToCheck: String {
        updateT("暂时无法检查", "Unable to Check")
    }

    public func appUpdateAvailable(version: String) -> String {
        updateT("\(version) 可用", "\(version) Available")
    }

    public func appUpdateSignalOverline(version: String) -> String {
        "REDE · \(version)"
    }

    /// 今日页页底单行更新信号的事实句（2026-07-20 收敛：三层块 → 单行开放行）。
    public func appUpdateRowTitle(version: String) -> String {
        updateT("新版本 \(version)", "New version \(version)")
    }

    /// 单行信号里的「查看」短动作；完整语义（查看更新）保留在 a11y label 与设置页。
    public var appUpdateViewShort: String {
        updateT("查看", "View")
    }

    public var appUpdateViewUpdate: String {
        updateT("查看更新", "View Update")
    }

    public var appUpdateLater: String {
        updateT("稍后", "Later")
    }

    public var appUpdateContinue: String {
        updateT("继续", "Continue")
    }

    public func appUpdateVersionValue(marketingVersion: String, build: String) -> String {
        "\(marketingVersion) (\(build))"
    }

    /// 版本主打句（What's New 的 hero；空串 = 该版本无内置叙事，视图回退显示版本号）。
    /// 文案纪律（基线 §5.5）：只讲已交付事实，Apple 式具体名词句，零空泛形容词。
    /// 只保留当前发布版本的叙事（升级只会看到当前版本，旧版本文案按 YAGNI 移除）。
    public func appUpdateHeroLine(version: String) -> String {
        guard version == "1.11.0" else { return "" }
        return updateT("手表上就能练完一场", "Train a full session from your wrist")
    }

    public func appUpdateHighlights(version: String) -> [String] {
        guard version == "1.11.0" else { return [] }
        if locale == .zh {
            return [
                "新增 Apple Watch App：手表上看这组多重、几次，打勾记组，休息自动倒计时；手机放包里也能练完整场",
                "手表和手机是同一场训练：任一边记的组另一边立刻可见；断联超过一小时会停下来，不把不确定的数据写进健康",
                "手表上可以改重量、次数、RIR，也能暂停或跳过本组",
                "引导流程里可以直接用 Apple 登录恢复：换手机后不用把年龄、器械、目标重新答一遍",
                "设置页从 11 组归并成 7 组，用得多的排在前面",
                "计划调整建议选「暂不」之后不再反复出现：同一条每周最多再提一次，连拒两次就不再提，直到训练数据本身变了",
                "训练中连着两组余力明显下降时，下一组自动降一档重量；目标次数也跟着你实际做到的走，不再挂一个整场没到过的数",
                "修复：用「精确」手输的重量，大字上会显示成另一个数（选重机上最明显）",
            ]
        }
        return [
                "Apple Watch app: see the set's weight and reps, log it, and start the rest timer from your wrist. Your phone can stay in the bag",
                "Watch and phone run one session: a set logged on either side appears on the other; after an hour disconnected the session stops rather than writing uncertain data to Health",
                "Adjust weight, reps, and RIR on the watch, or pause and skip a set",
                "Sign in with Apple during onboarding to restore your profile. No re-answering age, equipment, and goals after switching phones",
                "Settings regrouped from 11 sections into 7, most-used first",
                "Dismissing a plan suggestion now sticks: the same one returns at most once a week, and stops entirely after two dismissals until your training data changes",
                "When your reserve drops sharply across two sets, the next set eases one notch; the rep target follows what you actually hit instead of a number you never reached",
                "Fixed: a weight typed into Exact showed as a different number in the big readout (most visible on selectorized machines)",
        ]
    }

    private func updateT(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
