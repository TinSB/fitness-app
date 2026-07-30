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
    /// 正在补足的肌群（批次 E 自动均衡的喂数面：assembler 真 decision——已排除
    /// detraining/recover；今日页读此名单喂处方引擎加量）。optional：schema 1 加性
    /// 字段，旧文件缺省 nil = 空（零迁移）。
    public let priorityMuscles: [String]?
    /// 尚待消费的跨次突破事实。optional 保持 schema v1 旧文件零迁移；消费面只按日期
    /// 派生展示，不把读取当回执清空，最多保留 20 条。
    public let pendingBreakthroughs: [LevelBreakthrough]?
    /// 均衡改善的 stable reference / candidate 状态。optional 保持 schema v1 旧文件
    /// 零迁移；raw score、contributor reference level 与 confidence 事实都封在纯策略类型。
    public let balanceImprovementState: BalanceImprovementState?
    public let updatedAtIso: String

    public init(schemaVersion: Int = MuscleLevelMemory.currentSchemaVersion,
                levels: [String: Int], peaks: [String: Int],
                tierRaw: String?, priorityMuscles: [String]? = nil,
                pendingBreakthroughs: [LevelBreakthrough]? = nil,
                balanceImprovementState: BalanceImprovementState? = nil,
                updatedAtIso: String) {
        self.schemaVersion = schemaVersion
        self.levels = levels
        self.peaks = peaks
        self.tierRaw = tierRaw
        self.priorityMuscles = priorityMuscles
        self.pendingBreakthroughs = pendingBreakthroughs
        self.balanceImprovementState = balanceImprovementState
        self.updatedAtIso = updatedAtIso
    }

    /// 从组装产物提取下一次的记忆：只记已解锁肌群（decision != insufficientData ⇔
    /// 已解锁，assembler 契约）；tier calibrating 也如实记（下次 previousTier 语义一致）。
    public static func extract(
        from profile: MuscleDevelopmentProfile,
        pendingBreakthroughs: [LevelBreakthrough]? = nil,
        balanceImprovementState: BalanceImprovementState? = nil,
        atIso: String
    ) -> MuscleLevelMemory {
        var levels: [String: Int] = [:]
        var peaks: [String: Int] = [:]
        for estimate in profile.estimates where estimate.decision != .insufficientData {
            levels[estimate.muscleId.rawValue] = estimate.currentLevel
            peaks[estimate.muscleId.rawValue] = estimate.peakLevel
        }
        return MuscleLevelMemory(levels: levels, peaks: peaks,
                                 tierRaw: profile.overallTier.rawValue,
                                 priorityMuscles: profile.priorityMuscleIds.map(\.rawValue),
                                 pendingBreakthroughs: pendingBreakthroughs,
                                 balanceImprovementState: balanceImprovementState,
                                 updatedAtIso: atIso)
    }

    /// 落盘判断（审查 m2：真实分支逻辑下沉包内可测）：内容变才写——updatedAtIso
    /// 不参与比较（日期变而内容不变不值一次写盘）；首轮全空不写（没有记忆可记）。
    public static func shouldPersist(previous: MuscleLevelMemory?, next: MuscleLevelMemory) -> Bool {
        guard let previous else { return !next.levels.isEmpty }
        return previous.levels != next.levels
            || previous.peaks != next.peaks
            || previous.tierRaw != next.tierRaw
            || (previous.priorityMuscles ?? []) != (next.priorityMuscles ?? [])
            || (previous.pendingBreakthroughs ?? []) != (next.pendingBreakthroughs ?? [])
            || previous.balanceImprovementState != next.balanceImprovementState
    }

    /// 既有 pending 在前、本轮新事实在后；按裁定键去重并自然滚动到最近 20 条。
    /// fromLevel/fromTier 不进键：同一目标、kind、终点与日期就是同一突破事实。
    public static func mergingPending(
        existing: [LevelBreakthrough],
        new: [LevelBreakthrough],
        limit: Int = 20
    ) -> [LevelBreakthrough] {
        guard limit > 0 else { return [] }
        var seen = Set<PendingBreakthroughKey>()
        let merged = (existing + new).filter { event in
            seen.insert(PendingBreakthroughKey(event)).inserted
        }
        return Array(merged.suffix(limit))
    }

    /// profile → 下一份 derived memory 的唯一推进点：先让 B2 纯策略评估，再把确认事件
    /// 与上游 muscle/tier breakthrough 一并 append 进同一 pending 管道。
    public static func advancing(
        from profile: MuscleDevelopmentProfile,
        previous: MuscleLevelMemory?,
        completedSessionCount: Int,
        atIso: String
    ) -> MuscleLevelMemory {
        var balanceState = previous?.balanceImprovementState
        var balanceEvent: LevelBreakthrough?

        if let score = profile.balanceScore {
            let contributors = profile.estimates
                .filter { $0.decision != .insufficientData }
                .map {
                    BalanceImprovementContributor(
                        id: $0.muscleId.rawValue,
                        level: $0.currentLevel,
                        trend: $0.trend,
                        confidence: $0.confidence
                    )
                }
            let result = BalanceImprovementPolicy.evaluate(
                previousState: balanceState ?? BalanceImprovementState(),
                observation: BalanceImprovementObservation(
                    score: score,
                    completedSessionCount: completedSessionCount,
                    contributors: contributors
                )
            )
            balanceState = result.state.reference == nil && result.state.candidate == nil
                ? nil
                : result.state
            if let event = result.confirmedEvent,
               let targetId = event.directionIDs.first {
                balanceEvent = LevelBreakthrough(
                    kind: .balanceMilestone,
                    targetId: targetId,
                    fromLevel: Int(event.fromScore.rounded()),
                    toLevel: Int(event.toScore.rounded()),
                    fromTier: nil,
                    toTier: nil,
                    evidence: event.directionIDs.compactMap { raw in
                        MuscleGroupID(rawValue: raw).map {
                            MuscleLevelEvidence(code: "balanceImproved", muscleId: $0)
                        }
                    },
                    achievedAtIso: atIso
                )
            }
        } else {
            // 分数不可得 = 不可比观察（同 contributor 集合变化的「新口径新起点」裁定）：
            // 清空 reference/candidate，防止分数恢复后拿过期对比确认陈旧改善。
            balanceState = nil
        }

        var newEvents = profile.breakthroughs.map {
            stampingEventFacts(on: $0, from: profile)
        }
        if let balanceEvent { newEvents.append(balanceEvent) }
        let hadPendingField = previous?.pendingBreakthroughs != nil
        let pending = hadPendingField || !newEvents.isEmpty
            ? mergingPending(
                existing: previous?.pendingBreakthroughs ?? [],
                new: newEvents
            )
            : nil

        return extract(
            from: profile,
            pendingBreakthroughs: pending,
            balanceImprovementState: balanceState,
            atIso: atIso
        )
    }

    /// 资格事实只在事件首次进入 pending 前取样；mergingPending 既有项优先，因此同一
    /// 去重键后续重算不会把 low 改成 medium，也不会让旧文件缺失事实的事件突然可分享。
    private static func stampingEventFacts(
        on event: LevelBreakthrough,
        from profile: MuscleDevelopmentProfile
    ) -> LevelBreakthrough {
        guard event.eventFacts == nil else { return event }

        let contributors: [MuscleLevelEstimate]
        switch event.kind {
        case .muscleLevel:
            contributors = profile.estimates.filter {
                $0.muscleId.rawValue == event.targetId
                    && $0.decision != .insufficientData
            }
        case .trainingTier:
            contributors = profile.estimates.filter {
                $0.decision != .insufficientData
            }
        case .strengthMilestone, .balanceMilestone, .consistencyMilestone:
            return event
        }
        guard !contributors.isEmpty else { return event }

        let confidence = conservativeMedianConfidence(
            contributors.map(\.confidence)
        )
        let facts = LevelBreakthroughEventFacts(
            confidenceAtEventRaw: confidence.rawValue,
            decisionRawsAtEvent: Array(
                Set(contributors.map { $0.decision.rawValue })
            ).sorted(),
            limitationCodesAtEvent: Array(
                Set(contributors.flatMap { $0.limitations.map(\.code) })
            ).sorted(),
            recoveryPenaltyAtEvent: contributors
                .map(\.score.recoveryPenalty)
                .max() ?? 0
        )
        return LevelBreakthrough(
            kind: event.kind,
            targetId: event.targetId,
            fromLevel: event.fromLevel,
            toLevel: event.toLevel,
            fromTier: event.fromTier,
            toTier: event.toTier,
            evidence: event.evidence,
            achievedAtIso: event.achievedAtIso,
            eventFacts: facts
        )
    }

    /// 与 tier / B2 约定一致：偶数样本取排序后的低侧中位。
    private static func conservativeMedianConfidence(
        _ values: [EstimateConfidence]
    ) -> EstimateConfidence {
        let ranks = values.map(confidenceRank).sorted()
        guard !ranks.isEmpty else { return .low }
        switch ranks[(ranks.count - 1) / 2] {
        case 2: return .high
        case 1: return .medium
        default: return .low
        }
    }

    private static func confidenceRank(_ confidence: EstimateConfidence) -> Int {
        switch confidence {
        case .low: return 0
        case .medium: return 1
        case .high: return 2
        }
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
        let hasPendingField = pendingBreakthroughs != nil || disk.pendingBreakthroughs != nil
        let mergedPending = hasPendingField
            ? Self.mergingPending(
                existing: disk.pendingBreakthroughs ?? [],
                new: pendingBreakthroughs ?? []
            )
            : nil
        let mergedBalanceState = balanceImprovementState ?? disk.balanceImprovementState
        return MuscleLevelMemory(schemaVersion: schemaVersion, levels: levels,
                                 peaks: mergedPeaks, tierRaw: tierRaw,
                                 priorityMuscles: priorityMuscles,
                                 pendingBreakthroughs: mergedPending,
                                 balanceImprovementState: mergedBalanceState,
                                 updatedAtIso: updatedAtIso)
    }
}

