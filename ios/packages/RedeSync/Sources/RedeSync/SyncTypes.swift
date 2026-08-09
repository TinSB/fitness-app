// SyncTypes — 同步层的后端无关数据形态。
//
// 这些类型刻意只描述「一条远端记录长什么样」，不描述它怎么传输。任何后端
// （Postgres 行、Firestore 文档、CloudKit CKRecord）都能填出这几个字段。

import RedeDomain

/// 上传前必须剔除的 canonical 顶层键。
public enum SyncRedaction {
    /// 健康数据顶层键——配置区的禁运清单。
    ///
    /// 这**不是**存量迁移工具：这四个键来自 IronPath（PWA 时代），而 IronPath 只有
    /// owner 和朋友用过，真实用户不会带着这种数据进来；当前 Swift 代码对它们也是
    /// 零引用（2026-08-08 实测 grep 全仓无命中）。
    ///
    /// 它真正的作用是**护栏**：配置区的上传规则是「history 之外整块送上去」，
    /// 也就是说任何将来往 canonical 顶层写健康数据的改动，都会自动、静默地把那份
    /// 数据同步到云端——没有人会在写那个功能时想起来检查同步载荷。这份清单加上
    /// 它的测试，把「配置区不夹带健康数据」变成一条会失败的断言而不是一句口头约定。
    /// 新增健康类顶层键时一并加进来。
    ///
    /// 为什么是黑名单而不是「只上传已知键」：配置区遵循 open-bag——新版本 App 写的
    /// 字段，旧版本不认识也不该丢，白名单会让跨版本同步静默吃掉新字段。
    ///
    /// 只管「不上传」。本地 canonical 一个字节不动——删用户数据是另一回事。
    public static let deprecatedHealthKeys: Set<String> = [
        "bodyWeights",
        "healthMetricSamples",
        "healthImportBatches",
        "importedWorkoutSamples",
    ]
}

/// 一条远端训练记录。对应 canonical `history` 里的一个 TrainingSession。
///
/// 切分理由（实测）：history 占 canonical 体量的绝大部分，且是唯一 append-only、
/// 带稳定 id 的区域——天然适合记录级同步，合并退化成 id 并集，不需要 CRDT。
///
/// 体积更正（2026-08-08 实测 fixture）：**单场约 39 KB**，不是早期估算的 4.2 KB——
/// 那个数字来自只含顶层字段的样本，真实记录带 exercises/sets/warmup/explanations
/// 几层嵌套。上传因此必须分批（见 SyncCoordinator.uploadBatchSize）：上百场一次性
/// POST 是几 MB，移动网络下极易超时。
public struct RemoteSessionRecord: Equatable, Sendable {
    /// TrainingSession.id，形如 `session-<UUID>`。远端主键的一部分。
    public let sessionId: String
    /// TrainingSession.storage 原样（open-bag，未知字段不丢）。
    public let payload: [String: JSONValue]
    /// 写入这条记录的设备当时的 SchemaVersion.current。
    public let schemaVersion: Int
    /// 写入时刻，ISO8601 UTC。
    public let updatedAtIso: String
    /// 写入设备的稳定标识，用于确定性打破 LWW 平局。
    public let deviceId: String

    public init(
        sessionId: String,
        payload: [String: JSONValue],
        schemaVersion: Int,
        updatedAtIso: String,
        deviceId: String
    ) {
        self.sessionId = sessionId
        self.payload = payload
        self.schemaVersion = schemaVersion
        self.updatedAtIso = updatedAtIso
        self.deviceId = deviceId
    }
}

/// 远端配置记录：canonical 里 `history` 以外的全部顶层键，作为一个整体。
///
/// 切分理由（实测）：配置区合计 328 字节、改动低频，整块 last-writer-wins 就够，
/// 不值得为它做字段级合并。真正的代价是两台设备同时改配置会丢掉其中一次改动——
/// 这是有意接受的取舍，且因为体量小、改动少，实际碰撞概率极低。
public struct RemoteConfigRecord: Equatable, Sendable {
    public let payload: [String: JSONValue]
    public let schemaVersion: Int
    public let updatedAtIso: String
    public let deviceId: String

    public init(
        payload: [String: JSONValue],
        schemaVersion: Int,
        updatedAtIso: String,
        deviceId: String
    ) {
        self.payload = payload
        self.schemaVersion = schemaVersion
        self.updatedAtIso = updatedAtIso
        self.deviceId = deviceId
    }
}

/// 合并的产物。调用方拿它去（a）写回 canonical、（b）决定上传什么。
public struct SyncMergeOutcome: Equatable, Sendable {
    /// 合并后的完整 canonical storage。`didChangeLocal == false` 时与输入逐字节相同。
    public let mergedStorage: [String: JSONValue]
    /// 实际新并入本地的训练记录数。
    ///
    /// 有意与「远端返回条数」区分：远端一批里可能既有本地已有的（跳过），也有
    /// schema 太新的（阻塞）。报给用户的「同步到几场」必须是真正进了本地的数量，
    /// 否则用户会以为记录丢了。
    public let mergedSessionCount: Int
    /// 本地有、远端没有的训练记录，需要上传。
    public let sessionIdsToUpload: [String]
    /// 本地配置比远端新（或远端没有配置），需要上传。
    public let shouldUploadConfig: Bool
    /// 因为 schemaVersion 高于本机 current 而**没有**被合并的远端记录数。
    ///
    /// 这不是「丢弃」——这些记录仍在远端，等 App 更新后会正常合并进来。但 UI
    /// 必须如实告诉用户「另一台设备用了更新版本的 Rede」，不能装作同步完整。
    public let blockedByNewerSchema: Int
    /// 因为过不了 DataHealth 净化而被隔离的远端记录数。
    ///
    /// 存在的理由：写闸的 gate 要求「新增的 raw history 条目必须在 clean 视图中存活」
    /// （CanonicalWriteValidation:37-41），否则**整批**写入被拒。同步一旦整批提交，
    /// 远端一条脏记录就会让所有好记录陪葬、用户永远同步不上。所以脏记录在合并阶段
    /// 就逐条隔离掉，好记录照常落地。
    public let rejectedUncleanCount: Int
    /// 合并是否真的改变了本地。false 时调用方应跳过写盘（避免无谓的备份文件和写闸开销）。
    public let didChangeLocal: Bool

    public init(
        mergedStorage: [String: JSONValue],
        mergedSessionCount: Int,
        sessionIdsToUpload: [String],
        shouldUploadConfig: Bool,
        blockedByNewerSchema: Int,
        rejectedUncleanCount: Int = 0,
        didChangeLocal: Bool
    ) {
        self.mergedStorage = mergedStorage
        self.mergedSessionCount = mergedSessionCount
        self.sessionIdsToUpload = sessionIdsToUpload
        self.shouldUploadConfig = shouldUploadConfig
        self.blockedByNewerSchema = blockedByNewerSchema
        self.rejectedUncleanCount = rejectedUncleanCount
        self.didChangeLocal = didChangeLocal
    }
}


extension Array {
    /// 定长切块。标准库没有，而同步需要它把上传拆成可独立成功的批次。
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return isEmpty ? [] : [self] }
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
