// OnboardingCopy — M5-1b 引导流文案（FR-ON1/2/3；方向 B「仪表卡步进」拍板 2026-06-10）。
// 禁词红线同款；不吹捧不承诺（FR-ON2：背景只作先验，说明句克制）。
// 分化名按引擎真实最小实现（upper-lower / push-pull-legs），无全身序列。

import Foundation

extension RedeStrings {
    // MARK: - 头部

    public var onbHeaderTag: String { locale == .zh ? "首份计划" : "First plan" }
    public var onbFooterNote: String {
        locale == .zh ? "四个回答——一分钟左右" : "Four answers — about a minute"
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

    public var onbDaysLabel: String { locale == .zh ? "频率" : "Days / week" }
    public var onbDaysQuestion: String { locale == .zh ? "每周实际能练几天？" : "How many days can you actually train?" }

    // MARK: - 问题 3 · 器械

    public var onbEquipLabel: String { locale == .zh ? "器械" : "Equipment" }
    public var onbEquipQuestion: String { locale == .zh ? "你在哪练？" : "Where will you train?" }

    public func onbEquipOption(_ code: String) -> (title: String, caption: String) {
        switch code {
        case "commercial-gym":
            return locale == .zh
                ? ("商业健身房", "杠铃 · 器械 · 龙门架")
                : ("Commercial gym", "barbell · machines · cables")
        case "home-dumbbell":
            return locale == .zh
                ? ("家庭哑铃", "哑铃 · 一张凳")
                : ("Home dumbbells", "DBs · a bench")
        default: // minimal
            return locale == .zh
                ? ("最小器械", "弹力带 · 少量哑铃")
                : ("Minimal kit", "bands · a few DBs")
        }
    }

    // MARK: - 问题 4 · 背景（FR-ON2）

    public var onbLevelLabel: String { locale == .zh ? "背景" : "Background" }
    public var onbLevelQuestion: String { locale == .zh ? "你从哪起步？" : "Where are you starting from?" }
    public var onbLevelNote: String {
        locale == .zh
            ? "只决定起始重量——之后跟着你的真实记录走"
            : "Sets your starting loads only — your logs take over from there"
    }

    public func onbLevelOption(_ code: String) -> (title: String, caption: String) {
        switch code {
        case "beginner":
            return locale == .zh
                ? ("刚接触力量", "第一份系统计划")
                : ("New to lifting", "First structured program")
        case "intermediate":
            return locale == .zh
                ? ("练过一阵", "懂动作，正回归")
                : ("Trained before", "Know the lifts, coming back")
        default: // advanced
            return locale == .zh
                ? ("训练多年", "多年持续训练")
                : ("Experienced", "Years of consistent training")
        }
    }

    // MARK: - 结果卡（FR-ON3）

    public var onbReadyTag: String { locale == .zh ? "计划就绪" : "Plan ready" }

    /// 分化展示名（引擎真实最小实现的两种）。
    public func onbSplitName(_ code: String) -> String {
        switch code {
        case "push-pull-legs": return locale == .zh ? "推拉腿" : "Push / Pull / Legs"
        default: return locale == .zh ? "上下分化" : "Upper / Lower"
        }
    }

    /// 结果判断句："上下分化，每周 4 天——为增肌而排。"
    public func onbVerdict(splitCode: String, days: Int, goalCode: String) -> String {
        let split = onbSplitName(splitCode)
        let goal: String
        switch goalCode {
        case "hypertrophy": goal = locale == .zh ? "为增肌而排" : "built for muscle"
        case "strength": goal = locale == .zh ? "为力量而排" : "built for strength"
        default: goal = locale == .zh ? "均衡推进" : "built for balance"
        }
        return locale == .zh
            ? "\(split)，每周 \(days) 天——\(goal)。"
            : "\(split), \(days) days a week — \(goal)."
    }

    public var onbFirstSession: String { locale == .zh ? "首次训练" : "First session" }

    /// FR-ON2 先验说明（按背景三档；不承诺不吹捧）。
    public func onbPriorNote(_ levelCode: String) -> String {
        switch levelCode {
        case "beginner":
            return locale == .zh
                ? "学动作阶段从轻起步——之后计划跟着你的记录走"
                : "Light start while you learn the lifts — from here the plan follows what you log"
        case "intermediate":
            return locale == .zh
                ? "按你的背景保守起步——之后计划跟着你的记录走"
                : "Moderate start for your background — from here the plan follows what you log"
        default:
            return locale == .zh
                ? "按目录基线起步——首练就开始校准"
                : "Catalog baseline start — calibration begins with your first session"
        }
    }

    public var onbOpenToday: String { locale == .zh ? "进入今日" : "Open Today" }
    public var onbWriteFailed: String {
        locale == .zh ? "保存失败——你的回答还在，可重试。" : "Save failed — your answers are still here. Try again."
    }
    public var onbRetry: String { locale == .zh ? "重试保存" : "Retry save" }
}
