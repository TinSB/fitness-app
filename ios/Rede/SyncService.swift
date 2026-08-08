// SyncService — 云同步在 App 层的编排者（FR-ACC1）。
//
// 三层职责在这里汇合，各自不越界：
//   · RedeSync          纯函数合并，不认识网络也不认识磁盘
//   · RedeSyncSupabase  网络与认证，不认识 canonical
//   · 本文件            把两者接到 SessionStore 的写闸上，并向 UI 暴露如实状态
//
// 不变量（归档里写死的，改这里前先读 docs/CLOUD_DECISIONS_ARCHIVE.md）：
//   ① 本地是真相 —— 同步失败、登录失效、版本不匹配时 App 照常可用
//   ② 登出不删本地训练数据
//   ③ 绝不假装成功 —— 有记录没同步上就不显示「一致」

import Foundation
import RedeDomain
import RedePersistence
import RedeSync
import RedeSyncSupabase

// MARK: - canonical 桥接

/// SyncLocalStore 的 App 实现：读走 JSONFileAppDataStore，写**必须**走 SessionStore
/// 的写闸（含 DataHealth 校验与备份）。同步不是特权写入。
///
/// 游标与配置上传时刻存 UserDefaults 而非 canonical：它们是可重建的同步元数据，
/// 丢了最多多拉一次，没有理由挤进训练数据的写闸和备份链。
/// UserDefaults 官方保证线程安全，只是没有标 Sendable。包一层把这个事实说清楚，
/// 而不是给整个 AppSyncLocalStore 打 @unchecked —— 那会连带掩盖将来真正不安全的字段。
struct SendableDefaults: @unchecked Sendable {
    let inner: UserDefaults
    init(_ inner: UserDefaults) { self.inner = inner }
}

struct AppSyncLocalStore: SyncLocalStore {
    let fileURL: URL
    let defaultsBox: SendableDefaults
    private var defaults: UserDefaults { defaultsBox.inner }
    /// 写回 canonical 的动作。名字刻意不叫 applyMerged —— 与协议方法同名会让
    /// 方法体里的调用解析回它自己，变成无限递归。
    let writeMerged: @Sendable ([String: JSONValue]) async -> Bool

    private var cursorKey: String { "sync.cursor" }
    private var configUploadedKey: String { "sync.configUploadedAt" }
    private var configTouchedKey: String { "sync.configTouchedAt" }

    func loadStorage() async throws -> (storage: [String: JSONValue], schemaVersion: Int) {
        let store = JSONFileAppDataStore(fileURL: fileURL)
        let current = try store.load()
        let storage = current?.storage ?? [
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "history": .array([]),
        ]
        return (storage, SchemaVersion.current)
    }

    func applyMerged(_ storage: [String: JSONValue]) async throws {
        guard await writeMerged(storage) else {
            throw SyncLocalStoreError.writeRejected
        }
    }

    func loadCursor() async -> String? {
        defaults.string(forKey: cursorKey)
    }

    func saveCursor(_ cursor: String?) async {
        if let cursor {
            defaults.set(cursor, forKey: cursorKey)
        } else {
            defaults.removeObject(forKey: cursorKey)
        }
    }

    func configUpdatedAtIso() async -> String {
        // 没记录过本地配置改动时刻时返回纪元起点 —— LWW 里它永远输给远端，
        // 这是安全方向：宁可不覆盖别人的配置，也不要用一个凭空的「现在」压过去。
        defaults.string(forKey: configTouchedKey) ?? "1970-01-01T00:00:00Z"
    }

    func markConfigUploaded(at iso: String) async {
        defaults.set(iso, forKey: configUploadedKey)
        defaults.set(iso, forKey: configTouchedKey)
    }
}

enum SyncLocalStoreError: Error {
    case writeRejected
}

/// SessionStore 的延迟持有者。
///
/// 存在的理由：SyncService 必须在 app 级构造并注入 environment（自动同步的两个时机
/// 都在同步页之外），但 environment 放不了 Optional；而 AppSyncLocalStore 的写闭包
/// 又要在 init 里就绑好。用这个 holder 让服务先建起来、稍后 attach，全 app 只有
/// 一个实例——同步页与自动同步共用同一份状态。
final class SessionStoreHolder: @unchecked Sendable {
    weak var store: SessionStore?
}

// MARK: - 设备标识

enum SyncDeviceIdentity {
    private static let key = "sync.deviceId"

    /// 稳定的本机标识，用于 LWW 平局的确定性决胜。
    ///
    /// 不用 identifierForVendor：它在用户删掉 App 后重装会变，而我们要的恰恰是
    /// 「这台设备」的稳定身份。UserDefaults 里的 UUID 生命周期与安装一致，足够，
    /// 而且它不是标识符追踪——只在两条记录时间戳完全相同时用来打破平局。
    static func current(defaults: UserDefaults = .standard) -> String {
        if let existing = defaults.string(forKey: key), !existing.isEmpty { return existing }
        let fresh = "device-\(UUID().uuidString)"
        defaults.set(fresh, forKey: key)
        return fresh
    }
}

// MARK: - 对 UI 的门面

