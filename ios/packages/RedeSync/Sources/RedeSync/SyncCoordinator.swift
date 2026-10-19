// SyncCoordinator — 一轮同步的编排：拉取 → 合并 → 写回 → 上传。
//
// 做成 actor 是合同的一部分，不是风格选择：canonical 的写闸
// （CanonicalSessionWriter）文件头明写「同一时刻只允许一个 writer 在编排，并发
// load-modify-write 会丢更新」。同步引擎是**第二个**写者，因此必须有隔离保证
// 同步写入和用户写入不会交错。
//
// 另一个不能忽略的现状：SessionStore 的用户写入互斥是「忙则直接返回 false」
// （guard !isSaving），不排队。同步写入若沿用这个策略，撞上用户写入就会被静默
// 丢弃——那是丢数据。所以同步写入走本 actor 串行排队，失败要能重试。

import RedeDomain

/// 同步层读写本地 canonical 的抽象。
///
/// 存在的理由是让编排逻辑能脱离磁盘和 RedePersistence 被完整单测——一轮同步的
/// 分支（离线、未登录、schema 冲突、空变更）都能在 swift test 里覆盖到。
public protocol SyncLocalStore: Sendable {
    func loadStorage() async throws -> (storage: [String: JSONValue], schemaVersion: Int)
    /// 把合并结果写回 canonical。实现必须走既有写闸（含 DataHealth 校验和备份），
    /// 不得绕过——同步不是特权写入。
    func applyMerged(_ storage: [String: JSONValue]) async throws
    func loadCursor() async -> String?
    func saveCursor(_ cursor: String?) async
    /// 已确认上传成功的 sessionId。
    ///
    /// 必须持久化，不能靠「本地有而本次拉取没返回」来推断：拉取是**增量**的，
    /// 游标推进之后每次只回来新记录，那种推断会把整部本地历史算成待上传，
    /// 于是每次同步重传全量（upsert 幂等所以数据不错，但白烧带宽与配额）。
    func loadUploadedSessionIds() async -> Set<String>
    func markSessionsUploaded(_ ids: [String]) async
    /// 本地配置最后修改时刻，ISO8601 UTC。
    func configUpdatedAtIso() async -> String
    func markConfigUploaded(at iso: String) async
    /// 上一次与云端对齐时的配置区（上传成功的那份，或接收下来的云端那份）。nil = 本机还没对齐过。
    ///
    /// 用它判断「本机配置在上次对齐之后改过没有」（2026-10-19）。此前只比时间戳，而本机的
    /// 「改动时刻」从来没有被推进过（一直是纪元），于是登录后第一次上传之后，云端那份永远
    /// 更「新」：手机上改的设置、计划、练完推进的轮换，下一次同步全被改回去，也再传不上去。
    func loadSyncedConfig() async -> [String: JSONValue]?
    func saveSyncedConfig(_ payload: [String: JSONValue]) async
}

/// 一轮同步的如实结果。每个字段都对应用户可能需要知道的事，不做美化。
public struct SyncReport: Equatable, Sendable {
    public let pulledSessionCount: Int
    public let uploadedSessionCount: Int
    public let didUploadConfig: Bool
    public let didChangeLocal: Bool
    /// 因远端记录来自更新版本的 App 而未能合并的条数。> 0 时 UI 必须如实告知，
    /// 不能显示「同步完成」。
    public let blockedByNewerSchema: Int
    /// 因过不了 DataHealth 净化而被隔离的远端记录数。> 0 说明远端有坏数据，
    /// 需要排障——这正是「后台能看到数据」的用途之一。
    public let rejectedUncleanCount: Int

    public init(
        pulledSessionCount: Int,
        uploadedSessionCount: Int,
        didUploadConfig: Bool,
        didChangeLocal: Bool,
        blockedByNewerSchema: Int,
        rejectedUncleanCount: Int = 0
    ) {
        self.pulledSessionCount = pulledSessionCount
        self.uploadedSessionCount = uploadedSessionCount
        self.didUploadConfig = didUploadConfig
        self.didChangeLocal = didChangeLocal
        self.blockedByNewerSchema = blockedByNewerSchema
        self.rejectedUncleanCount = rejectedUncleanCount
    }

