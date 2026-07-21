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

    public func appUpdateHighlights(version: String) -> [String] {
        guard version == "1.8" else { return [] }
        if locale == .zh {
            return [
                "每块肌肉，都有自己的等级",
                "训练、休息与下一组，始终清楚",
                "计划与进展，更完整也更好读",
            ]
        }
        return [
            "A level for every muscle",
            "Training, rest, and the next set—always clear",
            "Planning and progress, fuller and clearer",
        ]
    }

    private func updateT(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
