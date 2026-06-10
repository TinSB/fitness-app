import Foundation
import RedeDataHealth
import RedeDomain
import RedePersistence
import RedeTrainingDecision

/// 真 DataHealth gate 适配器（组合层接线，验证逻辑在包内；
/// EndToEndWriteTests 内有同构副本，两处必须保持一致）。
private struct DataHealthGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {
        try CanonicalWriteValidation.validate(candidate: candidate, replacing: current)
    }
}

// SessionStore — 会话级状态容器（M3-2）：今日模型 + 进行中训练流。
// app 层不做业务判断：流转移全在 TrainFlowState（包内有测试），
// 这里只是 @Observable 包装 + 时钟注入点。进行中会话仅存内存
//（FR-TR9 跨进程恢复未排片，已在 MVP 计划留痕）；完成落盘归 M3-3。

/// draft 文件存取（独立于 canonical，不经写闸；best-effort——draft 丢失不阻塞训练）。
private enum DraftFile {
    static var url: URL {
        TodayModel.canonicalFileURL().deletingLastPathComponent()
            .appendingPathComponent("active-session-draft.json", isDirectory: false)
    }

    static func load() -> TrainSessionDraft? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(TrainSessionDraft.self, from: data)
    }

    static func save(_ draft: TrainSessionDraft) {
        guard let data = try? JSONEncoder().encode(draft) else { return }
        try? FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        try? data.write(to: url, options: [.atomic])
    }

    static func clear() {
        try? FileManager.default.removeItem(at: url)
    }
}

@Observable
final class SessionStore {
    var todayOutcome: TodayModel.LoadOutcome?
    var flow: TrainFlowState?
    var sessionStartedAt: Date?
    /// 启动时发现的可恢复 draft（FR-TR9 提示「继续进行中的训练」）。
    var pendingDraft: TrainSessionDraft?
    /// 写入失败的如实呈现（FR-TR8：绝不假装成功）；nil = 无错误。
    var saveErrorText: String?
    /// 保存进行中（防双击双写；MainActor 上同步置位）。
    var isSaving = false

    var todayModel: TodayModel? {
        if case .ready(let model)? = todayOutcome { return model }
        return nil
    }

    func loadToday() async {
        todayOutcome = await TodayModel.loadOutcomeAsync()
        checkForRestorableDraft()
    }

    // MARK: - M5-2 偏好与档案（FR-SE1/SE2/SE3）

