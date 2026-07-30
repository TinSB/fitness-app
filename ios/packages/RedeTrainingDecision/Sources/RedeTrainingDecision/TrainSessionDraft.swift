// TrainSessionDraft — 进行中会话的可恢复快照（M3-4 / FR-TR9）。
//
// draft = 处方 + 事件日志，恢复 = TrainFlowState.restore 重放。
// draft ≠ canonical 真相（Master：draft restore 是内存 draft 的落盘缓存）：
// 独立文件、不经写闸、只限当日恢复（跨天作废）、完成写入成功后即删除。

import Foundation

public struct TrainSessionDraft: Equatable, Sendable, Codable {
    private struct SessionConfiguration: Equatable, Sendable, Codable {
        /// 排序数组保证 draft JSON 确定性；nil = 本场不过滤器械。
        let allowedEquipment: [String]?
        let loadUnitRaw: String

        init(allowedEquipment: Set<String>?, loadUnit: LoadUnit) {
            self.allowedEquipment = allowedEquipment.map { $0.sorted() }
            self.loadUnitRaw = loadUnit.rawValue
        }

        var equipmentSet: Set<String>? {
            allowedEquipment.map(Set.init)
        }

        var loadUnit: LoadUnit {
            LoadUnit(rawValue: loadUnitRaw) ?? .kg
        }
    }

    public let version: Int
    /// 用户本地日（与引擎天序号口径一致）。
    public let dateISO: String
    public let startedAt: Date
    public let prescription: TodayPrescription
    public let events: [TrainFlowEvent]
    /// 落盘时的目录版本（§6.2 诊断戳，2026-06-11）：恢复失败时可区分
    /// 「目录漂移」与「数据损坏」；旧 draft 无此字段 → nil（兼容解码）。
    public let catalogVersion: String?
    /// FR-TR14 S2：开训时器械 / 单位冻结，随 draft 恢复；旧 draft 缺字段时才
    /// 使用调用方传入的当前档案配置作兼容 fallback。非 canonical，不提升版本。
    private let sessionConfiguration: SessionConfiguration?

    public init(
        dateISO: String,
        startedAt: Date,
        prescription: TodayPrescription,
        events: [TrainFlowEvent],
        catalogVersion: String? = nil,
        sessionAllowedEquipment: Set<String>? = nil,
        sessionLoadUnit: LoadUnit? = nil
    ) {
        self.version = 1
        self.dateISO = dateISO
        self.startedAt = startedAt
        self.prescription = prescription
        self.events = events
        self.catalogVersion = catalogVersion
        self.sessionConfiguration = sessionLoadUnit.map {
            SessionConfiguration(
                allowedEquipment: sessionAllowedEquipment,
                loadUnit: $0
            )
        }
    }

    /// 仅当日可恢复（恢复仅本次会话，不做跨天恢复——切片边界）。
    public func isRestorable(todayISO: String) -> Bool {
        dateISO == String(todayISO.prefix(10))
    }

    /// nil = 重放失败（如 catalog 漂移）——调用方应放弃恢复而非展示错误状态。
    /// loadUnit 生产路径必须显式传当前档案单位（SessionStore 已传）；default .kg
    /// 仅为测试便利，不得在生产依赖（否则磅用户当日恢复后步长回退 kg）。
    public func restoreFlow(allowedEquipment: Set<String>? = nil, loadUnit: LoadUnit = .kg) -> TrainFlowState? {
        let restoredEquipment: Set<String>?
        let restoredUnit: LoadUnit
        if let sessionConfiguration {
            restoredEquipment = sessionConfiguration.equipmentSet
            restoredUnit = sessionConfiguration.loadUnit
        } else {
            restoredEquipment = allowedEquipment
            restoredUnit = loadUnit
        }
        return TrainFlowState.restore(
            prescription: prescription,
            events: events,
            allowedEquipment: restoredEquipment,
            loadUnit: restoredUnit
        )
    }
}
