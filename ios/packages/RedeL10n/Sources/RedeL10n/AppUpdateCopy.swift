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
        guard version == "1.9.4" else { return "" }
        return updateT("今天怎么练，练的时候就能改", "Change today's workout as you go")
    }

    public func appUpdateHighlights(version: String) -> [String] {
        guard version == "1.9.4" else { return [] }
        if locale == .zh {
            return [
                "训练中能加动作、去掉动作、改剩余组数；练完可以把这套改法存进这天的计划",
                "小肌群动作不再长期卡住：4 组做成 20/18/16/15 这样的正常递减，下次就会加重",
                "换动作时之前做过的组不会再丢，都会如实记进历史",
                "练完升级会直接告诉你，等级变化和均衡改善都能做成卡片分享",
            ]
        }
        return [
            "Add an exercise, drop one, or change remaining sets mid-workout — then save that shape into the day's plan",
            "Small-muscle lifts no longer stall: sets like 20/18/16/15 now earn the next load",
            "Swapping an exercise mid-workout keeps the sets you already logged",
            "Level-ups appear as soon as you finish, and level or balance changes can be shared as a card",
        ]
    }

    private func updateT(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
