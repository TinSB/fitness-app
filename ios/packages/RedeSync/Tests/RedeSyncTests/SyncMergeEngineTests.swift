// 合并语义的穷举验证。同步唯一会真正毁数据的地方是合并，所以这里覆盖到
// 「远端补一条旧记录会不会把回归协议算错」这种具体的、会影响用户看到什么的场景，
// 而不只是覆盖行数。

import XCTest
import RedeDomain
@testable import RedeSync

private let localSchema = 11

private func session(_ id: String, date: String, extra: [String: JSONValue] = [:]) -> [String: JSONValue] {
    var payload: [String: JSONValue] = [
        "id": .string(id),
        "date": .string(date),
        "completed": .bool(true)
    ]
    for (key, value) in extra { payload[key] = value }
    return payload
}

private func storage(history: [[String: JSONValue]], config: [String: JSONValue] = [:]) -> [String: JSONValue] {
    var root: [String: JSONValue] = [
        "schemaVersion": .int(Int64(localSchema)),
        "history": .array(history.map { .object($0) })
    ]
    for (key, value) in config { root[key] = value }
    return root
}

private func historyIds(_ storage: [String: JSONValue]) -> [String] {
    (storage["history"]?.asArray ?? []).compactMap { $0.asObject?["id"]?.asString }
}

private func merge(
    local: [String: JSONValue],
    remoteSessions: [RemoteSessionRecord] = [],
    remoteConfig: RemoteConfigRecord? = nil,
    localConfigUpdatedAtIso: String = "2026-01-01T00:00:00Z",
    localDeviceId: String = "device-A"
) -> SyncMergeOutcome {
    SyncMergeEngine.merge(
        localStorage: local,
        localSchemaVersion: localSchema,
        remoteSessions: remoteSessions,
        remoteConfig: remoteConfig,
        localConfigUpdatedAtIso: localConfigUpdatedAtIso,
        localDeviceId: localDeviceId
    )
}

private func remoteSession(
    _ id: String,
    date: String,
    schema: Int = localSchema,
    extra: [String: JSONValue] = [:]
) -> RemoteSessionRecord {
    RemoteSessionRecord(
        sessionId: id,
        payload: session(id, date: date, extra: extra),
        schemaVersion: schema,
        updatedAtIso: "2026-01-01T00:00:00Z",
        deviceId: "device-B"
    )
}

final class SyncMergeEngineTests: XCTestCase {

    // MARK: history 并集

    func testFirstSyncUploadsEverythingAndLeavesLocalUntouched() {
        let local = storage(history: [
            session("session-1", date: "2026-01-01"),
            session("session-2", date: "2026-01-03")
        ])

        let outcome = merge(local: local)

        XCTAssertEqual(outcome.sessionIdsToUpload, ["session-1", "session-2"])
        XCTAssertFalse(outcome.didChangeLocal)
        XCTAssertEqual(outcome.mergedStorage, local, "远端为空时本地必须逐字节不变")
    }

    func testRemoteOnlySessionsAreMergedIn() {
        let local = storage(history: [session("session-1", date: "2026-01-01")])

        let outcome = merge(local: local, remoteSessions: [
            remoteSession("session-2", date: "2026-01-03"),
            remoteSession("session-3", date: "2026-01-05")
        ])

        XCTAssertTrue(outcome.didChangeLocal)
        XCTAssertEqual(historyIds(outcome.mergedStorage), ["session-1", "session-2", "session-3"])
        XCTAssertEqual(outcome.sessionIdsToUpload, ["session-1"])
    }

    func testSameIdNeverOverwritesLocalContent() {
        // history 在写闸里是 append-only，同 id 内容在合同上相同。即使远端内容不同，
        // 覆盖本地等于让远端删改用户已完成的训练——永远保留本地。
        let local = storage(history: [
            session("session-1", date: "2026-01-01", extra: ["note": .string("本地版本")])
        ])

        let outcome = merge(local: local, remoteSessions: [
            remoteSession("session-1", date: "2026-01-01", extra: ["note": .string("远端版本")])
        ])

        XCTAssertFalse(outcome.didChangeLocal)
        let note = outcome.mergedStorage["history"]?.asArray?.first?.asObject?["note"]?.asString
        XCTAssertEqual(note, "本地版本")
        XCTAssertEqual(outcome.sessionIdsToUpload, [], "两边都有的记录不需要上传")
    }

