import Foundation

// 循环死区检测（2026-08-12）。
//
// 缺陷是从真实用户数据撞出来的，不是想出来的：一个用户 56 天练了 9 场，**一次腿都没练过**。
// 他的配置是 weeklyCycleRestart = true + 自定义 4 天序列 [推A, 拉A, 腿A, 上肢]，
// 实际每周练 2 次。
//
// 机制（见 TodayPrescriptionEngine.rotationBase）：weeklyCycleRestart 分支下
// 轮转基数 = **本 ISO 周内已完成场次**。所以每周只练 N 次的人，index 永远只取 0…N-1，
// 序列里第 N 项之后的训练日**在数学上永远不可达**。不是"容易漏"，是永远。
//
// 这不是引擎算错了——「每周重新开始循环」的行为和它的文案完全一致。缺的是：
// 这个开关与「序列长度 > 实际每周场次」组合会造出死区，而 App 一声不吭。
//
// 更扎手的一点：引擎的 reduceFrequency 提案（把每周天数从 5 降到 2）**不解决这件事**——
// 序列长度与 daysPerWeek 是解耦的（引擎注释明写）。采纳之后序列还是 4 天、腿还是练不到，
// 而「你没练够计划天数」这个唯一还在报警的信号反而消失了，计划看起来"完全匹配"。
//
// 本文件只回答一个问题、不产生副作用：**在当前配置与最近的真实训练频率下，
// 哪些训练日轮不到。** 判断留给上层。
public enum PlanReachability {

    /// 观察窗口（ISO 周）。取一个训练块的长度：够长到能看出习惯，短到能跟上变化。
    public static let observedWeeks = 4

    /// 至少要有这么多个「有训练的周」才下结论。新用户第一周练 1 次不该被判死区。
    public static let minimumObservedWeeks = 2

    /// 轮不到的训练日码（按序列顺序）。空数组 = 没有死区，或数据不足以下结论。
    ///
    /// - Parameters:
    ///   - sequence: 生效中的日序（已经过 resolvedDaySequence 解析）。
    ///   - weeklyCycleRestart: 每周循环模式。false（顺延）时轮转按累计场次推进，
    ///     序列必然全部轮到，直接返回空——**顺延永远没有死区**。
    ///   - sessionDates: 已完成训练的本地日 ISO（yyyy-MM-dd），顺序不限。
    ///   - todayISO: 今天。用于框定观察窗口。
    public static func unreachableDays(
        sequence: [String],
        weeklyCycleRestart: Bool,
        sessionDates: [String],
        todayISO: String
    ) -> [String] {
        evaluate(sequence: sequence, weeklyCycleRestart: weeklyCycleRestart,
                 sessionDates: sessionDates, todayISO: todayISO)?.unreachable ?? []
    }

    /// 检测结果。nil = 无死区或数据不足；非 nil 时 unreachable 必然非空。
    /// 带上 weeklySessions / sequenceLength 是因为提示要把**因果**说清楚，
    /// 光说「腿轮不到」而不说为什么，用户无从判断该改什么。
    public struct Report: Equatable, Sendable {
        public let unreachable: [String]
        public let weeklySessions: Int
        public let sequenceLength: Int

        public init(unreachable: [String], weeklySessions: Int, sequenceLength: Int) {
            self.unreachable = unreachable
            self.weeklySessions = weeklySessions
            self.sequenceLength = sequenceLength
        }
    }

    public static func evaluate(
        sequence: [String],
        weeklyCycleRestart: Bool,
        sessionDates: [String],
        todayISO: String
    ) -> Report? {
        guard weeklyCycleRestart, sequence.count > 1 else { return nil }
        guard let today = TrainingDay.dayNumber(fromISO: todayISO) else { return nil }

        // 按 ISO 周归并最近 observedWeeks 周的场次。
        let windowStart = TrainingDay.isoWeekStartDay(of: today) - (observedWeeks - 1) * 7
        var perWeek: [Int: Int] = [:]
        for iso in sessionDates {
            guard let day = TrainingDay.dayNumber(fromISO: iso), day >= windowStart, day <= today
            else { continue }
            perWeek[TrainingDay.isoWeekStartDay(of: day), default: 0] += 1
        }

        // 只数「练过的周」。完全没练的周不代表频率低，代表那周没来——
        // 把它当成 0 会让停练一周的人立刻被判死区，是噪音。
        guard perWeek.count >= minimumObservedWeeks else { return nil }

        // 取**最大**周场次，不取平均：只要最近有任何一周走到过第 k 天，
        // 第 k 天就不是死区。宁可漏报，不可误报——误报会让人不信这条提示。
        let bestWeek = perWeek.values.max() ?? 0
        guard bestWeek < sequence.count else { return nil }

        // 序列里 index ≥ bestWeek 的都轮不到。去重保序：序列允许重复成员，
        // 同一个训练日码可能既出现在可达段又出现在死区段——那它其实是可达的。
        let reachable = Set(sequence.prefix(bestWeek))
        var seen = Set<String>()
        let dead = sequence.dropFirst(bestWeek).filter { code in
            !reachable.contains(code) && seen.insert(code).inserted
        }
        guard !dead.isEmpty else { return nil }
        return Report(unreachable: dead, weeklySessions: bestWeek, sequenceLength: sequence.count)
    }
}
