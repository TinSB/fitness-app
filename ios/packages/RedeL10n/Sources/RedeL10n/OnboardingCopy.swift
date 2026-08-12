// OnboardingCopy — M5-1b 引导流文案（FR-ON1/2/3；方向 B「仪表卡步进」拍板 2026-06-10）。
// 禁词红线同款；不吹捧不承诺（FR-ON2：背景只作先验，说明句克制）。
// 分化名按引擎真实最小实现（upper-lower / push-pull-legs），无全身序列。

import Foundation

extension RedeStrings {
    // MARK: - 头部

    public var onbHeaderTag: String { locale == .zh ? "首份计划" : "First plan" }
    /// 信任铺垫三件套：问几个 / 多久 / 数据去哪（2026-06-10 打磨调研补「本机」句）。
    /// 2026-08-12 补「默认」：云端同步上线后，「只存在本机」是绝对断言且与同屏的
    /// 恢复入口自相矛盾。加一个词就准确了，也和设置页隐私说明（「默认保存在这台设备本机」）同口径。
    public var onbFooterNote: String {
        locale == .zh ? "四个回答 · 约一分钟 · 记录默认只存在本机"
                      : "Four answers · about a minute · stays on this device by default"
    }

    // MARK: - 登录恢复（2026-08-12）
    //
    // 云端同步的卖点是「换手机，训练记录跟着走」，而它唯一被兑现的时刻就是新机首启。
    // 在这个入口出现之前，那条路是：先答完整套问卷 → 进 App → 自己摸到设置里登录 →
    // 记录才回来，而刚答的那份配置还会因为 updatedAt 更新而覆盖掉云端那份。
    // 白答一遍问卷，还丢配置。

    /// 引导页脚的次级入口。措辞用「用过」不用「有账号」——用户记得自己练过，不一定记得注册过。
    public var onbRestoreEntry: String {
        locale == .zh ? "已经用过 Rede？登录恢复" : "Used Rede before? Sign in to restore"
    }
    public var onbRestoreTitle: String {
        locale == .zh ? "取回训练记录" : "Restore your training"
    }
    /// 说清楚会回来什么、以及不用重答——这是用户此刻唯一关心的两件事。
    public var onbRestoreBody: String {
        locale == .zh ? "用当初的 Apple 账号登录　训练记录和训练背景都会回到这台设备　这些问题不用再答一遍"
                      : "Sign in with the same Apple Account. Your sessions and training background come back to this device, and you can skip these questions"
    }
    public var onbRestoreWorking: String {
        locale == .zh ? "正在取回…" : "Restoring…"
    }
    public func onbRestoreDone(sessions: Int) -> String {
        locale == .zh ? "取回 \(sessions) 场训练" : (sessions == 1 ? "1 session restored" : "\(sessions) sessions restored")
    }
    public var onbRestoreDoneAction: String {
        locale == .zh ? "开始使用" : "Get started"
    }
    /// 登录成功但这个 Apple 账号下没有记录：如实说，不假装取回了什么。
    public var onbRestoreEmpty: String {
        locale == .zh ? "这个 Apple 账号下还没有 Rede 记录" : "No Rede records under this Apple Account yet"
    }
    public var onbRestoreEmptyAction: String {
        locale == .zh ? "继续设置" : "Continue setup"
    }
    public var onbRestoreFailed: String {
        locale == .zh ? "取回失败　检查网络后再试一次" : "Restore failed. Check your connection and try again"
    }
    public var onbRestoreRetry: String {
        locale == .zh ? "再试一次" : "Try again"
    }
    public var onbRestoreCancel: String {
        locale == .zh ? "返回" : "Back"
    }

    // MARK: - 问题 1 · 目标

    public var onbGoalLabel: String { locale == .zh ? "目标" : "Goal" }
    public var onbGoalQuestion: String { locale == .zh ? "你练是为了什么？" : "What are you training for?" }

