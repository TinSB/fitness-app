// CleanTrainingDecisionInput — 训练决策引擎的唯一入口类型
// （AGENTS.md：TrainingDecision consumes only a clean CleanTrainingDecisionInput）。
//
// 编译期锁：init 私有，只能经 make(from: CleanAppDataView, todayISO:) 铸造——
// raw AppData 在类型系统上就进不了引擎。「今天」由调用方注入（引擎无 clock）。
//
// 输入面已按 PRD 开放决策 #2 拍板（2026-06-09，M2-1 设计时）：仅已记录训练历史
// （负荷/间隔/上次表现）+ 计划结构；酸痛/疲劳等主观自报输入放 FF，不进 MVP。

import RedeDataHealth

public struct CleanTrainingDecisionInput: Equatable, Sendable {
    public enum InputError: Error, Equatable {
        case invalidTodayISO(String)
    }

    public let sessions: [CleanTrainingSession]
    public let profile: CleanProfile
    public let program: CleanProgram
    /// "yyyy-MM-dd"（更长的 ISO 串取前 10 位）。
    public let todayISO: String

    private init(
        sessions: [CleanTrainingSession],
        profile: CleanProfile,
        program: CleanProgram,
        todayISO: String
    ) {
        self.sessions = sessions
        self.profile = profile
        self.program = program
        self.todayISO = todayISO
    }

    /// 站在过去某一天看（只含那天之前的训练，档案与计划照旧）：判断「那天引擎开的是不是一份减量处方」用
    ///（2026-10-20 引擎审查：轻练日 / 减载日减下来的重量不能成为下次的基准）。日期不可解析 → nil。
    func asOf(dayISO: String) -> CleanTrainingDecisionInput? {
        let iso = String(dayISO.prefix(10))
        guard let day = TrainingDay.dayNumber(fromISO: iso) else { return nil }
        return CleanTrainingDecisionInput(
            sessions: sessions.filter { (TrainingDay.dayNumber(fromISO: $0.date) ?? .max) < day },
            profile: profile,
            program: program,
            todayISO: iso
        )
    }

    public static func make(from cleanView: CleanAppDataView, todayISO: String) throws -> CleanTrainingDecisionInput {
        let normalized = String(todayISO.prefix(10))
        guard TrainingDay.dayNumber(fromISO: normalized) != nil else {
            throw InputError.invalidTodayISO(todayISO)
        }
        return CleanTrainingDecisionInput(
            sessions: cleanView.sessions,
            profile: cleanView.profile,
            program: cleanView.program,
            todayISO: normalized
        )
    }
}
