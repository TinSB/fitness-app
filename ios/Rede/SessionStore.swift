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

@Observable
final class SessionStore {
    var todayOutcome: TodayModel.LoadOutcome?
    var flow: TrainFlowState?
    var sessionStartedAt: Date?
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
    }

    /// 从今日处方开启训练（无处方/休息日则不开）。
    func startSession(now: Date = Date()) {
        guard flow == nil, let prescription = todayModel?.prescription else { return }
        flow = TrainFlowState(prescription: prescription)
        sessionStartedAt = now
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