    public func onbGoalOption(_ code: String) -> (title: String, caption: String) {
        switch code {
        case "hypertrophy":
            return locale == .zh
                ? ("增肌", "以容量为主，重量稳步上升")
                : ("Build muscle", "Volume leads, loads climb steadily")
        case "strength":
            return locale == .zh
                ? ("变强壮", "大重量主项，较低次数")
                : ("Get stronger", "Heavy main lifts, lower reps")
        default: // general
            return locale == .zh
                ? ("均衡发展", "力量与围度一份计划")
                : ("Both, balanced", "Strength and size in one plan")
        }
    }

    // MARK: - 问题 2 · 天数

    public var onbDaysLabel: String { locale == .zh ? "频率" : "Schedule" }
    public var onbDaysQuestion: String { locale == .zh ? "每周实际能练几天？" : "How many days can you actually train?" }
    /// 防高估副注（打磨调研 2026-06-10：2-6 直选带无文字对冲高频自选偏差）。
    public var onbDaysNote: String {
        locale == .zh
            ? "按能稳住的天数选，而非理想周　之后可在设置里改"
            : "Pick the days you can hold, not the ideal week. You can change it later"
    }

    // MARK: - 问题 3 · 器械

    public var onbEquipLabel: String { locale == .zh ? "器械" : "Equipment" }
    public var onbEquipQuestion: String { locale == .zh ? "你在哪练？" : "Where will you train?" }

    public func onbEquipOption(_ code: String) -> (title: String, caption: String) {
        switch code {
        // 副注对齐 11b 拍板稿（打磨审计 2026-06-10：旧稿沿用了 11a 小写碎片）
        case "commercial-gym":
            return locale == .zh
                ? ("商业健身房", "杠铃、器械、深蹲架齐全")
                : ("Commercial gym", "Barbells, machines, a full rack")
        case "home-dumbbell":
            return locale == .zh
                ? ("家庭哑铃", "可调哑铃加一张凳")
                : ("Home dumbbells", "Adjustable dumbbells and a bench")
        default: // minimal
            return locale == .zh
                ? ("最小器械", "少量负重，有块空地就行")
                : ("Minimal kit", "A few weights and floor space")
        }
    }

    // MARK: - 问题 4 · 背景（FR-ON2）

    public var onbLevelLabel: String { locale == .zh ? "背景" : "Background" }
    public var onbLevelQuestion: String { locale == .zh ? "你从哪起步？" : "Where are you starting from?" }
    public var onbLevelNote: String {
        locale == .zh
            ? "只决定起始重量　之后跟着你的记录走"
            : "Sets your starting loads only. Your logs take over from there"
    }

    public func onbLevelOption(_ code: String) -> (title: String, caption: String) {
        switch code {
        case "beginner":
            return locale == .zh
                ? ("刚接触力量", "第一份系统计划")
                : ("New to lifting", "First structured program")
        // 副注打磨 2026-06-10：中档同时接住回归者与自学者；高档消除中文同义反复
        case "intermediate":
            return locale == .zh
                ? ("练过一阵", "懂基本动作，想练得更系统")
                : ("Trained before", "Know the lifts, want more structure")
        default: // advanced
            return locale == .zh
                ? ("训练多年", "清楚自己的工作重量")
                : ("Experienced", "Years of consistent training")
        }
    }

    // MARK: - 结果卡（FR-ON3）

    public var onbReadyTag: String { locale == .zh ? "计划就绪" : "Plan ready" }

    /// 分化展示名（引擎真实最小实现的两种）。
    public func onbSplitName(_ code: String) -> String {
        switch code {
        case "push-pull-legs": return locale == .zh ? "推拉腿" : "Push / Pull / Legs"
        case "ppl-ul": return locale == .zh ? "推拉腿 + 上下分化" : "PPL + Upper / Lower"
        case "full-body": return locale == .zh ? "全身训练" : "Full Body"
        default: return locale == .zh ? "上下分化" : "Upper / Lower"
        }
    }

