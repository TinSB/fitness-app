// CanonicalWriteValidation — M1-2 写闸注入 seam 的真 DataHealth 实现（M3-3）。
//
// 合同（系统逻辑 §5「写前 DataHealth gate」的最小语义）：
// ① 写入不得让 clean 视图丢 session——current 净化后存在的每个 session id
//    必须在 candidate 净化后仍存在；
// ② 新增的 raw session 必须能通过净化——不许把 DataHealth 会丢弃的垃圾
//    写进 canonical（写时拦截优于读时擦除）。
// 纯函数；调用方（app 组合层/写闸）以 AppDataWriteGate 适配器接入。
//
// 已知边界（M5 edit 类写入接入前必须扩展）：① 同 id 的内容级改坏（如清空
// exercises）不在本合同内——当前 writer 只 append；② 校验粒度为 session 级。

import RedeDomain

public enum CanonicalWriteValidation {
    public enum ValidationError: Error, Equatable {
        case cleanSessionLost(id: String)
        case newSessionWouldBeDropped(id: String?)
    }

    public static func validate(candidate: AppData, replacing current: AppData?) throws {
        let candidateView = CleanAppDataViewBuilder.build(from: candidate)
        let candidateIds = Set(candidateView.sessions.map(\.id))

        // 无 id 的 raw 条目无法逐一追踪：禁止写入引入新的无 id 垃圾。
        if nilIdHistoryCount(of: candidate) > current.map(nilIdHistoryCount) ?? 0 {
            throw ValidationError.newSessionWouldBeDropped(id: nil)
        }

        if let current {
            let currentView = CleanAppDataViewBuilder.build(from: current)
            for session in currentView.sessions where !candidateIds.contains(session.id) {
                throw ValidationError.cleanSessionLost(id: session.id)
            }
            // 新增 raw history 条目必须在 candidate 的 clean 视图中存活
            let currentRawIds = Set(rawHistoryIds(of: current))
            for rawId in rawHistoryIds(of: candidate) where !currentRawIds.contains(rawId) {
                if !candidateIds.contains(rawId) {
                    throw ValidationError.newSessionWouldBeDropped(id: rawId)
                }
            }
        } else {
            // 首写：全部 raw 条目都必须存活
            for rawId in rawHistoryIds(of: candidate) where !candidateIds.contains(rawId) {
                throw ValidationError.newSessionWouldBeDropped(id: rawId)
            }
        }
    }

    private static func nilIdHistoryCount(of appData: AppData) -> Int {
        (appData.storage["history"]?.asArray ?? []).filter { element in
            element.asObject.map { TrainingSession(storage: $0).id == nil } ?? true
        }.count
    }

    private static func rawHistoryIds(of appData: AppData) -> [String] {
        (appData.storage["history"]?.asArray ?? []).compactMap { element in
            element.asObject.flatMap { TrainingSession(storage: $0).id }
        }
    }
}
