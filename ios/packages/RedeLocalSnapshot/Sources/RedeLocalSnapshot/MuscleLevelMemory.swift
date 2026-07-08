// MuscleLevelMemory — MLE 跨次记忆（批次 B B2 2026-07-07）。
//
// 引擎禁写 canonical（§6.5 红线），但 peakLevel「只升不降」、breakthrough「跨次对比」、
// previousTier 需要上一次的结果——这份 DERIVED 记忆就是那个「上一次」。教义完全复刻
// ReadinessWidgetSnapshot（RedeWidgetShared）：schema 版本化、未知版本拒读、decode
// 失败=如实「无记忆」绝不误读、atomic 写、永不作为 source of truth 读回 canonical。
// 落点：canonical 同目录 muscle-level-memory.json（本地 derived-only，不进 App Group——
// widget 暂不显示等级，YAGNI，交接件拍板⑤）。
//
// 键用 MuscleGroupID rawValue 字符串（Codable 直通 + 未来枚举增值老文件不炸）；
// 消费方 MuscleProfileComposer 对非法键如实丢弃（B1 已测）。

import Foundation

public struct MuscleLevelMemory: Codable, Equatable, Sendable {
    /// 未知版本在 decode 被拒（诚实「无记忆」而非误读）。
    public static let currentSchemaVersion = 1

    public let schemaVersion: Int
    /// 已解锁肌群的当前等级（校准中不记——占位级不是记忆）。
    public let levels: [String: Int]
    /// 已解锁肌群的峰值等级（max 单调的持久侧）。
    public let peaks: [String: Int]
    public let tierRaw: String?
    public let updatedAtIso: String

    public init(schemaVersion: Int = MuscleLevelMemory.currentSchemaVersion,
                levels: [String: Int], peaks: [String: Int],
                tierRaw: String?, updatedAtIso: String) {
        self.schemaVersion = schemaVersion
        self.levels = levels
        self.peaks = peaks
        self.tierRaw = tierRaw
        self.updatedAtIso = updatedAtIso
    }

    /// 从组装产物提取下一次的记忆：只记已解锁肌群（decision != insufficientData ⇔
    /// 已解锁，assembler 契约）；tier calibrating 也如实记（下次 previousTier 语义一致）。
    public static func extract(from profile: MuscleDevelopmentProfile, atIso: String) -> MuscleLevelMemory {
        var levels: [String: Int] = [:]
        var peaks: [String: Int] = [:]
        for estimate in profile.estimates where estimate.decision != .insufficientData {
            levels[estimate.muscleId.rawValue] = estimate.currentLevel
            peaks[estimate.muscleId.rawValue] = estimate.peakLevel
        }
        return MuscleLevelMemory(levels: levels, peaks: peaks,
                                 tierRaw: profile.overallTier.rawValue, updatedAtIso: atIso)
    }

    /// 落盘判断（审查 m2：真实分支逻辑下沉包内可测）：内容变才写——updatedAtIso
    /// 不参与比较（日期变而内容不变不值一次写盘）；首轮全空不写（没有记忆可记）。
    public static func shouldPersist(previous: MuscleLevelMemory?, next: MuscleLevelMemory) -> Bool {
        guard let previous else { return !next.levels.isEmpty }
        return previous.levels != next.levels
            || previous.peaks != next.peaks
            || previous.tierRaw != next.tierRaw
    }

    /// peaks 写入合并（审查 M1/m3）：对盘上现值取 max、盘上有而本轮无的键保留。
    /// 两个并发 loadOutcome 竞写时，无论谁后落盘，双方见过的峰值都不丢（§6.5.4
    /// 「peakLevel 不随下降而消失」的并发面）；肌群若倒退回校准（当前不可达，
    /// 未来加历史编辑功能会出现），其历史 peak 也不被替换语义抹掉。
    /// levels/tierRaw 仍是最后写者胜——它们是「上次快照」语义，旧一拍下轮自愈。
    public func reconcilingPeaks(with disk: MuscleLevelMemory?) -> MuscleLevelMemory {
        guard let disk else { return self }
        var mergedPeaks = peaks
        for (muscle, diskPeak) in disk.peaks {
            mergedPeaks[muscle] = max(mergedPeaks[muscle] ?? diskPeak, diskPeak)
        }
        return MuscleLevelMemory(schemaVersion: schemaVersion, levels: levels,
                                 peaks: mergedPeaks, tierRaw: tierRaw, updatedAtIso: updatedAtIso)
    }
}

public enum MuscleLevelMemoryCodec {
    public static let acceptedSchemaVersions: Set<Int> = [1]

    public static func encode(_ memory: MuscleLevelMemory) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(memory)
    }

    public static func decode(_ data: Data) throws -> MuscleLevelMemory {
        let memory = try JSONDecoder().decode(MuscleLevelMemory.self, from: data)
        guard acceptedSchemaVersions.contains(memory.schemaVersion) else {
            throw MuscleLevelMemoryError.unsupportedSchemaVersion(memory.schemaVersion)
        }
        return memory
    }
}

public enum MuscleLevelMemoryError: Error, Equatable {
    case unsupportedSchemaVersion(Int)
}

/// 文件 store（fileURL 注入=可测）。load 任何失败一律 nil：坏文件/缺文件/坏版本
/// 都是「无记忆」，引擎从零校准——绝不因一个坏 JSON 崩掉进度页。
public struct MuscleLevelMemoryStore: Sendable {
    public let fileURL: URL
    public init(fileURL: URL) { self.fileURL = fileURL }

    public func load() -> MuscleLevelMemory? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? MuscleLevelMemoryCodec.decode(data)
    }

    public func save(_ memory: MuscleLevelMemory) throws {
        let data = try MuscleLevelMemoryCodec.encode(memory)
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: fileURL, options: .atomic)
    }

    /// 写前重读盘上值并做 peaks max 合并（并发竞写对策，见 reconcilingPeaks 注释）。
    /// load 与 write 间仍有毫秒级窗口，但 peak 合并语义保证连续任意两轮都不丢
    /// 已见峰值；完全序列化（actor）等 UI 消费节奏明确后再议（YAGNI，留痕）。
    public func saveReconciling(_ memory: MuscleLevelMemory) throws {
        try save(memory.reconcilingPeaks(with: load()))
    }
}