    // MARK: 顺序正确性（回归协议 / 轮换依赖「最后一场」）

    func testBackfilledOlderRemoteSessionLandsInDateOrderNotAtTheEnd() {
        // 关键场景：另一台设备补同步来一条**旧**记录。若一律追加到末尾，引擎会把
        // 「历史最后一场」读成这条旧记录，从而误判回归协议（≥21 天 = 重启场）。
        let local = storage(history: [
            session("session-old", date: "2026-01-01"),
            session("session-new", date: "2026-03-01")
        ])

        let outcome = merge(local: local, remoteSessions: [
            remoteSession("session-mid", date: "2026-02-01")
        ])

        XCTAssertEqual(historyIds(outcome.mergedStorage), ["session-old", "session-mid", "session-new"])
        let lastDate = outcome.mergedStorage["history"]?.asArray?.last?.asObject?["date"]?.asString
        XCTAssertEqual(lastDate, "2026-03-01", "最后一场必须仍是日期最新的那场")
    }

    func testMergeResultIsIndependentOfRemoteFetchOrder() {
        let local = storage(history: [session("session-1", date: "2026-01-01")])
        let a = remoteSession("session-a", date: "2026-02-01")
        let b = remoteSession("session-b", date: "2026-02-01")

        let forward = merge(local: local, remoteSessions: [a, b])
        let reversed = merge(local: local, remoteSessions: [b, a])

        XCTAssertEqual(historyIds(forward.mergedStorage), historyIds(reversed.mergedStorage))
        XCTAssertEqual(forward.mergedStorage, reversed.mergedStorage)
    }

    func testLocalRelativeOrderIsPreservedForSameDaySessions() {
        // 同日两场的本地先后顺序有意义（第二场是当天的后一次训练），排序不能打乱它。
        let local = storage(history: [
            session("session-z", date: "2026-01-01"),
            session("session-a", date: "2026-01-01")
        ])

        let outcome = merge(local: local, remoteSessions: [
            remoteSession("session-m", date: "2026-01-02")
        ])

        XCTAssertEqual(historyIds(outcome.mergedStorage), ["session-z", "session-a", "session-m"])
    }

    // MARK: schema 护栏

    func testSessionFromNewerSchemaIsSkippedAndCounted() {
        // 另一台设备升了新版 App。本机 SchemaVersion.validate 会硬拒 futureIncompatible，
        // 所以这里提前跳过——但必须计数，让 UI 如实说明同步不完整，而不是假装成功。
        let local = storage(history: [session("session-1", date: "2026-01-01")])

        let outcome = merge(local: local, remoteSessions: [
            remoteSession("session-future", date: "2026-02-01", schema: localSchema + 1)
        ])

        XCTAssertEqual(outcome.blockedByNewerSchema, 1)
        XCTAssertFalse(outcome.didChangeLocal)
        XCTAssertEqual(historyIds(outcome.mergedStorage), ["session-1"])
    }

    func testSkippedNewerSchemaSessionIsNotQueuedForUpload() {
        // 这条记录在远端已存在，只是本机读不懂。绝不能把它当成「远端缺失」而用旧
        // 版本格式覆盖上去。
        let local = storage(history: [session("session-1", date: "2026-01-01")])

        let outcome = merge(local: local, remoteSessions: [
            remoteSession("session-future", date: "2026-02-01", schema: localSchema + 1)
        ])

        XCTAssertFalse(outcome.sessionIdsToUpload.contains("session-future"))
    }

    func testConfigFromNewerSchemaIsNeitherMergedNorOverwritten() {
        let local = storage(history: [], config: ["unitSystem": .string("kg")])
        let remote = RemoteConfigRecord(
            payload: ["unitSystem": .string("lb")],
            schemaVersion: localSchema + 1,
            updatedAtIso: "2026-06-01T00:00:00Z",
            deviceId: "device-B"
        )

        let outcome = merge(local: local, remoteConfig: remote)

        XCTAssertEqual(outcome.blockedByNewerSchema, 1)
        XCTAssertFalse(outcome.didChangeLocal)
        XCTAssertFalse(outcome.shouldUploadConfig, "不得用旧版本配置覆盖新版本设备写的配置")
    }

