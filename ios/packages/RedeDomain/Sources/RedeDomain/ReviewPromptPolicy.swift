// ReviewPromptPolicy — 决定「何时」向用户请求 App Store 评分的纯逻辑。
//
// 放在 RedeDomain 因为它是无依赖的取值逻辑（不含 StoreKit / SwiftUI），且必须用
// `swift test` 单测——App 壳没有测试 target。副作用归 App 壳：读完成场次数与当前
// 版本、持久化「上次请求的版本」、调用 StoreKit 的 requestReview；本类型只回答
// 「现在该不该问」。
//
// 策略取舍：
//  - 绝不问刚装的新用户。只有在用户已获得价值——至少 `minimumCompletedSessions`
//    次完成训练——且在最高满意度时刻（刚保存完一次训练）才问。
//  - 每个 App 版本最多问一次。已在当前版本被问过的用户不再重复弹；发新版本后重新
//    有资格（新改进 = 值得再问一次）。Apple 另会把系统弹窗限制为每 365 天最多 3 次，
//    本策略是在其之上更保守的自我节流。

import Foundation

public struct ReviewPromptPolicy {
    /// 首次允许弹评分前，需要的最少完成训练场次。
    public let minimumCompletedSessions: Int

    public init(minimumCompletedSessions: Int = 3) {
        self.minimumCompletedSessions = max(1, minimumCompletedSessions)
    }

    /// 现在是否应请求评分。
    /// - Parameters:
    ///   - completedSessionCount: App 观察到的累计完成训练场次。
    ///   - lastRequestedVersion: 上次请求评分时的 App 版本（CFBundleShortVersionString），
    ///     从未请求过则为 `nil`。
    ///   - currentVersion: 当前运行的 App 版本（CFBundleShortVersionString）。
    /// - Returns: 仅当达到价值阈值 **且** 尚未在 `currentVersion` 上问过时返回 `true`。
    public func shouldRequestReview(
        completedSessionCount: Int,
        lastRequestedVersion: String?,
        currentVersion: String
    ) -> Bool {
        guard completedSessionCount >= minimumCompletedSessions else { return false }
        // 防御：版本号读取失败（空串）时绝不弹——宁可不问，也不在未知状态下打扰用户。
        guard !currentVersion.isEmpty else { return false }
        return lastRequestedVersion != currentVersion
    }
}
