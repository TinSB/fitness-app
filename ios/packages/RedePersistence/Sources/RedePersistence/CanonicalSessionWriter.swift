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

public enum PreferencesWriteError: Error, Equatable {
    case unknownUnit(String)
    case unknownLocale(String)
}

public enum CoachActionWriteError: Error, Equatable {
    case emptyExerciseId
    case substitutionToSelf(String)
    case emptyKey   // 空 weekStartISO / actionKey
}

public enum PlanCustomizationWriteError: Error, Equatable {
    case emptyDayCode
    case emptyExerciseList        // 自定义当日清单不得为空（空=应走 remove 回退默认）
    case emptyExerciseId
    case emptyDaySequence
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

    /// 已批准写入类别：单位/语言偏好 scalar edit（M5-2 FR-SE1/SE3 持久化）。
    /// nil = 不改动该项；open-bag 合并 userProfile，其余键原样保留。
    @discardableResult
    public func applyPreferences(unitSystem: String?, locale: String?) throws -> AppData {
        if let unitSystem, !["kg", "lb"].contains(unitSystem) {
            throw PreferencesWriteError.unknownUnit(unitSystem)
        }
        if let locale, !["zh", "en"].contains(locale) {
            throw PreferencesWriteError.unknownLocale(locale)
        }
        return try performGatedMutation { current in
            var storage = current.storage
            var profile = storage["userProfile"]?.asObject ?? [:]
            if let unitSystem { profile["unitSystem"] = .string(unitSystem) }
            if let locale { profile["locale"] = .string(locale) }
            storage["userProfile"] = .object(profile)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：周期化开关 scalar edit（FR-PL2 enablement，2026-06-15）。
    /// open-bag 合并 `mesocycle`：只写 enabled，blockLengthWeeks 缺则补默认 4、有则不覆盖；
    /// 其余顶层键原样保留。开启后今日页处方与计划页周期条按落库配置生效（默认 off = opt-in）。
    @discardableResult
    public func applyMesocyclePreference(enabled: Bool) throws -> AppData {
        return try performGatedMutation { current in
            var storage = current.storage
            var meso = storage["mesocycle"]?.asObject ?? [:]
            meso["enabled"] = .bool(enabled)
            if meso["blockLengthWeeks"] == nil { meso["blockLengthWeeks"] = .int(4) }
            storage["mesocycle"] = .object(meso)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：通知偏好编辑（FR-NT1/2）。open-bag 加性 scalar edit——只动 notifications 容器、
    /// 其余顶层键原样保留；缺=关、无 seed、无 schema bump。授权态由系统持有、不落库（默认 off = opt-in）。
    @discardableResult
    public func applyNotificationPreferences(restEndEnabled: Bool, weeklyEnabled: Bool) throws -> AppData {
        return try performGatedMutation { current in
            var storage = current.storage
            var notif = storage["notifications"]?.asObject ?? [:]
            notif["restEndEnabled"] = .bool(restEndEnabled)
            notif["weeklyEnabled"] = .bool(weeklyEnabled)
            storage["notifications"] = .object(notif)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：计划频率调整采纳（FR-PL3，= 既有「程序配置编辑」类别）。open-bag：写
    /// programTemplate.daysPerWeek = toDaysPerWeek + 落 planAdjustment 回滚记录（记 fromDaysPerWeek），
    /// 其余顶层/programTemplate 键原样保留；无 schema bump。owner 拍板「采纳允许改 program 结构」。
    @discardableResult
    public func applyFrequencyAdjustment(fromDaysPerWeek: Int, toDaysPerWeek: Int) throws -> AppData {
        return try performGatedMutation { current in
            var storage = current.storage
            var template = storage["programTemplate"]?.asObject ?? [:]
            template["daysPerWeek"] = .int(Int64(toDaysPerWeek))
            storage["programTemplate"] = .object(template)
            storage["planAdjustment"] = .object([
                "kind": .string("reduceFrequency"),
                "fromDaysPerWeek": .int(Int64(fromDaysPerWeek)),
                "toDaysPerWeek": .int(Int64(toDaysPerWeek)),
            ])
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：计划调整单步回滚（FR-PL4）。读 planAdjustment.fromDaysPerWeek 恢复 daysPerWeek、
    /// 删记录；无记录 = 幂等 no-op。反向 gated 写（写前备份），不另起 undo 栈。
    @discardableResult
    public func rollbackPlanAdjustment() throws -> AppData {
        return try performGatedMutation { current in
            var storage = current.storage
            guard let record = storage["planAdjustment"]?.asObject,
                  let from = record["fromDaysPerWeek"]?.asInt else {
                return current // 无记录：幂等
            }
            var template = storage["programTemplate"]?.asObject ?? [:]
            template["daysPerWeek"] = .int(Int64(from))
            storage["programTemplate"] = .object(template)
            storage["planAdjustment"] = nil
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：换动作前瞻覆盖采纳（FR-T5 saved-session exercise replacement，schema 11）。
    /// 采纳「以后把 originalId 换成 actualId」→ open-bag 合并写
    /// storage["exerciseSubstitutions"][originalId]=actualId，其余键原样保留；走全套 gate（写前备份）。
    /// 结构守卫：id 非空、original != actual。**分层**：actualId 是否合法 catalog 条目 / 同替代族，
    /// 由持有目录的 app 层（RedeTrainingDecision/ExerciseReplacementEngine 口径）在调用前校验——
    /// 本层不依赖 RedeTrainingDecision，只做结构化 open-bag 写入。
    @discardableResult
    public func applyExerciseSubstitution(originalId: String, actualId: String) throws -> AppData {
        guard !originalId.isEmpty, !actualId.isEmpty else { throw CoachActionWriteError.emptyExerciseId }
        guard originalId != actualId else { throw CoachActionWriteError.substitutionToSelf(originalId) }
        return try performGatedMutation { current in
            var storage = current.storage
            var subs = storage["exerciseSubstitutions"]?.asObject ?? [:]
            subs[originalId] = .string(actualId)
            storage["exerciseSubstitutions"] = .object(subs)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：撤销换动作覆盖（FR-T5 单步撤销 = 反向 gated 写）。
    /// 删 storage["exerciseSubstitutions"][originalId]；不存在则幂等无变化。走全套 gate（含写前备份）。
    /// 结构守卫：id 非空（与 apply 对称，审查 M-1）。注意（审查 N-1）：删不存在的键这一幂等路径仍会走
    /// 一次 gated 写（备份+保存）——调用层若要避免无意义写盘，应在撤销前自查该覆盖是否存在。
    @discardableResult
    public func removeExerciseSubstitution(originalId: String) throws -> AppData {
        guard !originalId.isEmpty else { throw CoachActionWriteError.emptyExerciseId }
        return try performGatedMutation { current in
            var storage = current.storage
            var subs = storage["exerciseSubstitutions"]?.asObject ?? [:]
            subs[originalId] = nil   // Dictionary 赋 nil = 删键；容器保留为（可能空的）对象
            storage["exerciseSubstitutions"] = .object(subs)
            return try AppData(decoding: .object(storage))
        }
    }

    // MARK: - FR-PL6/PL7 切片S5：自定义训练计划写入（open-bag planCustomization，无 schema bump）
    // 全部走唯一 performGatedMutation（load→gate→backup→atomic→honest）。回滚 = remove（默认模板是
    // 确定性纯函数，无需快照即可重建，比 FR-PL4 更简单）。**分层**：exerciseId 合法性 / 同族 / 场景
    // 白名单 / 日序是否默认排列，由持有目录的 app 层在调用前校验（同 applyExerciseSubstitution）；
    // 本层只做结构守卫 + open-bag 写入，不依赖 RedeTrainingDecision。

    /// 已批准写入类别：采纳/更新某训练日的自定义动作清单（FR-PL6）。open-bag 合并写
    /// planCustomization.dayPlans[dayCode] = 有序动作清单，其余顶层键 + 其他 dayCode 原样保留。
    @discardableResult
    public func applyCustomDayPlan(dayCode: String, exercises: [CustomExerciseItem]) throws -> AppData {
        guard !dayCode.isEmpty else { throw PlanCustomizationWriteError.emptyDayCode }
        guard !exercises.isEmpty else { throw PlanCustomizationWriteError.emptyExerciseList }
        guard exercises.allSatisfy({ !$0.exerciseId.isEmpty }) else { throw PlanCustomizationWriteError.emptyExerciseId }
        return try performGatedMutation { current in
            var storage = current.storage
            var custom = storage["planCustomization"]?.asObject ?? [:]
            var dayPlans = custom["dayPlans"]?.asObject ?? [:]
            dayPlans[dayCode] = .object(["exercises": .array(exercises.map(Self.encodeCustomItem))])
            custom["dayPlans"] = .object(dayPlans)
            storage["planCustomization"] = .object(custom)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：移除某训练日自定义（FR-PL6「恢复默认」= 删该 dayCode 覆盖 → 引擎重算默认）。
    /// 删 dayPlans[dayCode]；无则幂等。其他 dayCode 原样保留；删后若整个自定义全空则一并清掉容器
    /// （与 getter「全空≡缺容器≡nil」语义闭环，避免残留空容器误导未来 raw 消费方，审查 MAJOR）。
    @discardableResult
    public func removeCustomDayPlan(dayCode: String) throws -> AppData {
        guard !dayCode.isEmpty else { throw PlanCustomizationWriteError.emptyDayCode }
        return try performGatedMutation { current in
            var storage = current.storage
            guard var custom = storage["planCustomization"]?.asObject,
                  var dayPlans = custom["dayPlans"]?.asObject else { return current } // 幂等
            dayPlans[dayCode] = nil
            custom["dayPlans"] = .object(dayPlans)
            storage["planCustomization"] = Self.cleanedCustomization(custom)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：采纳自定义日序（FR-PL7②）。写 planCustomization.daySequence。
    @discardableResult
    public func applyCustomDaySequence(_ sequence: [String]) throws -> AppData {
        guard !sequence.isEmpty, sequence.allSatisfy({ !$0.isEmpty }) else {
            throw PlanCustomizationWriteError.emptyDaySequence
        }
        return try performGatedMutation { current in
            var storage = current.storage
            var custom = storage["planCustomization"]?.asObject ?? [:]
            custom["daySequence"] = .array(sequence.map(JSONValue.string))
            storage["planCustomization"] = .object(custom)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：移除自定义日序（FR-PL7② 恢复默认轮转）。删 daySequence 键；无则幂等。
    /// 删后若整个自定义全空则一并清掉容器（同 removeCustomDayPlan，与 getter 语义闭环）。
    @discardableResult
    public func removeCustomDaySequence() throws -> AppData {
        return try performGatedMutation { current in
            var storage = current.storage
            guard var custom = storage["planCustomization"]?.asObject else { return current } // 幂等
            custom["daySequence"] = nil
            storage["planCustomization"] = Self.cleanedCustomization(custom)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 写回 planCustomization 容器，但若它全空（无 dayPlans 或 dayPlans 空、且无 daySequence）则返回
    /// nil → 调用处 `storage[...] = nil` 删整个容器（与 AppData.planCustomization getter「全空→nil」闭环）。
    private static func cleanedCustomization(_ custom: [String: JSONValue]) -> JSONValue? {
        let noDayPlans = custom["dayPlans"]?.asObject?.isEmpty ?? true
        let noSequence = custom["daySequence"]?.asArray?.isEmpty ?? true
        return (noDayPlans && noSequence) ? nil : .object(custom)
    }

    /// CustomExerciseItem → JSONValue（只写非 nil 可选字段，保持 open-bag 干净；缺=引擎默认）。
    private static func encodeCustomItem(_ item: CustomExerciseItem) -> JSONValue {
        var o: [String: JSONValue] = ["exerciseId": .string(item.exerciseId)]
        if let v = item.sets { o["sets"] = .int(Int64(v)) }
        if let v = item.repMin { o["repMin"] = .int(Int64(v)) }
        if let v = item.repMax { o["repMax"] = .int(Int64(v)) }
        if let v = item.rest { o["rest"] = .int(Int64(v)) }
        if item.crossFamily { o["crossFamily"] = .bool(true) }
        return .object(o)
    }

    // MARK: - FR-T5 切片5：补量意图 + dismiss 写入（schema 11 coachAdjustments / coachState）
    // 本切片只把意图安全落库（数据基础）；降频/窗口消费策略在切片6 接 UI 时定。
    // 防御读（审查 M-1）：内层数组缺失 → 视为空，不强解包不崩。

    /// 已批准写入类别：采纳补量（频率维度）——记「某 ISO 周已采纳补一次」到
    /// coachAdjustments.volumeBoosts，按 weekStartISO 去重（一周一条，幂等）；走全套 gate。
    @discardableResult
    public func applyVolumeBoost(weekStartISO: String) throws -> AppData {
        guard !weekStartISO.isEmpty else { throw CoachActionWriteError.emptyKey }
        return try performGatedMutation { current in
            var storage = current.storage
            var adjustments = storage["coachAdjustments"]?.asObject ?? [:]
            var boosts = adjustments["volumeBoosts"]?.asArray ?? []
            let already = boosts.contains { $0.asObject?["weekStartISO"]?.asString == weekStartISO }
            if !already { boosts.append(.object(["weekStartISO": .string(weekStartISO)])) }
            adjustments["volumeBoosts"] = .array(boosts)
            storage["coachAdjustments"] = .object(adjustments)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：撤销补量采纳（单步撤销=反向 gated 写，删该周条目；幂等）。
    @discardableResult
    public func removeVolumeBoost(weekStartISO: String) throws -> AppData {
        guard !weekStartISO.isEmpty else { throw CoachActionWriteError.emptyKey }
        return try performGatedMutation { current in
            var storage = current.storage
            var adjustments = storage["coachAdjustments"]?.asObject ?? [:]
            var boosts = adjustments["volumeBoosts"]?.asArray ?? []
            boosts.removeAll { $0.asObject?["weekStartISO"]?.asString == weekStartISO }
            adjustments["volumeBoosts"] = .array(boosts)
            storage["coachAdjustments"] = .object(adjustments)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别（§5 第 11 类 coach-action dismiss intent）：用户「暂不处理」某教练动作时落库。
    /// 按 actionKey 累加 count（喂降频学习）；首次 count=1，重复 +1（约定不产 count=0 条目）。走全套 gate。
    /// 降频/窗口的消费策略归切片6。
    @discardableResult
    public func applyCoachActionDismissal(actionKey: String) throws -> AppData {
        guard !actionKey.isEmpty else { throw CoachActionWriteError.emptyKey }
        return try performGatedMutation { current in
            var storage = current.storage
            var coachState = storage["coachState"]?.asObject ?? [:]
            var dismissed = coachState["dismissed"]?.asArray ?? []
            if let idx = dismissed.firstIndex(where: { $0.asObject?["actionKey"]?.asString == actionKey }) {
                var entry = dismissed[idx].asObject ?? [:]
                entry["count"] = .int(Int64((entry["count"]?.asInt ?? 0) + 1))
                dismissed[idx] = .object(entry)
            } else {
                dismissed.append(.object(["actionKey": .string(actionKey), "count": .int(1)]))
            }
            coachState["dismissed"] = .array(dismissed)
            storage["coachState"] = .object(coachState)
            return try AppData(decoding: .object(storage))
        }
    }

    /// 已批准写入类别：撤销 dismiss（反向 gated 写，整条删；幂等）。
    /// 注：UI **刻意不暴露**「暂不处理」的撤销入口——它是单向降频信号，卡按降频策略自然再现
    /// （系统逻辑 §5/§6.4a）。本写闸口为对称完整性 + 测试而保留，非缺接线（审查 NIT）。
    @discardableResult
    public func removeCoachActionDismissal(actionKey: String) throws -> AppData {
        guard !actionKey.isEmpty else { throw CoachActionWriteError.emptyKey }
        return try performGatedMutation { current in
            var storage = current.storage
            var coachState = storage["coachState"]?.asObject ?? [:]
            var dismissed = coachState["dismissed"]?.asArray ?? []
            dismissed.removeAll { $0.asObject?["actionKey"]?.asString == actionKey }
            coachState["dismissed"] = .array(dismissed)
            storage["coachState"] = .object(coachState)
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