    // MARK: 配置 last-writer-wins

    func testNewerRemoteConfigWins() {
        let local = storage(history: [], config: ["unitSystem": .string("kg")])
        let remote = RemoteConfigRecord(
            payload: ["schemaVersion": .int(Int64(localSchema)), "unitSystem": .string("lb")],
            schemaVersion: localSchema,
            updatedAtIso: "2026-06-01T00:00:00Z",
            deviceId: "device-B"
        )

        let outcome = merge(
            local: local, remoteConfig: remote,
            localConfigUpdatedAtIso: "2026-05-01T00:00:00Z"
        )

        XCTAssertTrue(outcome.didChangeLocal)
        XCTAssertEqual(outcome.mergedStorage["unitSystem"]?.asString, "lb")
        XCTAssertFalse(outcome.shouldUploadConfig)
    }

    func testOlderRemoteConfigLosesAndLocalIsQueuedForUpload() {
        let local = storage(history: [], config: ["unitSystem": .string("kg")])
        let remote = RemoteConfigRecord(
            payload: ["unitSystem": .string("lb")],
            schemaVersion: localSchema,
            updatedAtIso: "2026-04-01T00:00:00Z",
            deviceId: "device-B"
        )

        let outcome = merge(
            local: local, remoteConfig: remote,
            localConfigUpdatedAtIso: "2026-05-01T00:00:00Z"
        )

        XCTAssertFalse(outcome.didChangeLocal)
        XCTAssertEqual(outcome.mergedStorage["unitSystem"]?.asString, "kg")
        XCTAssertTrue(outcome.shouldUploadConfig)
    }

    func testTimestampTieIsBrokenDeterministicallySoBothDevicesAgree() {
        // 同秒写入时，两台设备必须算出**同一个**赢家。否则各自认为自己赢，
        // 会互相覆盖形成永不收敛的同步抖动。
        let sameInstant = "2026-05-01T00:00:00Z"
        let localOnA = storage(history: [], config: ["unitSystem": .string("kg")])
        let localOnB = storage(history: [], config: ["unitSystem": .string("lb")])

        // 设备 A 看到的远端是 B 写的
        let outcomeOnA = merge(
            local: localOnA,
            remoteConfig: RemoteConfigRecord(
                payload: ["unitSystem": .string("lb")],
                schemaVersion: localSchema,
                updatedAtIso: sameInstant,
                deviceId: "device-B"
            ),
            localConfigUpdatedAtIso: sameInstant,
            localDeviceId: "device-A"
        )
        // 设备 B 看到的远端是 A 写的
        let outcomeOnB = merge(
            local: localOnB,
            remoteConfig: RemoteConfigRecord(
                payload: ["unitSystem": .string("kg")],
                schemaVersion: localSchema,
                updatedAtIso: sameInstant,
                deviceId: "device-A"
            ),
            localConfigUpdatedAtIso: sameInstant,
            localDeviceId: "device-B"
        )

        XCTAssertEqual(
            outcomeOnA.mergedStorage["unitSystem"]?.asString,
            outcomeOnB.mergedStorage["unitSystem"]?.asString,
            "两台设备必须收敛到同一个值"
        )
        XCTAssertEqual(outcomeOnA.mergedStorage["unitSystem"]?.asString, "lb", "deviceId 大者胜")
    }