    /// 结果判断句："上下分化，每周 4 天　为增肌而排"（去句号 + 留白接拍，voice 铁律 2026-06-15）。
    public func onbVerdict(splitCode: String, days: Int, goalCode: String) -> String {
        let split = onbSplitName(splitCode)
        let goal: String
        switch goalCode {
        case "hypertrophy": goal = locale == .zh ? "为增肌而排" : "built for muscle"
        case "strength": goal = locale == .zh ? "为力量而排" : "built for strength"
        default: goal = locale == .zh ? "均衡推进" : "built for balance"
        }
        return locale == .zh
            ? "\(split)，每周 \(days) 天　\(goal)"
            : "\(split), \(days) days a week, \(goal)"
    }

    public var onbFirstSession: String { locale == .zh ? "首次训练" : "First session" }

    /// 器械回声行（11b 结果卡 equipLine，打磨调研补齐——四答里唯一没被回读的回答）。
    public func onbEquipEcho(_ code: String) -> String {
        switch code {
        case "commercial-gym":
            return locale == .zh ? "按完整器械目录排出" : "Built from the full gym catalog"
        case "home-dumbbell":
            return locale == .zh ? "每个动作都能用哑铃和凳完成" : "Every lift works with dumbbells and a bench"
        default:
            // FR-EQ1（2026-06-11）：目录暂无自重条目，回声只承诺引擎兑现的事——
            // 「一对哑铃就够」；自重覆盖归目录扩充（§6.3）
            return locale == .zh ? "按少量负重编排　一对哑铃就够" : "Built around a pair of dumbbells"
        }
    }

    /// FR-ON2 先验说明（按背景三档；不承诺不吹捧）。
    public func onbPriorNote(_ levelCode: String) -> String {
        switch levelCode {
        case "beginner":
            return locale == .zh
                ? "新手期从轻起步　之后跟着你的记录走"
                : "Light start while you learn the lifts. From there it follows what you log"
        case "intermediate":
            // 打磨 2026-06-10：中文梯度恢复单调（从轻→适中→目录基线；原「保守」比「从轻」更怯）
            return locale == .zh
                ? "按你的背景适中起步　之后跟着你的记录走"
                : "Moderate start for your background. From there it follows what you log"
        default:
            return locale == .zh
                ? "按目录基线起步　首练即开始校准"
                : "Catalog baseline start. Calibration begins with your first session"
        }
    }

    public var onbOpenToday: String { locale == .zh ? "进入今日" : "Open Today" }
    public var onbWriteFailed: String {
        locale == .zh ? "保存失败　你的回答还在，可重试" : "Save failed. Your answers are still here. Try again"
    }
    public var onbRetry: String { locale == .zh ? "重试" : "Try again" }

    // MARK: - 设置内单题编辑（方向 A「行内单题」拍板 2026-06-10）

    public var onbEditSave: String { locale == .zh ? "保存修改" : "Save changes" }
    public var onbEditCancel: String { locale == .zh ? "取消" : "Cancel" }
    /// 铭牌可点提示（替代退役的「修改回答」按钮）。
    // MARK: - 设置 · 性别（批次 D：仅相对力量标准用；红线：无句号无破折号零羞辱）

    public var settingsSexLabel: String { locale == .zh ? "性别" : "Sex" }
    public var settingsSexQuestion: String { locale == .zh ? "你的性别" : "Your sex" }
    /// 用途单一说明（两拍全角空格惯例）。
    public var settingsSexNote: String {
        locale == .zh
            ? "仅用于力量标准对比　可随时更改"
            : "Only used for strength standards. Change anytime"
    }

    public func settingsSexOption(_ code: String) -> (title: String, caption: String) {
        switch code {
        case "male":
            return locale == .zh
                ? ("男", "力量标准按男性表")
                : ("Male", "Standards use the male table")
        case "female":
            return locale == .zh
                ? ("女", "力量标准按女性表")
                : ("Female", "Standards use the female table")
        default: // not-set
            return locale == .zh
                ? ("暂不设置", "不参与力量标准对比")
                : ("Not set", "Skips strength standards")
        }
    }

    // MARK: - VoiceOver（刻线进度格状态）

    public var onbA11yAnswered: String { locale == .zh ? "已回答" : "answered" }
    public var onbA11yCurrent: String { locale == .zh ? "当前" : "current" }
}
