// WatchCopy — watchOS 表 app 自己那几个词（v2，2026-08-15）。
//
// 表上大部分文字（动作名、目标串、重量格子）是手机渲染好推过来的，这里只管表侧
// 自己拼的几行：进度、按钮、休息、空态。之前这些直接写死在表 app 里（全是中文），
// 英文用户的表上就中英混排——现在收进文案包，与手机同一套双语纪律。
//
// 表跟随**手机 app 的语言**（载荷里的 localeCode），不跟随表的系统语言，
// 理由见 WatchPrescription.localeCode。
//
// 表屏小：英文一律取最短写法（Set 2/4，不是 Set 2 of 4）。
extension RedeStrings {

    /// 记组屏进度行：「3/6 · 第 2/4 组」/「3/6 · Set 2/4」。比手机 trainProgress 短——
    /// 表上这一行只有 11pt、一行放不下「动作 3/6 · 第 2/4 组」的英文版。
    public func watchProgress(exercise: Int, exerciseTotal: Int, set: Int, setTotal: Int) -> String {
        locale == .zh
            ? "\(exercise)/\(exerciseTotal) · 第 \(set)/\(setTotal) 组"
            : "\(exercise)/\(exerciseTotal) · Set \(set)/\(setTotal)"
    }

    /// 完成按钮点下之后、手机还没推回下一步之前的按钮文字。
    public var watchLogged: String { t2w("已记录", "Logged") }

    /// 「N 组待同步」：手机够不着时组在排队，不是丢了。
    public func watchPendingSets(_ n: Int) -> String {
        locale == .zh ? "\(n) 组待同步" : (n == 1 ? "1 set queued" : "\(n) sets queued")
    }

    /// 休息屏标题（暂停时手机把倒计时按停了）。
    public var watchRestPaused: String { t2w("休息 · 已暂停", "Rest · paused") }

    /// 休息屏底部「下一组 60 kg × 8」的前缀。
    public func watchNextUp(_ target: String) -> String {
        locale == .zh ? "下一组 \(target)" : "Next \(target)"
    }

    /// 休息屏 +30 / 下一组按钮在手机够不着时的说明。
    public var watchPhoneUnreachable: String { t2w("手机不可达", "iPhone out of reach") }

    // MARK: - 清单屏（没在训练）

    public var watchRestDay: String { t2w("今天休息", "Rest day") }
    /// 过期计划的标注：「8-14 的计划」/「Plan for 8-14」。传入 yyyy-MM-dd，只显示月-日。
    public func watchStalePlan(dateISO: String) -> String {
        let monthDay = dateISO.split(separator: "-").dropFirst().joined(separator: "-")
        return locale == .zh ? "\(monthDay) 的计划" : "Plan for \(monthDay)"
    }
    public var watchFetchingPlan: String { t2w("正在取计划", "Getting today's plan") }
    public var watchOpenPhone: String { t2w("在 iPhone 上打开 Rede", "Open Rede on iPhone") }

    private func t2w(_ zh: String, _ en: String) -> String { locale == .zh ? zh : en }
}