private struct PendingBreakthroughKey: Hashable {
    let targetId: String
    let kindRaw: String
    let toLevel: Int?
    let toTierRaw: String?
    let achievedAtIso: String

    init(_ event: LevelBreakthrough) {
        targetId = event.targetId
        kindRaw = event.kind.rawValue
        toLevel = event.toLevel
        toTierRaw = event.toTier?.rawValue
        achievedAtIso = event.achievedAtIso
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
    /// 所有实例共享：app 的四个 loadOutcome 调用点虽然各自创建 store，仍须进入同一
    /// 进程级事务；实例锁无法阻止不同 store 竞写同一文件。
    private static let transactionLock = NSLock()

    public let fileURL: URL
    public init(fileURL: URL) { self.fileURL = fileURL }

    /// 串行化完整的 read → derive/reconcile → write。closure 内写入必须调用 `save`
    /// 而非再次进入本方法；调用方可把 canonical 读取与投影也放进同一闭包，避免旧
    /// session 观察在较新观察之后回写 B2 reference/candidate。
    public func withExclusiveAccess<T>(
        _ body: (MuscleLevelMemory?) throws -> T
    ) rethrows -> T {
        Self.transactionLock.lock()
        defer { Self.transactionLock.unlock() }
        return try body(load())
    }

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

    /// 包外只需提交一份 memory 时的安全入口；ProgressModel 的完整事务已经持锁，
    /// 因而在闭包内直接调用 `save`，避免重入非递归锁。
    public func saveReconciling(_ memory: MuscleLevelMemory) throws {
        try withExclusiveAccess { disk in
            try save(memory.reconcilingPeaks(with: disk))
        }
    }
}
