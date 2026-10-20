// WarmupCopy — FR-TR10 热身组文案（双语）。
//
// 热身是流内临时引导（不落库）；引擎零文案，这里把 WarmupStep 的 kind/次数渲染成展示串。
// 红线：中性、不羞辱；空杆/动作模式预热不冒充工作组。重量经 formatKg/unitLabel 走现役单位口径。

import Foundation

extension RedeStrings {
    /// 热身进度小标：「热身 N/M」。
    public func warmupProgress(index: Int, total: Int) -> String {
        t2w("热身 \(index)/\(total)", "Warm-up \(index)/\(total)")
    }

    /// 空杆预热主标（杠铃/史密斯）。
    public var warmupEmptyBar: String { t2w("空杆", "Empty bar") }

    /// 无重量轴动作模式预热主标（自重/弹力带）。
    public var warmupMovementPrep: String { t2w("动作模式预热", "Movement prep") }

    /// 次数后缀「×N」（与组表/hero 同口径）。
    public func warmupReps(_ reps: Int) -> String { "×\(reps)" }

    /// 热身重量主行：「{重量}{单位}」（百分比阶梯档）。
    public func warmupWeight(_ kg: Double) -> String { "\(formatKg(kg)) \(unitLabel)" }

    /// 「完成热身组」主操作。
    public var warmupDone: String { t2w("完成热身组", "Warm-up done") }

    /// 「跳过热身」次操作（中性，不催促）。
    public var warmupSkip: String { t2w("跳过热身", "Skip warm-up") }

    /// 热身卡上的今天正式组目标：「正式组 70 lb × 6」。target 由 targetLine 渲染（显示层不二次吸附）。
    public func warmupWorkingTarget(_ target: String) -> String {
        t2w("正式组 \(target)", "Working set \(target)")
    }

    /// 两级热身之间的节奏提示（钢色、只陈述，后面跟一个正计时）。
    public var warmupPace: String { t2w("歇 45–60 秒", "Rest 45–60 s") }

    // MARK: 开练前全身热身卡（训练流审查 P1）
    // 红线（文案基线 §7.1）：只说做什么、做多久，不写防伤 / 保护关节 / 安全之类的功效。

    /// 卡名跟着下面的动作走：只练上肢 / 只练下肢的日子不再叫「全身热身」（审查 2026-10-20）。
    public func generalWarmupTitle(upperBody: Bool, lowerBody: Bool) -> String {
        switch (upperBody, lowerBody) {
        case (true, false): return t2w("上肢热身", "Upper-body warm-up")
        case (false, true): return t2w("下肢热身", "Lower-body warm-up")
        default: return t2w("全身热身", "General warm-up")
        }
    }
    public var generalWarmupDuration: String { t2w("3–5 分钟", "3–5 min") }
    /// 两行做法：先升温，再做今天要练的部位的动态活动（2026-10-20 按部位分：owner 真机反馈拉日给
    /// 开合跳、徒手深蹲不对路；开合跳在健身房里也不常见）。升温留「快走」：在家练没有器械也能做。
    /// 上下肢都练或判不出（全身日）用 upperBody = lowerBody = true。
    public func generalWarmupSteps(upperBody: Bool, lowerBody: Bool) -> [String] {
        let zh = locale == .zh
        let raise = zh ? "跑步机、划船机、单车或快走 2–3 分钟" : "Treadmill, rower, bike or a brisk walk, 2–3 min"
        let mobility: String
        switch (upperBody, lowerBody) {
        case (true, false):
            mobility = zh ? "手臂绕环、扩胸、肩胛后缩 各 10 次" : "Arm circles, chest openers and shoulder-blade squeezes, 10 each"
        case (false, true):
            mobility = zh ? "徒手深蹲、原地弓步、髋部绕环 各 10 次" : "Air squats, stationary lunges and hip circles, 10 each"
        default:
            mobility = zh ? "手臂绕环、徒手深蹲、原地弓步 各 10 次" : "Arm circles, air squats and stationary lunges, 10 each"
        }
        return [raise, mobility]
    }

    /// 第一个动作接下来有热身组时，卡上多一行把顺序说清楚。不说几组、不说轻重量：
    /// 可能只有一组空杆或一组纯自重（审查 2026-10-20）。
    public var generalWarmupThenSpecific: String {
        t2w("然后第一个动作先做热身组，再开始正式组",
            "Then warm up on the first exercise before your working sets")
    }
    public var generalWarmupDone: String { t2w("做完了", "Done") }
    public var generalWarmupSkip: String { t2w("跳过", "Skip") }
    /// 写设置：以后开练不再显示这张卡（设置里能再打开）。
    public var generalWarmupNever: String { t2w("以后不显示", "Don't show again") }

    /// 设置页分组小标 + 开关。
    public var settingsWarmupOverline: String { t2w("热身", "Warm-up") }
    public var settingsGeneralWarmupLabel: String { t2w("开练前热身", "Warm-up before training") }
    public var settingsGeneralWarmupNote: String {
        t2w("每场第一个动作前给一张 3–5 分钟的热身卡，可以跳过",
            "A 3–5 min warm-up card before the first exercise, skippable")
    }

    private func t2w(_ zh: String, _ en: String) -> String { locale == .zh ? zh : en }
}
