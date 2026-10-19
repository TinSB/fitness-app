// TrainSessionDraft — 进行中会话的可恢复快照（M3-4 / FR-TR9）。
//
// draft = 处方 + 事件日志，恢复 = TrainFlowState.restore 重放。
// draft ≠ canonical 真相（Master：draft restore 是内存 draft 的落盘缓存）：
// 独立文件、不经写闸、完成写入成功后即删除。当日的都可恢复；跨天只在记过组、且开练不到
// 36 小时时恢复（2026-10-18：晚上练过零点再打开不再被静默清掉）。2026-10-19 起：已练完
//（重放落在可保存的小结）的不问也不过期，由手机直接存好；窗口内跨天、一组没记的先留着
// 等表上排队的组（isWithinRestoreWindow）；出了窗口才作废。

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
    /// 训练结束（进入小结）的时刻；仍在训练中为 nil。小结阶段也落草稿（2026-10-18），
    /// 恢复后完成写入的 finishedAt 用它，而不是重新打开 App 的时刻。旧 draft 无此字段 → nil。
    public let endedAt: Date?

    public init(
        dateISO: String,
        startedAt: Date,
        prescription: TodayPrescription,
        events: [TrainFlowEvent],
        catalogVersion: String? = nil,
        sessionAllowedEquipment: Set<String>? = nil,
        sessionLoadUnit: LoadUnit? = nil,
        endedAt: Date? = nil
    ) {
        self.version = 1
        self.endedAt = endedAt
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

    /// 当日的草稿都可恢复；跨天只在记过至少一组、且开练不到 36 小时时恢复——晚上开练、
    /// 过了零点 App 被杀，已记的组不能因为日期翻页就被静默清掉（2026-10-18 P0「不丢」）。
    /// 没记过组的跨天草稿没有可丢的东西；超过 36 小时的那一场也已不是「进行中」——
    /// 不设上限会每次启动都问，恢复后时长还会按「到现在」算成几天（审查 2026-10-18）。
    /// 引擎无时钟：now 由调用方传入。
    public static let crossDayRestoreWindow: TimeInterval = 36 * 60 * 60

    public func isRestorable(todayISO: String, now: Date) -> Bool {
        if dateISO == String(todayISO.prefix(10)) { return true }
        guard now.timeIntervalSince(startedAt) < Self.crossDayRestoreWindow else { return false }
        return events.contains { if case .logSet = $0 { return true } else { return false } }
    }

    /// 还在恢复窗口里（同一天，或开练不到 36 小时），**不看记没记过组**。
    /// 表上补组那条路用它：手机侧一组没记、整场都在表上练的草稿，第二天收到排队的组时
    /// 还没有 .logSet——按 isRestorable 会把这些组全拒掉（审查 2026-10-19）。
    public func isWithinRestoreWindow(todayISO: String, now: Date) -> Bool {
        dateISO == String(todayISO.prefix(10)) || now.timeIntervalSince(startedAt) < Self.crossDayRestoreWindow
    }

    /// 补上「进入小结那一刻」。已有的不覆盖。表上最后一组晚到、把训练带进小结时用表上那一下的时刻。
    public func ending(at date: Date) -> TrainSessionDraft {
        guard endedAt == nil else { return self }
        return TrainSessionDraft(
            dateISO: dateISO,
            startedAt: startedAt,
            prescription: prescription,
            events: events,
            catalogVersion: catalogVersion,
            sessionAllowedEquipment: sessionConfiguration?.equipmentSet,
            sessionLoadUnit: sessionConfiguration?.loadUnit,
            endedAt: date
        )
    }

    /// 追加一个事件，返回新 draft（watchOS 切片 4 的杀后台补洞，2026-08-15）。
    ///
    /// 用途只有一个：**手机 app 在训练中被划掉、重开后 flow 还没恢复时，
    /// 接住表侧记的那一组**。那条组必须落进 draft，否则重放时它不存在——
    /// 而用户在表上已经看到「已记录」了。
    ///
    /// 为什么放在类型内部而不是让调用点自己重建：sessionConfiguration 是私有的，
    /// 调用点重建时漏传就会让恢复后的单位/器械退回默认——磅用户当日恢复后
    /// 步长会悄悄回退成 kg（restoreFlow 注释里已经记过这个坑）。
    public func appending(_ event: TrainFlowEvent) -> TrainSessionDraft {
        TrainSessionDraft(
            dateISO: dateISO,
            startedAt: startedAt,
            prescription: prescription,
            events: events + [event],
            catalogVersion: catalogVersion,
            sessionAllowedEquipment: sessionConfiguration?.equipmentSet,
            sessionLoadUnit: sessionConfiguration?.loadUnit,
            endedAt: endedAt
        )
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
