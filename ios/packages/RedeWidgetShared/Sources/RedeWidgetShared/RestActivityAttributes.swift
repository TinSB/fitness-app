// RestActivityAttributes — K6 休息计时 Live Activity（2026-07-16）。
//
// app 与 widget extension 共享的 ActivityKit 合同：静态属性 = 动作名 + 下一组目标串
//（app 侧用 LoadDisplay/RedeL10n 格式化后传入，extension 零业务计算、只渲染传入值）；
// 动态 ContentState = restEndsAt 墙钟结束时刻（extension 用 Text(timerInterval:)
// 原生倒计时，零推送零轮询自更新；+30/继续由 app 侧 update 推进结束点）。
//
// 职责边界（裁定 1）：Live Activity 是**视觉层**（锁屏/灵动岛看倒计时）；到点提醒
// 仍由 G1 休息通知（RestNotificationPolicy）负责——本表面不发声不通知，两者并存
// 不重复。派生展示、绝不写 canonical、不是真相源（master §12 同姿态）。
// `#if os(iOS)`：host `swift test` 工具链不编译（同 AppGroupWidgetSnapshotStore）。

#if os(iOS)
import ActivityKit
import Foundation

public struct RestActivityAttributes: ActivityAttributes, Equatable {
    public struct ContentState: Codable, Hashable {
        /// 休息结束的墙钟时刻（与 SessionStore.restCountdown 锚点同源）。
        public let restEndsAt: Date

        public init(restEndsAt: Date) {
            self.restEndsAt = restEndsAt
        }
    }

    /// 动作名（app 侧已按目录 + 语言本地化；「下一组」所属动作）。
    public let exerciseName: String
    /// 下一组目标串（如「60 kg × 5」；app 侧已档位吸附 + 单位格式化）。
    public let targetLine: String

    public init(exerciseName: String, targetLine: String) {
        self.exerciseName = exerciseName
        self.targetLine = targetLine
    }
}
#endif