@MainActor
@Observable
final class SyncService {
    /// 未登录时为 nil。UI 据此决定显示开启页还是状态页。
    private(set) var isSignedIn = false
    private(set) var isSyncing = false
    /// 最近一次同步的如实结果。nil = 本次启动还没同步过。
    private(set) var lastReport: SyncReport?
    private(set) var lastSyncedAt: Date?
    /// 同步失败的如实呈现；nil = 无错误。与训练/设置错误面隔离。
    private(set) var errorText: String?
    /// 云端与本机的记录数，供双端对照使用。云端数未知时为 nil（连不上就是不知道，
    /// 不能拿上次的数字冒充现在）。
    private(set) var localSessionCount = 0
    private(set) var remoteSessionCount: Int?

    private let auth: SupabaseAuth
    private let transport: SupabaseSyncTransport
    private let localStore: AppSyncLocalStore
    private let deviceId: String
    private let holder = SessionStoreHolder()

    /// 绑定写入目标。RootTabView 在 task 里调一次；未绑定时同步会如实失败而非静默成功。
    func attach(_ sessionStore: SessionStore) {
        holder.store = sessionStore
    }

    init(defaults: UserDefaults = .standard) {
        let http = URLSessionHTTPClient()
        let auth = SupabaseAuth(
            projectURL: SupabaseConfig.projectURL,
            apiKey: SupabaseConfig.publishableKey,
            http: http,
            store: KeychainSessionStore()
        )
        self.auth = auth
        self.transport = SupabaseSyncTransport(
            projectURL: SupabaseConfig.projectURL,
            apiKey: SupabaseConfig.publishableKey,
            http: http,
            auth: auth
        )
        self.deviceId = SyncDeviceIdentity.current(defaults: defaults)
        let holder = self.holder
        self.localStore = AppSyncLocalStore(
            fileURL: TodayModel.canonicalFileURL(),
            defaultsBox: SendableDefaults(defaults),
            writeMerged: { storage in
                guard let store = holder.store else { return false }
                return await store.applySyncMerge(mergedStorage: storage)
            }
        )
    }

    func refreshSignedInState() async {
        isSignedIn = await auth.isSignedIn
        if let loaded = try? await localStore.loadStorage() {
            localSessionCount = loaded.storage["history"]?.asArray?.count ?? 0
        }
    }

    /// Sign in with Apple 成功后调用，随即做一次完整同步（本机数据静默推上去）。
    func signIn(identityToken: String, rawNonce: String?) async {
        errorText = nil
        do {
            _ = try await auth.signInWithApple(identityToken: identityToken, rawNonce: rawNonce)
            isSignedIn = true
            await syncNow()
        } catch {
            errorText = Self.describe(error)
        }
    }

    func syncNow() async {
        guard !isSyncing, isSignedIn else { return }
        isSyncing = true
        defer { isSyncing = false }
        errorText = nil

        let coordinator = SyncCoordinator(
            transport: transport,
            localStore: localStore,
            deviceId: deviceId,
            isSessionAcceptable: { payload in
                // 与写闸 gate 同源的判断：过不了净化的远端记录必须逐条隔离，
                // 否则一条坏记录会让整批写入被拒、好记录跟着陪葬。
                TrainingSession(storage: payload).id?.isEmpty == false
            },
            now: { ISO8601DateFormatter().string(from: Date()) }
        )
        do {
            let report = try await coordinator.syncOnce()
            lastReport = report
            lastSyncedAt = Date()
            await refreshSignedInState()
            // 云端条数：一轮成功同步之后，本地已含全部能读的远端记录、且本地独有的
            // 也已上传——两边差的正好是「读不了的那些」。blocked（对方版本更新）与
            // rejected（记录损坏）都是**在云端存在但没进本地**的，所以加回去。
            // 这是推算不是查询，但它只在同步成功后成立，且每一项都有来源，不是编的。
            remoteSessionCount = localSessionCount + report.blockedByNewerSchema + report.rejectedUncleanCount
        } catch {
            errorText = Self.describe(error)
            // 失败时把云端数清成未知。留着上一次的数字会让对照器显示一个
            // 早已过期的「一致」——连不上就是不知道，不能拿旧数冒充现在。
            remoteSessionCount = nil
        }
    }

    /// 登出。**只断开云端关联，本机训练数据一行不动。**
    func signOut() async {
        await auth.signOut()
        isSignedIn = false
        lastReport = nil
        remoteSessionCount = nil
        await localStore.saveCursor(nil)
    }

    /// 删除云端账号。本机记录保留 —— 与登出同样的不变量。
    func deleteCloudAccount() async -> Bool {
        errorText = nil
        do {
            try await auth.deleteAccount()
            isSignedIn = false
            lastReport = nil
            remoteSessionCount = nil
            await localStore.saveCursor(nil)
            return true
        } catch {
            errorText = Self.describe(error)
            return false
        }
    }

    /// 把后端错误翻译成用户能读懂、且不吓人的话。
    /// 结构固定为「发生了什么 + 你还能用什么」，与既有失败文案一致。
    static func describe(_ error: Error) -> String {
        switch error {
        case SyncTransportError.offline, SupabaseAuthError.offline:
            return "暂时连不上云端　本机训练记录不受影响"
        case SyncTransportError.notAuthenticated, SupabaseAuthError.notSignedIn:
            return "登录已失效　重新登录后继续同步　本机记录保留"
        case SyncTransportError.rejected(let m), SupabaseAuthError.rejected(let m):
            return "云端拒绝了这次同步　\(m)"
        case SyncTransportError.malformedResponse(let m):
            return "云端返回了预期外的数据　\(m)"
        default:
            return String(describing: error)
        }
    }
}
