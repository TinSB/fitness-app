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
        guard version == "1.10.1" else { return "" }
        return updateT("换手机，训练记录跟着走", "Switch phones, your records follow")
    }

    public func appUpdateHighlights(version: String) -> [String] {
        guard version == "1.10.1" else { return [] }
        if locale == .zh {
            return [
                "新增云端同步：用 Apple 登录后，训练记录同时保留一份在云端，换手机或重装 App 时全部取回",
                "同步页并排显示这台设备与云端的场数，两边不一致时直接告诉你差多少、为什么",
                "不开启同步不影响任何功能，训练记录照常存在本机",
                "可以随时退出登录或删除云端账号，这台设备上的记录都会保留",
                "修复首次之后每次同步都失败的问题",
            ]
        }
        return [
            "Cloud Sync: sign in with Apple and a copy of your training stays in the cloud, ready when you switch phones or reinstall",
            "The sync page shows this device and the cloud side by side. When they differ it tells you by how much and why",
            "Leaving sync off changes nothing else. Your records stay on this device either way",
            "Sign out or delete the cloud account anytime. Records on this device stay",
            "Fixed syncing failing on every attempt after the first",
        ]
    }

    private func updateT(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
