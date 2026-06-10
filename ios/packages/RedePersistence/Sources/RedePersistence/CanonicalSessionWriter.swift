// CanonicalSessionWriter — canonical AppData 的唯一写路径
// （系统逻辑 §1 唯一写闸 / §5 写入合同；Master Architecture §7）。
//
// 编排固定为：load → 候选 → 注入的 DataHealth gate → backup → atomic save，
// 任一步失败即如实抛出、磁盘不动（no fake success）。所有写入类别共享这一条
// 编排；M1-2 只开「完成训练 append」入口，其余类别随各自 slice 增加入口，
// 不另起写路径。gate 为注入 seam——真实 DataHealth 实现随 M1-3 接入。
//
// 并发边界（合同的一部分）：本类型非线程安全。「唯一写闸」同时也是「单调用方」
// 合同——同一 canonical 文件在任一时刻只允许一个 writer 在编排（app 注入一个
// 实例、串行调用）。并发的 load-modify-write 会丢更新；引入异步调用路径前必须
// 先给本层加隔离（actor/队列）并修订此合同。

import RedeDomain

public protocol AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws
}

public enum CanonicalWriteError: Error, Equatable {
    case notACompletedSession
    case missingSessionId
    case duplicateSessionId(String)
}

// MARK: - M5-1 引导写入（FR-ON1：4 问落档 + 首版模板初始化）

/// 引导答案的持久化形态。splitType 由 RedeTrainingDecision.OnboardingPlanInit
/// 映射后传入（本层不做训练决策，保持分层）。
/// 调用约定：weeklyTrainingDays 必须取 OnboardingPlanInit.template(for:).daysPerWeek
/// （钳制后的值），不要直接传 UI 原始输入——否则 splitType 与天数可能不一致。
/// 重复调用（用户改答案重跑引导）= 覆盖写已知字段；日序列轮转基于历史条数、
/// 改 splitType 后不重置（已知行为，重置语义归后续 slice）。
/// FR-EQ1 欠账：equipmentScenario 只落档不消费——CleanProfile/引擎接入归后续 slice。
public struct OnboardingWrite: Equatable, Sendable {
    public let trainingLevel: String
    public let primaryGoal: String
    public let weeklyTrainingDays: Int
    public let equipmentScenario: String
    public let splitType: String

    public init(
        trainingLevel: String, primaryGoal: String, weeklyTrainingDays: Int,
        equipmentScenario: String, splitType: String
    ) {
        self.trainingLevel = trainingLevel
        self.primaryGoal = primaryGoal
        self.weeklyTrainingDays = weeklyTrainingDays
        self.equipmentScenario = equipmentScenario
        self.splitType = splitType
    }
}

public enum OnboardingWriteError: Error, Equatable {
    case unknownTrainingLevel(String)
    case invalidWeeklyDays(Int)
}

public struct CanonicalSessionWriter {
    private let store: AppDataStore
    private let gate: AppDataWriteGate

    public init(store: AppDataStore, gate: AppDataWriteGate) {
        self.store = store
        self.gate = gate
    }

    /// 已批准写入类别：完成训练 append。
    @discardableResult
    public func appendCompletedSession(_ session: TrainingSession) throws -> AppData {
        guard session.completed == true else { throw CanonicalWriteError.notACompletedSession }
        guard let sessionId = session.id else { throw CanonicalWriteError.missingSessionId }

        return try performGatedMutation { current in
            if current.history.contains(where: { $0.id == sessionId }) {
                throw CanonicalWriteError.duplicateSessionId(sessionId)
            }
            var storage = current.storage
            var history = storage["history"]?.asArray ?? []
            history.append(.object(session.storage))
            storage["history"] = .array(history)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：引导答案 + 首版模板（M5-1）。
    /// open-bag 合并：只写本类别字段，userProfile/programTemplate 其余键原样保留。
    @discardableResult
    public func applyOnboarding(_ onboarding: OnboardingWrite) throws -> AppData {
        let knownLevels: Set<String> = ["beginner", "intermediate", "advanced"]
        guard knownLevels.contains(onboarding.trainingLevel) else {
            throw OnboardingWriteError.unknownTrainingLevel(onboarding.trainingLevel)
        }
        guard (2...6).contains(onboarding.weeklyTrainingDays) else {
            throw OnboardingWriteError.invalidWeeklyDays(onboarding.weeklyTrainingDays)
        }
        return try performGatedMutation { current in
            var storage = current.storage

            var profile = storage["userProfile"]?.asObject ?? [:]
            profile["trainingLevel"] = .string(onboarding.trainingLevel)
            profile["primaryGoal"] = .string(onboarding.primaryGoal)
            profile["weeklyTrainingDays"] = .int(Int64(onboarding.weeklyTrainingDays))
            profile["equipmentScenario"] = .string(onboarding.equipmentScenario)
            storage["userProfile"] = .object(profile)

            var template = storage["programTemplate"]?.asObject ?? [:]
            template["splitType"] = .string(onboarding.splitType)
            template["daysPerWeek"] = .int(Int64(onboarding.weeklyTrainingDays))
            template["primaryGoal"] = .string(onboarding.primaryGoal)
            storage["programTemplate"] = .object(template)

            return try AppData(decoding: .object(storage))
        }
    }

    /// 唯一的 gated 编排。current 为 nil（首写）时引导最小 canonical 文档。
    private func performGatedMutation(
        _ mutate: (_ current: AppData) throws -> AppData
    ) throws -> AppData {
        let current = try store.load()
        let base = try current ?? AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "history": .array([]),
        ]))

        let candidate = try mutate(base)
        try gate.validate(candidate: candidate, replacing: current)
        try store.backupExisting()
        try store.save(candidate)
        return candidate
    }
}
