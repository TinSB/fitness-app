// TrainSessionDraft — 进行中会话的可恢复快照（M3-4 / FR-TR9）。
//
// draft = 处方 + 事件日志，恢复 = TrainFlowState.restore 重放。
// draft ≠ canonical 真相（Master：draft restore 是内存 draft 的落盘缓存）：
// 独立文件、不经写闸、只限当日恢复（跨天作废）、完成写入成功后即删除。

import Foundation

public struct TrainSessionDraft: Equatable, Sendable, Codable {
    public let version: Int
    /// 用户本地日（与引擎天序号口径一致）。
    public let dateISO: String
    public let startedAt: Date
    public let prescription: TodayPrescription
    public let events: [TrainFlowEvent]

    public init(dateISO: String, startedAt: Date, prescription: TodayPrescription, events: [TrainFlowEvent]) {
        self.version = 1
        self.dateISO = dateISO
        self.startedAt = startedAt
        self.prescription = prescription
        self.events = events
    }

    /// 仅当日可恢复（恢复仅本次会话，不做跨天恢复——切片边界）。
    public func isRestorable(todayISO: String) -> Bool {
        dateISO == String(todayISO.prefix(10))
    }

    /// nil = 重放失败（如 catalog 漂移）——调用方应放弃恢复而非展示错误状态。
    public func restoreFlow(allowedEquipment: Set<String>? = nil) -> TrainFlowState? {
        TrainFlowState.restore(prescription: prescription, events: events, allowedEquipment: allowedEquipment)
    }
}