    /// 启动时读取持久化偏好（只读，不经写闸）；unreadable/缺失 → nil（渲染层默认兜底）。
    static func loadPreferences() -> (unit: String?, locale: String?) {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return (nil, nil) }
        return (appData.userProfile.unitSystem, appData.userProfile.locale)
    }

    /// 设置页展示用的档案快照（引导四答）。
    struct ProfileSnapshot {
        let primaryGoal: String?
        let weeklyTrainingDays: Int?
        let equipmentScenario: String?
        let trainingLevel: String?
    }

    static func loadProfileSnapshot() -> ProfileSnapshot? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        guard let appData = try? store.load() else { return nil }
        let profile = appData.userProfile
        return ProfileSnapshot(
            primaryGoal: profile.primaryGoal,
            weeklyTrainingDays: profile.weeklyTrainingDays,
            equipmentScenario: profile.equipmentScenario,
            trainingLevel: profile.trainingLevel
        )
    }

    /// 偏好写入（FR-SE1/SE3 持久化）：经写闸 scalar edit；失败如实置 saveErrorText。
    /// isSaving 互斥沿写闸单调用方合同（审查 MAJOR-1：防快速连点并发 load-modify-write 丢更新）。
    @discardableResult
    func savePreferences(unitSystem: String?, locale: String?) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                try writer.applyPreferences(unitSystem: unitSystem, locale: locale)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value
        switch result {
        case .success:
            return true
        case .failure(let error):
            saveErrorText = String(describing: error)
            return false
        }
    }

    // MARK: - M5-1b 引导（FR-ON1/3）

    /// 是否需要首启引导。铁律：unreadable ≠ 新用户——文件在但读不懂时绝不进引导
    /// （引导完成会写盘，可能覆盖既有记录）。仅当合法空文档（文件缺失或
    /// 无模板、无历史、无背景）时为 true。
    static func needsOnboarding() -> Bool {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        do {
            guard let existing = try store.load() else { return true } // 文件缺失 = 合法首启
            return existing.history.isEmpty
                && existing.programTemplate.splitType == nil
                && existing.userProfile.trainingLevel == nil
        } catch {
            return false // unreadable：如实降级到 Today 的 unreadable 态
        }
    }

    /// 引导完成：4 问 → 模板映射（包内纯函数）→ 写闸落盘 → 重载今日。
    /// 返回 false 时 saveErrorText 已置（如实呈现，可重试）。
    @discardableResult
    func completeOnboarding(_ answers: OnboardingAnswers) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }

        let template = OnboardingPlanInit.template(for: answers)
        let write = OnboardingWrite(
            trainingLevel: answers.trainingLevel,
            primaryGoal: answers.primaryGoal,
            weeklyTrainingDays: template.daysPerWeek, // 调用约定：取钳制后的值
            equipmentScenario: answers.equipmentScenario,
            splitType: template.splitType
        )
        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                try writer.applyOnboarding(write)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value

        switch result {
        case .success:
            saveErrorText = nil
            await loadToday() // 结果卡直接读真实首练处方（FR-ON3）
            return true
        case .failure(let error):
            saveErrorText = String(describing: error)
            return false
        }
    }

    /// 当日 draft → 恢复提示；跨天/无效 → 静默清除。
    private func checkForRestorableDraft() {
        guard flow == nil, pendingDraft == nil, let draft = DraftFile.load() else { return }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        if draft.isRestorable(todayISO: formatter.string(from: Date())) {
            pendingDraft = draft
        } else {
            DraftFile.clear()
        }
    }

    func restorePendingDraft() {
        guard let draft = pendingDraft else { return }
        pendingDraft = nil
        guard let restored = draft.restoreFlow() else {
            // 重放失败（如 catalog 漂移）：宁可不恢复，清掉过期 draft
            DraftFile.clear()
            return
        }
        flow = restored
        sessionStartedAt = draft.startedAt
    }

    func discardPendingDraft() {
        pendingDraft = nil
        DraftFile.clear()
    }

    /// 事件包装：转移 + 即时 draft 留存（每个动作后都可恢复）。
    func apply(_ event: TrainFlowEvent) {
        guard flow != nil else { return }
        switch event {
        case .logSet(let obs): flow?.logSet(obs)
        case .restFinished: flow?.restFinished()
        case .skipSet(let reason): flow?.skipSet(reason: reason)
        case .skipExercise(let reason): flow?.skipExercise(reason: reason)
        case .replaceExercise(let id): flow?.replaceCurrentExercise(with: id)
        case .reportPain: flow?.reportPain()
        case .toggleHold: flow?.toggleHold()
        case .requestFinish: flow?.requestFinish()
        case .keepTraining: flow?.keepTraining()
        case .confirmEnd(let reason): flow?.confirmEnd(reason: reason)
        }
        persistDraft()
    }

    private func persistDraft() {
        guard let flow, flow.phase != .summary else { return }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        let draft = TrainSessionDraft(
            dateISO: formatter.string(from: sessionStartedAt ?? Date()),
            startedAt: sessionStartedAt ?? Date(),
            prescription: flow.prescription,
            events: flow.events
        )
        Task.detached(priority: .utility) { DraftFile.save(draft) }
    }

    /// 从今日处方开启训练（无处方/休息日则不开）。
    func startSession(now: Date = Date()) {
        guard flow == nil, let prescription = todayModel?.prescription else { return }
        pendingDraft = nil // 显式清提示（不依赖 alert binding 的隐式 dismiss）
        flow = TrainFlowState(prescription: prescription)
        sessionStartedAt = now
        persistDraft()
    }

    /// 今日尚未加载时先加载再开训（Plan tab 直接开训路径）。
    func startSessionLoadingIfNeeded() async {
        if todayOutcome == nil { await loadToday() }
        startSession()
    }

    func endSession() {
        flow = nil
        sessionStartedAt = nil
        saveErrorText = nil
        DraftFile.clear()
    }

    /// 完成写入（M3-3）：构建 canonical session → 真 DataHealth gate → 唯一写闸。
    /// 成功 → 清会话并重载今日（裁决翻转）；失败 → 如实报错、会话保留可重试。
    func completeAndPersistSession(now: Date = Date()) async -> Bool {
        guard let flow, flow.phase == .summary, !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        let startedAt = sessionStartedAt ?? now
        // 注意口径：date 为用户本地日（与引擎天序号一致）；startedAt/finishedAt 为
        // UTC ISO 时间戳——跨时区时两者日期字面可不一致，展示层取日期一律用 date 字段。
        let isoFormatter = ISO8601DateFormatter()
        let dayFormatter = DateFormatter()
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")
        dayFormatter.timeZone = .current
        dayFormatter.dateFormat = "yyyy-MM-dd"

        let session = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "session-\(UUID().uuidString)",
            dateISO: dayFormatter.string(from: startedAt),
            startedAtISO: isoFormatter.string(from: startedAt),
            finishedAtISO: isoFormatter.string(from: now),
            durationMinutes: max(0, Int(now.timeIntervalSince(startedAt)) / 60)
        )

        let fileURL = TodayModel.canonicalFileURL()
        let result: Result<Void, Error> = await Task.detached(priority: .userInitiated) {
            do {
                try FileManager.default.createDirectory(
                    at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                let writer = CanonicalSessionWriter(
                    store: JSONFileAppDataStore(fileURL: fileURL),
                    gate: DataHealthGate()
                )
                try writer.appendCompletedSession(session)
                return .success(())
            } catch {
                return .failure(error)
            }
        }.value

        switch result {
        case .success:
            endSession()
            await loadToday() // 裁决/进展立即反映新记录
            return true
        case .failure(let error):
            // MVP 临时方案：直出技术错误串（如实优先）；友好映射随 M4 文案层补。
            saveErrorText = String(describing: error)
            return false
        }
    }

    var sessionSummary: SessionSummary? {
        guard let flow, flow.phase == .summary else { return nil }
        let duration = sessionStartedAt.map { Int(Date().timeIntervalSince($0)) } ?? 0
        return SessionSummaryBuilder.build(
            prescription: flow.prescription,
            observations: flow.observationsByExercise,
            durationSeconds: max(0, duration)
        )
    }
}
