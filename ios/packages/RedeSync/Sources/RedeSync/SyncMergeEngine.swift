// SyncMergeEngine — 把远端记录并进本地 canonical 的纯函数。
//
// 不碰磁盘、不碰网络、不持有状态。给定（本地 storage，远端记录集），算出合并后的
// storage 和待上传清单。所有同步的数据正确性都收敛在这一个文件里，因此它必须能被
// swift test 穷举验证，不依赖账号、网络或真机。
//
// 三条合并语义（各自的理由写在实现处）：
//   1. history  → id 并集，本地优先，永不覆盖已有记录
//   2. 配置区   → 整块 last-writer-wins，平局按 deviceId 确定性打破
//   3. schema   → 高于本机 current 的远端记录一律不合并，如实计数上报（fail-closed）

import RedeDomain

public enum SyncMergeEngine {

    /// 合并远端记录到本地 canonical storage。
    ///
    /// - Parameters:
    ///   - localStorage: 本地 canonical 的完整 storage（AppData.storage）。
    ///   - localSchemaVersion: 本机 SchemaVersion.current。
    ///   - remoteSessions: 本轮拉取到的远端训练记录。
    ///   - remoteConfig: 远端配置记录；首次同步或远端还没有配置时为 nil。
    ///   - localConfigUpdatedAtIso: 本地配置的最后修改时刻。
    ///   - localDeviceId: 本机设备标识。
    ///   - isSessionAcceptable: 远端记录能否通过 DataHealth 净化。调用方注入
    ///     CanonicalWriteValidation 的等价判断；返回 false 的记录被逐条隔离，
    ///     不进入候选。传 nil 表示不做该检查（仅用于测试合并语义本身）。
    public static func merge(
        localStorage: [String: JSONValue],
        localSchemaVersion: Int,
        remoteSessions: [RemoteSessionRecord],
        remoteConfig: RemoteConfigRecord?,
        localConfigUpdatedAtIso: String,
        localDeviceId: String,
        isSessionAcceptable: (@Sendable ([String: JSONValue]) -> Bool)? = nil
    ) -> SyncMergeOutcome {
        var blocked = 0
        var rejectedUnclean = 0

        // ── 1. history：id 并集 ────────────────────────────────────────────
        //
        // 本地优先且永不覆盖：history 在写闸里是 append-only（唯一写入点是
        // appendCompletedSession，且 DataHealth 守卫会因 clean session 丢失而拒写）。
        // 因此同 id 的两条记录在合同上内容相同；即使因异常而不同，覆盖本地也是
        // 更坏的选择——那等于让远端删改本地已完成的训练。
        let localHistory = localStorage["history"]?.asArray ?? []
        var localSessionIds = Set<String>()
        for element in localHistory {
            if let id = element.asObject?["id"]?.asString { localSessionIds.insert(id) }
        }

        var newSessions: [(sortKey: String, id: String, payload: [String: JSONValue])] = []
        var remoteSessionIds = Set<String>()
        for record in remoteSessions {
            remoteSessionIds.insert(record.sessionId)
            // schema 护栏：远端记录来自更新版本的 App，本机的 SchemaVersion.validate
            // 会硬拒（futureIncompatible）。这里提前跳过并计数，让 UI 能如实说明，
            // 而不是让整个 canonical 变成不可读。
            guard record.schemaVersion <= localSchemaVersion else {
                blocked += 1
                continue
            }
            guard !localSessionIds.contains(record.sessionId) else { continue }
            // 逐条隔离脏记录：写闸 gate 会因「新增条目过不了净化」而拒绝**整批**写入，
            // 一条坏记录就能让整轮同步永久失败。这里提前剔除，好记录照常落地。
            if let isSessionAcceptable, !isSessionAcceptable(record.payload) {
                rejectedUnclean += 1
                continue
            }
            let date = record.payload["date"]?.asString ?? "9999-99-99"
            newSessions.append((sortKey: date, id: record.sessionId, payload: record.payload))
        }

        var mergedStorage = localStorage
        var didChangeLocal = false

        if !newSessions.isEmpty {
            // 顺序是正确性问题，不是美观问题：引擎按「历史最后一场的日期」判定回归
            // 协议（≥21 天 = 重启场），按历史条数推进轮换。远端记录若一律追加到末尾，
            // 一条补同步进来的旧记录就会把「最后一场」算成旧日期。
            //
            // 稳定性保证：本地记录保持原有相对顺序（sorted(by:) 在 Swift 里不保证
            // 稳定，所以用本地索引作为显式次键）；同日的远端记录排在本地记录之后、
            // 彼此按 id 排序，使结果与拉取顺序无关。
            //
            // 只在真的有新记录时才重排——没有新记录时 history 一个字节都不动。
            enum Origin { case local(index: Int), remote(id: String) }
            var combined: [(date: String, origin: Origin, value: JSONValue)] = []
            for (index, element) in localHistory.enumerated() {
                let date = element.asObject?["date"]?.asString ?? "9999-99-99"
                combined.append((date: date, origin: .local(index: index), value: element))
            }
            for session in newSessions {
                combined.append((
                    date: session.sortKey,
                    origin: .remote(id: session.id),
                    value: .object(session.payload)
                ))
            }
            combined.sort { lhs, rhs in
                if lhs.date != rhs.date { return lhs.date < rhs.date }
                switch (lhs.origin, rhs.origin) {
                case let (.local(l), .local(r)):   return l < r
                case (.local, .remote):            return true
                case (.remote, .local):            return false
                case let (.remote(l), .remote(r)): return l < r
                }
            }
            mergedStorage["history"] = .array(combined.map(\.value))
            didChangeLocal = true
        }

        // ── 2. 配置区：整块 last-writer-wins ────────────────────────────────
        //
        // 配置区实测 328 字节、改动低频，字段级合并的复杂度换不来相称的收益。
        // 已知取舍：两台设备在同一次同步间隔内都改了配置，晚写的那次整体获胜，
        // 早写的改动丢失。
        var shouldUploadConfig = true
        if let remote = remoteConfig {
            if remote.schemaVersion > localSchemaVersion {
                // 远端配置来自更新版本：不合并、也不用本地覆盖它（覆盖会让新版设备
                // 掉配置）。等 App 更新后再同步。
                blocked += 1
                shouldUploadConfig = false
            } else {
                let remoteWins: Bool
                if remote.updatedAtIso != localConfigUpdatedAtIso {
                    remoteWins = remote.updatedAtIso > localConfigUpdatedAtIso
                } else {
                    // 时间戳相同（同秒写入或时钟粒度不足）时按 deviceId 字典序决胜。
                    // 目的是让两台设备算出**同一个**赢家——否则它们会各自认为自己赢，
                    // 互相覆盖形成同步抖动。
                    remoteWins = remote.deviceId > localDeviceId
                }
                if remoteWins {
                    for (key, value) in remote.payload where key != "history" {
                        if mergedStorage[key] != value {
                            mergedStorage[key] = value
                            didChangeLocal = true
                        }
                    }
                    // 远端配置里没有、本地有的顶层键要删掉，否则本地删除的配置项
                    // 会在每次同步后复活。history 和 schemaVersion 不参与。
                    let remoteKeys = Set(remote.payload.keys)
                    for key in Array(mergedStorage.keys)
                    where key != "history" && key != "schemaVersion" && !remoteKeys.contains(key) {
                        mergedStorage[key] = nil
                        didChangeLocal = true
                    }
                    shouldUploadConfig = false
                }
            }
        }

        // 本地有、远端没有的记录 → 待上传。远端因 schema 太新而被跳过的 id 不在
        // 此列（它们在远端已存在），避免用旧版本覆盖新版本写的记录。
        let sessionIdsToUpload = localSessionIds.subtracting(remoteSessionIds).sorted()

        return SyncMergeOutcome(
            mergedStorage: mergedStorage,
            mergedSessionCount: newSessions.count,
            sessionIdsToUpload: sessionIdsToUpload,
            shouldUploadConfig: shouldUploadConfig,
            blockedByNewerSchema: blocked,
            rejectedUncleanCount: rejectedUnclean,
            didChangeLocal: didChangeLocal
        )
    }
}
