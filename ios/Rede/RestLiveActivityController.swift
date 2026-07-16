// RestLiveActivityController — K6 休息计时 Live Activity 的 app 侧管理器（2026-07-16）。
//
// 职责边界（裁定 1）：Live Activity 是**视觉层**（锁屏/灵动岛看倒计时）；到点提醒仍由
// G1 休息通知（scheduleRestNotification）负责——本控制器不发声不排通知，两者并存不重复。
// 挂接点 = SessionStore 的 restCountdown.begin/clear 既有接线（不改 RestCountdown 本体、
// 不碰 App Group 快照管线）。不建 app 内开关（裁定 2）：iOS 系统设置已有 per-app
// Live Activities 开关，这里用 ActivityAuthorizationInfo().areActivitiesEnabled 守门。
//
// 序列化：ActivityKit 的 request/update/end 全是 async——所有操作排进单条 Task 链，
// 保证「启动清理 → begin → update → end」端点顺序不竞态（乱序会 end 掉新活动或复活旧的）。
// App 杀前无可靠钩子：staleDate 让系统把孤儿活动标陈旧，下次启动 endAll 清理兜底
//（训练异常中断路径）。
//
// 探针（审计通道）：os.Logger 记各端点，`log stream --predicate 'subsystem ==
// "com.tinsab.rede"'` 可见；只记端点名，不含用户数据明细。

import ActivityKit
import Foundation
import os
import RedeWidgetShared

@MainActor
final class RestLiveActivityController {
    private let logger = Logger(subsystem: "com.tinsab.rede", category: "RestLiveActivity")
    /// 串行链（同 draftTask 的取代式思路，但这里要保序不取消）：每个操作接在前一个之后。
    private var chain: Task<Void, Never> = Task {}

    private func enqueue(_ op: @escaping @Sendable () async -> Void) {
        let previous = chain
        chain = Task {
            await previous.value
            await op()
        }
    }

    /// 休息开始/恢复（restCountdown.begin 挂点）：已有同属性活动 → 只 update 结束时刻；
    /// 属性变了（新动作/新目标）→ 收旧起新（ActivityAttributes 不可变）。系统关掉
    /// Live Activities 时静默跳过——视觉层缺席不阻塞训练。
    func begin(attributes: RestActivityAttributes, endsAt: Date, endpoint: String) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            logger.log("rest-live-activity skip(disabled) endpoint=\(endpoint, privacy: .public)")
            return
        }
        logger.log("rest-live-activity start endpoint=\(endpoint, privacy: .public)")
        // 进度起点 = 挂点当下（begin 调用时刻，与休息锚点同拍；恢复路径即恢复时刻）。
        // 在 enqueue 外捕获——链上排队的延迟不改变锚定语义。
        let startedAt = Date()
        enqueue { [logger] in
            let content = ActivityContent(
                state: RestActivityAttributes.ContentState(restStartedAt: startedAt, restEndsAt: endsAt),
                staleDate: endsAt.addingTimeInterval(60)
            )
            let existing = Activity<RestActivityAttributes>.activities
            if let match = existing.first(where: { $0.attributes == attributes }) {
                await match.update(content)
                // 同类型其余活动（异常残留）一并收掉——同屏只该有一个休息倒计时
                for other in existing where other.id != match.id {
                    await other.end(nil, dismissalPolicy: .immediate)
                }
                return
            }
            for stale in existing {
                await stale.end(nil, dismissalPolicy: .immediate)
            }
            do {
                _ = try Activity<RestActivityAttributes>.request(
                    attributes: attributes, content: content, pushType: nil)
            } catch {
                // 系统拒绝（频率/权限翻转等）：如实留探针，不重试不阻塞训练
                logger.log("rest-live-activity request-failed: \(String(describing: error), privacy: .public)")
            }
        }
    }

    /// 结束时刻变更（+30 加时挂点；运行中才调，暂停走 end/begin 对）。无活动时不起新的。
    /// 保留原 restStartedAt（从 activity.content.state 读回）——进度按新总时长诚实
    /// 重算回落，不重置不闪（换锚点会让进度环/条跳回全满，假装刚开始休息）。
    func updateEnd(endsAt: Date, endpoint: String) {
        logger.log("rest-live-activity update endpoint=\(endpoint, privacy: .public)")
        enqueue {
            for activity in Activity<RestActivityAttributes>.activities {
                let content = ActivityContent(
                    state: RestActivityAttributes.ContentState(
                        restStartedAt: activity.content.state.restStartedAt,
                        restEndsAt: endsAt
                    ),
                    staleDate: endsAt.addingTimeInterval(60)
                )
                await activity.update(content)
            }
        }
    }

    /// 结束（restCountdown.clear 挂点全覆盖：休息结束/记组推进/训练收尾与放弃/
    /// 新会话起步/暂停/启动清理）。幂等——无活动时无操作。
    func end(endpoint: String) {
        logger.log("rest-live-activity end endpoint=\(endpoint, privacy: .public)")
        enqueue {
            for activity in Activity<RestActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}
