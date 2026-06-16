// MesocyclePhase — 真周期化引擎 S1（纯相位计算，2026-06-15 owner 拍板）。
//
// 模型（owner 选「最权威/最专业」口径拍板）：一个 mesocycle = 4 个 ISO 周累积块（3:1
// load:deload），4 个周角色 校准/构建/过载/减载。过载主动（+1 组、RIR 压到 1，功能性过载），
// 减载主动卸量（×0.85、−1 组、高 RIR）。4 周块的计划减载落第 4 周，正好领先反应式规则 4 的
// 21 天(=3 周)窗口约一周——计划在前主动减、反应在后兜底减，节律对齐。
//
// 调制以现有「裁决在渐进之后调制」(TodayPrescriptionEngine, light×0.9/deload×0.8) 同款机制
// 表达：phase 产出一个正交乘数层，叠在 verdict 调制之前（与 2026-06-10 拍板的「冷启动先验×裁决
// 正交叠乘」同一种已认可模式）。本文件只产纯相位与调制值，不接处方、不碰 schema、不画 UI（S1）。
//
// 诚实红线（FR-PL1）：相位永远从 blockStartISO + 今日日期纯函数算，零写死计数器；锚点本身
// 也可从 sessions 重算（防腐烂）。停训 ≥ restartGapDays 软重置回第 1 周（疲劳已清，再算「过载周」
// 就是假的——诚实优先于连续性）。

import Foundation

/// 周角色的处方调制（与 light×0.9/deload×0.8 同款：乘数 + 组数增减 + 目标 RIR）。
public struct PhaseModulation: Equatable, Sendable {
    /// 重量乘数（1.0 = 不动；减载 0.85）。叠在 verdict 乘数之前，最终取两者更狠者（见 S3）。
    public let weightMultiplier: Double
    /// 组数增减（过载 +1；减载 −1；下限钳到 2 在消费侧做）。
    public let setDelta: Int
    /// 目标 RIR（覆盖现有硬编码 2.0：校准 3 / 构建 2 / 过载 1 / 减载 4）。
    /// 全整数（owner 拍板 2026-06-16）：RIR 记录用整数档选择器（训练页 —/0/1/2/3/4/5，无半档），
    /// 半档（旧 2.5/3.5）不可执行也不可记录——目标=显示=记录端到端取整。
    public let rirTarget: Double

    public init(weightMultiplier: Double, setDelta: Int, rirTarget: Double) {
        self.weightMultiplier = weightMultiplier
        self.setDelta = setDelta
        self.rirTarget = rirTarget
    }
}

/// 4 周累积块的周角色。
public enum MesocyclePhase: String, Equatable, Sendable, CaseIterable {
    case calibrate   // 第 1 周 校准
    case build       // 第 2 周 构建
    case overreach   // 第 3 周 过载（主动：+1 组、RIR 1）
    case deload      // 第 4 周 减载（×0.85、−1 组、高 RIR）

    /// 该周角色的处方调制（owner 拍板·主动过载版）。
    public var modulation: PhaseModulation {
        switch self {
        case .calibrate: return PhaseModulation(weightMultiplier: 1.00, setDelta: 0, rirTarget: 3.0)
        case .build:     return PhaseModulation(weightMultiplier: 1.00, setDelta: 0, rirTarget: 2.0)
        case .overreach: return PhaseModulation(weightMultiplier: 1.00, setDelta: 1, rirTarget: 1.0)
        case .deload:    return PhaseModulation(weightMultiplier: 0.85, setDelta: -1, rirTarget: 4.0)
        }
    }
}

/// 计划页周期条的渲染状态（纯数据）：当前周序高亮 + 全块角色序列。
public struct MesocycleCycleState: Equatable, Sendable {
    /// 块长（周）= 节点数。
    public let blockLengthWeeks: Int
    /// 当前所处周序（0-based）。
    public let currentWeekInBlock: Int
    /// 每周角色（长度 = blockLengthWeeks），按周序排列。
    public let phases: [MesocyclePhase]

    public init(blockLengthWeeks: Int, currentWeekInBlock: Int, phases: [MesocyclePhase]) {
        self.blockLengthWeeks = blockLengthWeeks
        self.currentWeekInBlock = currentWeekInBlock
        self.phases = phases
    }

    /// 当前周角色（越界安全降级第 1 周）。
    public var currentPhase: MesocyclePhase {
        phases.indices.contains(currentWeekInBlock) ? phases[currentWeekInBlock] : .calibrate
    }
}

