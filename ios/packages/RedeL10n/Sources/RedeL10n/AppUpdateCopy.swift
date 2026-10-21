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
        guard version == "1.12.2" else { return "" }
        return updateT("手表上就能练完一场", "Train a full session from your wrist")
    }

    /// 1.12.2（2026-10-20）：1.11.0 / 1.12.0 / 1.12.1 都没上过商店，从 1.9.4 升上来的人只会看到这一版——手表这一整套照写，
    /// 外加之后几批（点完成即休息、双击手势、引擎审查第一、二批、训练不丢、同步修复、热身按部位 #771、手表写健康 #774）。
    public func appUpdateHighlights(version: String) -> [String] {
        guard version == "1.12.2" else { return [] }
        if locale == .zh {
            return [
                "新增 Apple Watch App：手表上看这组多重、几次，打勾记组；点完成立刻开始休息倒计时，手机放包里也能练完整场",
                "手表上双指捏两下（双击手势）就能完成这一组、跳过休息；也能改重量、次数、RIR，暂停或跳过本组",
                "手表和手机是同一场训练：任一边记的组另一边都能看到；在表上练完、手机没打开也会自动存好",
                "手机上点「开始训练」，手表自动开始记录，不用再自己打开体能训练",
                "手表记的心率和时长会存进 Apple 健康：手机够不着、App 被关掉，或中途开了别的体能训练，练过的部分照样存下来",
                "轻练日、减载周之后，重量回到原来的水平接着加；停练回来按每个动作先减量再加回，隔两三周练一次也不会每次再减一成",
                "加重更跟手：每组都还剩 4 次以上余力时可以一次加两档；下次的重量看整场的平均余力，一组练到力竭不会让下次降重；孤立动作组间休息 90 秒",
                "选重片器械按 5 磅一格加重；加了微调片、不在整格上的重量保持原样，加重只上到紧邻的那一格",
                "热身按部位来：高位下拉、器械推胸这类器械主项也先做轻重量热身组；开练前的热身卡跟着今天练的部位；同一部位一场只完整热一次",
                "记错的组可以改：休息时点「上一组」就能改重量、次数、RIR，也能撤销；最后一组在小结里改",
                "训练不会丢：被系统关掉、练过零点、忘了保存都会先问你；超过 36 小时没练完的会存成一场「提前结束」的训练，不再删除",
                "每周练 5 天的计划，不会在第 4 天被要求休息；训练中屏幕不再自动锁屏",
                "引导流程里可以直接用 Apple 登录恢复：换手机后不用把年龄、器械、目标重新答一遍",
                "计划调整建议选「暂不」之后不再反复出现：同一条每周最多再提一次，连拒两次就不再提，直到训练数据本身变了",
                "修复：登录云同步后，在手机上改的设置会被云端旧的那份改回去",
            ]
        }
        return [
                "Apple Watch app: see the set's weight and reps and log it from your wrist. Rest starts the moment you tap done, so your phone can stay in the bag",
                "Pinch twice on the watch (Double Tap) to finish the set or skip rest; adjust weight, reps, and RIR, or pause and skip a set",
                "Watch and phone run one session: a set logged on either side shows on the other, and a session finished on the watch saves itself even if your phone stays closed",
                "Tap Start Training on your phone and the watch starts recording on its own",
                "Heart rate and workout time from the watch are saved to Apple Health; if your phone is out of reach, the app closes, or another workout starts, the part you trained is still saved",
                "After a light day or a deload week, weights pick up where you left off; after time off each lift eases back on its own, and training every two or three weeks no longer cuts the weight each time",
                "Progression that keeps up: when every set leaves 4 or more reps in reserve, the weight can go up two steps; next time's weight follows the whole session, so one set taken to failure doesn't lower it; isolation lifts rest 90 seconds",
                "Weight-stack machines go up 5 lb at a time; a weight between steps, like one with an add-on plate, holds as is and goes up to the next step",
                "Warm-ups that fit the day: machine lifts like the lat pulldown also start with light warm-up sets, the warm-up card before you start matches today's muscle groups, and each group gets one full warm-up per session",
                "Fix a logged set: during rest, tap the last set to change weight, reps, or RIR, or undo it; fix the final set from the summary",
                "Sessions don't get lost: closing on the summary, training past midnight, or forgetting to save now asks first; a session left unfinished for 36 hours is saved as ended early instead of deleted",
                "A five-day plan is no longer told to rest on day four; the screen stays on while you train",
                "Sign in with Apple during onboarding to restore your profile. No re-answering age, equipment, and goals after switching phones",
                "Dismissing a plan suggestion now sticks: the same one returns at most once a week, and stops entirely after two dismissals until your training data changes",
                "Fixed: with sync signed in, settings changed on your phone were reverted by the older cloud copy",
        ]
    }

    private func updateT(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