    func testKeyDeletedRemotelyDoesNotResurrectLocally() {
        // 用户在另一台设备上清掉了某个配置项。若只做「远端键覆盖本地」，本地残留的
        // 旧键会在每次同步后复活。
        let local = storage(history: [], config: [
            "unitSystem": .string("kg"),
            "oneTimeDayOverride": .object(["dayCode": .string("push")])
        ])
        let remote = RemoteConfigRecord(
            payload: ["schemaVersion": .int(Int64(localSchema)), "unitSystem": .string("kg")],
            schemaVersion: localSchema,
            updatedAtIso: "2026-06-01T00:00:00Z",
            deviceId: "device-B"
        )

        let outcome = merge(
            local: local, remoteConfig: remote,
            localConfigUpdatedAtIso: "2026-05-01T00:00:00Z"
        )

        XCTAssertNil(outcome.mergedStorage["oneTimeDayOverride"])
        XCTAssertTrue(outcome.didChangeLocal)
    }

    func testWinningRemoteConfigNeverTouchesHistory() {
        // 配置记录不承载 history。即使远端配置里混进了 history 键，也不得覆盖本地训练记录。
        let local = storage(history: [session("session-1", date: "2026-01-01")])
        let remote = RemoteConfigRecord(
            payload: [
                "schemaVersion": .int(Int64(localSchema)),
                "history": .array([]),
                "unitSystem": .string("lb")
            ],
            schemaVersion: localSchema,
            updatedAtIso: "2026-06-01T00:00:00Z",
            deviceId: "device-B"
        )

        let outcome = merge(
            local: local, remoteConfig: remote,
            localConfigUpdatedAtIso: "2026-05-01T00:00:00Z"
        )

        XCTAssertEqual(historyIds(outcome.mergedStorage), ["session-1"], "训练记录不得被配置同步清空")
    }

    // MARK: 脏记录逐条隔离

    func testUncleanRemoteSessionIsQuarantinedWithoutBlockingGoodOnes() {
        // 这是同步最容易整体卡死的地方：写闸 gate 会因「新增条目过不了净化」拒绝
        // **整批**写入。若不逐条隔离，远端一条坏记录会让所有好记录陪葬，
        // 用户永远同步不上，而且从界面上看不出原因。
        let local = storage(history: [])
        let outcome = SyncMergeEngine.merge(
            localStorage: local,
            localSchemaVersion: localSchema,
            remoteSessions: [
                remoteSession("session-good-1", date: "2026-01-01"),
                remoteSession("session-bad", date: "2026-01-02"),
                remoteSession("session-good-2", date: "2026-01-03")
            ],
            remoteConfig: nil,
            localConfigUpdatedAtIso: "2026-01-01T00:00:00Z",
            localDeviceId: "device-A",
            isSessionAcceptable: { payload in
                payload["id"]?.asString != "session-bad"
            }
        )

        XCTAssertEqual(outcome.rejectedUncleanCount, 1)
        XCTAssertEqual(historyIds(outcome.mergedStorage), ["session-good-1", "session-good-2"])
        XCTAssertEqual(outcome.mergedSessionCount, 2)
        XCTAssertTrue(outcome.didChangeLocal, "好记录必须照常落地")
    }

    func testAllRemoteSessionsUncleanLeavesLocalUntouched() {
        let local = storage(history: [session("session-1", date: "2026-01-01")])
        let outcome = SyncMergeEngine.merge(
            localStorage: local,
            localSchemaVersion: localSchema,
            remoteSessions: [remoteSession("session-bad", date: "2026-01-02")],
            remoteConfig: nil,
            localConfigUpdatedAtIso: "2026-01-01T00:00:00Z",
            localDeviceId: "device-A",
            isSessionAcceptable: { _ in false }
        )

        XCTAssertEqual(outcome.rejectedUncleanCount, 1)
        XCTAssertFalse(outcome.didChangeLocal)
        XCTAssertEqual(outcome.mergedStorage, local)
    }

    // MARK: 幂等

    func testMergingTwiceIsIdempotent() {
        let local = storage(history: [session("session-1", date: "2026-01-01")])
        let remotes = [remoteSession("session-2", date: "2026-02-01")]

        let first = merge(local: local, remoteSessions: remotes)
        let second = merge(local: first.mergedStorage, remoteSessions: remotes)

        XCTAssertTrue(first.didChangeLocal)
        XCTAssertFalse(second.didChangeLocal, "第二次合并不应再产生变化")
        XCTAssertEqual(first.mergedStorage, second.mergedStorage)
    }
}