public enum Mesocycle {
    /// 默认块长（周）。存进数据便于未来改，不硬编码进契约；当前模型按 4 周映射 4 角色。
    public static let defaultBlockLengthWeeks = 4
    /// 软重置阈值：与最近训练日间隔 ≥ 此天数 → 视为本块作废、回第 1 周校准。
    public static let restartGapDays = 10

    /// 4 周块的角色映射（weekInBlock 0..3）。非 4 周块（未来 6 周等）需另表，当前只支持 4。
    private static func role(weekInBlock: Int) -> MesocyclePhase {
        switch weekInBlock {
        case 0: return .calibrate
        case 1: return .build
        case 2: return .overreach
        default: return .deload
        }
    }

    /// 今日所处块内周序（0-based）：从 block 起始日 + 今日纯算（ISO 周差取模）。
    /// 日期非法或 today < blockStart → 安全降级 0（第 1 周）。计划页周期条按此定位当前节点。
    public static func weekInBlock(blockStartISO: String, todayISO: String,
                                   blockLengthWeeks: Int = defaultBlockLengthWeeks) -> Int {
        guard blockLengthWeeks > 0,
              let start = TrainingDay.dayNumber(fromISO: blockStartISO),
              let today = TrainingDay.dayNumber(fromISO: todayISO),
              today >= start else {
            return 0
        }
        return ((today - start) / 7) % blockLengthWeeks   // 满 7 天进下一周
    }

    /// 今日所处周角色：从 block 起始日 + 今日纯算（ISO 周差取模）。
    /// 日期非法或 today < blockStart → 安全降级第 1 周校准（绝不抛错、不画假进度）。
    public static func phase(blockStartISO: String, todayISO: String,
                             blockLengthWeeks: Int = defaultBlockLengthWeeks) -> MesocyclePhase {
        role(weekInBlock: weekInBlock(blockStartISO: blockStartISO, todayISO: todayISO,
                                      blockLengthWeeks: blockLengthWeeks))
    }

    /// 计划页周期条状态（纯数据，UI 只渲染）：块长 + 当前周序 + 每周角色。
    /// 诚实红线（FR-PL1）：仅 enabled 且有真历史锚点时返回；关闭或空历史 → nil（计划页退诚实占位）。
    /// 锚点从真历史现算（停训 ≥restartGapDays 软重置），与今日页处方走同一锚，相位永远一致。
    public static func cycleState(sessionDatesISO: [String], todayISO: String, enabled: Bool,
                                  blockLengthWeeks: Int = defaultBlockLengthWeeks) -> MesocycleCycleState? {
        guard enabled, blockLengthWeeks > 0,
              let start = blockStartISO(sessionDatesISO: sessionDatesISO, todayISO: todayISO) else {
            return nil
        }
        let week = weekInBlock(blockStartISO: start, todayISO: todayISO, blockLengthWeeks: blockLengthWeeks)
        // 当前角色表只覆盖 4 周块（role 把 weekInBlock≥3 映射到 deload）；未来 6 周需另表（见上文契约）。
        let phases = (0..<blockLengthWeeks).map { role(weekInBlock: $0) }
        return MesocycleCycleState(blockLengthWeeks: blockLengthWeeks, currentWeekInBlock: week, phases: phases)
    }

    /// 块起始锚点（从真历史可算，非凭空计数器）：
    /// - 与最近训练日间隔 ≥ restartGapDays（停训）→ 本块作废，锚到今日（下次练即新块第 1 周）。
    /// - 否则 = 「最近一段连续训练序列」的起点（从最新场往回，相邻 ≤ restartGapDays 即同块）。
    /// 空历史 → nil（计划页退诚实占位，不画假进度）。
    public static func blockStartISO(sessionDatesISO: [String], todayISO: String,
                                     restartGapDays gap: Int = restartGapDays) -> String? {
        // 解析 + 升序（同日号去重无所谓，相邻判定用日号差）
        let dated = sessionDatesISO
            .compactMap { iso -> (iso: String, day: Int)? in
                TrainingDay.dayNumber(fromISO: iso).map { (iso, $0) }
            }
            .sorted { $0.day < $1.day }
        guard let latest = dated.last else { return nil }
        // 停训软重置：今日距最近训练日 ≥ gap → 新块从今日起
        if let today = TrainingDay.dayNumber(fromISO: todayISO), today - latest.day >= gap {
            return todayISO
        }
        // 最近连续序列的起点：从最新往回，相邻间隔 ≤ gap 则归入本块
        var anchor = latest
        for entry in dated.dropLast().reversed() {
            if anchor.day - entry.day <= gap { anchor = entry } else { break }
        }
        return anchor.iso
    }
}