    /// 同步是否完整。false 表示有记录没能合并进来——版本太新或数据不干净。
    public var isComplete: Bool { blockedByNewerSchema == 0 && rejectedUncleanCount == 0 }
}

public actor SyncCoordinator {
    private let transport: SyncTransport
    private let localStore: SyncLocalStore
    private let deviceId: String
    private let now: @Sendable () -> String
    private let isSessionAcceptable: (@Sendable ([String: JSONValue]) -> Bool)?

    /// 单页拉取上限的保护性上界。老用户首次登录新设备可能有几百场记录，
    /// 分页由 transport 决定；这里只防御性地限制循环轮数，避免后端游标实现有 bug
    /// 时无限拉取。
    private let maxPages: Int
    private let uploadBatchSize: Int

    public init(
        transport: SyncTransport,
        localStore: SyncLocalStore,
        deviceId: String,
        maxPages: Int = 50,
        uploadBatchSize: Int = 20,
        isSessionAcceptable: (@Sendable ([String: JSONValue]) -> Bool)? = nil,
        now: @escaping @Sendable () -> String
    ) {
        self.transport = transport
        self.localStore = localStore
        self.deviceId = deviceId
        self.maxPages = maxPages
        self.uploadBatchSize = max(1, uploadBatchSize)
        self.isSessionAcceptable = isSessionAcceptable
        self.now = now
    }

    /// 执行一轮同步。抛错时本地数据保持原样——没有部分写入。
    @discardableResult
    public func syncOnce() async throws -> SyncReport {
        let (localStorage, schemaVersion) = try await localStore.loadStorage()

        // ── 拉取 ──────────────────────────────────────────────────────────
        var remoteSessions: [RemoteSessionRecord] = []
        var cursor = await localStore.loadCursor()
        var latestCursor = cursor
        var pages = 0
        while pages < maxPages {
            let page = try await transport.fetchSessions(since: cursor)
            remoteSessions.append(contentsOf: page.sessions)
            latestCursor = page.nextCursor ?? latestCursor
            pages += 1
            guard page.hasMore, page.nextCursor != nil, page.nextCursor != cursor else { break }
            cursor = page.nextCursor
        }
        let remoteConfig = try await transport.fetchConfig()

        // ── 合并 ──────────────────────────────────────────────────────────
        let localConfigUpdatedAt = await localStore.configUpdatedAtIso()
        let alreadyUploaded = await localStore.loadUploadedSessionIds()
        // 本机配置在上次对齐之后改过：这一份就是要上传的，不能输给云端那份旧的。
        // 从没对齐过的设备不算改过——新装的手机拿默认配置去盖账号里的真配置是最坏的方向，
        // 那种情况照旧以云端为准。两台设备都改过时，后同步的那台赢（与原「晚写赢」同一取舍）。
        let syncedConfig = await localStore.loadSyncedConfig()
        let localConfigDirty = syncedConfig.map {
            Self.comparableConfig(of: $0) != Self.comparableConfig(of: localStorage)
        } ?? false
        let outcome = SyncMergeEngine.merge(
            localStorage: localStorage,
            localSchemaVersion: schemaVersion,
            remoteSessions: remoteSessions,
            remoteConfig: remoteConfig,
            localConfigUpdatedAtIso: localConfigUpdatedAt,
            localDeviceId: deviceId,
            isSessionAcceptable: isSessionAcceptable,
            alreadyUploadedIds: alreadyUploaded,
            preferLocalConfig: localConfigDirty
        )

        // ── 写回 ──────────────────────────────────────────────────────────
        // 先写回本地再上传：本地是 source of truth，先落盘保证即使上传失败，
        // 拉到的远端记录也不会丢。
        if outcome.didChangeLocal {
            try await localStore.applyMerged(outcome.mergedStorage)
        }
        // 游标只在写回成功后推进。否则一次写盘失败会让这批记录被永久跳过。
        await localStore.saveCursor(latestCursor)
        // 云端那份赢了（或两边本来一样）：写回成功的这一刻本机就已与云端对齐，立刻记下，不等后面的上传。
        // 否则上传中途失败，下一轮会把这份刚接收的云端配置当成本机改过，拿去盖云端更新的版本。
        // schema 更新的云端配置没合并，不算对齐。
        if !outcome.shouldUploadConfig, let remoteConfig, remoteConfig.schemaVersion <= schemaVersion {
            await localStore.saveSyncedConfig(Self.configPayload(of: outcome.mergedStorage))
        }
        // 本次拉到的记录云端已有，登记为已上传——否则下一轮增量拉不到它们时
        // 会被重新算成待上传。
        if !remoteSessions.isEmpty {
            await localStore.markSessionsUploaded(remoteSessions.map(\.sessionId))
        }

        // ── 上传 ──────────────────────────────────────────────────────────
        let timestamp = now()
        var uploaded = 0
        if !outcome.sessionIdsToUpload.isEmpty {
            let byId = Dictionary(
                uniqueKeysWithValues: (outcome.mergedStorage["history"]?.asArray ?? [])
                    .compactMap { element -> (String, [String: JSONValue])? in
                        guard let object = element.asObject,
                              let id = object["id"]?.asString else { return nil }
                        return (id, object)
                    }
            )
            let records = outcome.sessionIdsToUpload.compactMap { id -> RemoteSessionRecord? in
                guard let payload = byId[id] else { return nil }
                return RemoteSessionRecord(
                    sessionId: id,
                    payload: payload,
                    schemaVersion: schemaVersion,
                    updatedAtIso: timestamp,
                    deviceId: deviceId
                )
            }
            // 分批上传。实测单场训练记录约 39 KB（不是早期估算的 4 KB——那个数字
            // 来自只含顶层字段的样本，真实记录带 exercises/sets/warmup/explanations
            // 几层嵌套）。首次登录要推上百场，一次性 POST 会是几 MB，移动网络下
            // 极易超时，而那正是用户最需要它成功的时刻。
            //
            // 每批成功即记账：中途失败时已传的批次不会重来，下一轮只补剩下的。
            for chunk in records.chunked(into: uploadBatchSize) {
                try await transport.uploadSessions(chunk)
                uploaded += chunk.count
                await localStore.markSessionsUploaded(chunk.map(\.sessionId))
            }
        }

        var didUploadConfig = false
        if outcome.shouldUploadConfig {
            let configPayload = Self.configPayload(of: outcome.mergedStorage)
            try await transport.uploadConfig(
                RemoteConfigRecord(
                    payload: configPayload,
                    schemaVersion: schemaVersion,
                    updatedAtIso: localConfigUpdatedAt,
                    deviceId: deviceId
                )
            )
            await localStore.markConfigUploaded(at: localConfigUpdatedAt)
            await localStore.saveSyncedConfig(configPayload)
            didUploadConfig = true
        }

        return SyncReport(
            pulledSessionCount: outcome.mergedSessionCount,
            uploadedSessionCount: uploaded,
            didUploadConfig: didUploadConfig,
            didChangeLocal: outcome.didChangeLocal,
            blockedByNewerSchema: outcome.blockedByNewerSchema,
            rejectedUncleanCount: outcome.rejectedUncleanCount
        )
    }

    /// 配置区 = history 之外的整块。任何写进 canonical 顶层的健康数据都会自动跟着上云，
    /// 而写那个功能的人不会想起来检查同步载荷：禁运清单把这条约定变成会失败的断言（见 SyncRedaction）。
    /// 上传、判断本机改过没有、记录对齐快照，三处都用这一份，口径不会分叉。
    static func configPayload(of storage: [String: JSONValue]) -> [String: JSONValue] {
        var payload = storage
        payload["history"] = nil
        for key in SyncRedaction.deprecatedHealthKeys { payload[key] = nil }
        return payload
    }

    /// 判断「本机改过没有」时两边都先迁到当前 schema 再比。快照停在保存时的 schema 形状，本机读出来
    /// 已在内存里迁移过；不对齐的话，一次 schema 升级就会让没动过设置的设备被当成改过，去盖别的设备的改动。
    static func comparableConfig(of storage: [String: JSONValue]) -> [String: JSONValue] {
        configPayload(of: SchemaMigrator.migrate(root: storage))
    }
}
