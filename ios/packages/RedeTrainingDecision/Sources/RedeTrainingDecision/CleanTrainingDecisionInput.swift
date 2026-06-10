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
