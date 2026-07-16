// RestLiveActivity — K6 休息计时 Live Activity（2026-07-16）。
//
// 锁屏 + 灵动岛渲染休息倒计时：Text(timerInterval:) 系统原生自更新（零推送零轮询）。
// extension 零业务计算——只渲染 app 传入的静态属性（动作名/目标串）与结束时刻
//（master §12 同姿态：派生展示、绝不写 canonical、不是真相源）。
// 视觉：锻铁暗底 + ember 只标倒计时数字（下一步语义成立，品牌一致）；
// 零营销文案零 wordmark（纯数据）。到点提醒归 G1 休息通知，本表面不发声（裁定 1）。

import ActivityKit
import SwiftUI
import WidgetKit
import RedeWidgetShared

/// 品牌色本地副本（extension 不编 app target 的 RedeTheme.swift；hex 与其同值——
/// base 0x15130F / T1 0xECE6D8 / T3 0x9C9484 / ember 0xE1652B）。
private // ⚠️ 品牌色本地副本（extension 无共享色 token 包）——四值必须与
// ios/Rede/RedeTheme.swift 逐值一致；改 ember/基色时两处同改（审查 NIT 漂移风险留痕）。
enum RestPalette {
    private static func hex(_ value: UInt32) -> Color {
        Color(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }

    static let base = hex(0x15130F)
    static let t1 = hex(0xECE6D8)
    static let t3 = hex(0x9C9484)
    static let ember = hex(0xE1652B)
}

struct RestLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            // 锁屏面：动作名 + 下一组目标 + 原生倒计时
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(context.attributes.exerciseName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(RestPalette.t1)
                        .lineLimit(1)
                    Text(context.attributes.targetLine)
                        .font(.system(size: 13))
                        .monospacedDigit()
                        .foregroundStyle(RestPalette.t3)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Text(timerInterval: Self.timerRange(context.state), countsDown: true)
                    .font(.system(size: 36, weight: .semibold))
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    // 陈旧态灰化（审查 NIT：后台自然到点后系统只标 stale 不撤显——
                    // 0:00 滞留期不再用 ember 冒充「活着的下一步」）
                    .foregroundStyle(context.isStale ? RestPalette.t3 : RestPalette.ember)
                    .frame(maxWidth: 120)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .activityBackgroundTint(RestPalette.base)
            .activitySystemActionForegroundColor(RestPalette.t1)
        } dynamicIsland: { context in
            DynamicIsland {
                // expanded：动作 + 目标（左）· 倒计时（右）
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.exerciseName)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(RestPalette.t1)
                            .lineLimit(1)
                        Text(context.attributes.targetLine)
                            .font(.system(size: 12))
                            .monospacedDigit()
                            .foregroundStyle(RestPalette.t3)
                            .lineLimit(1)
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: Self.timerRange(context.state), countsDown: true)
                        .font(.system(size: 28, weight: .semibold))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .foregroundStyle(RestPalette.ember)
                        .frame(maxWidth: 84)
                        .padding(.trailing, 4)
                }
            } compactLeading: {
                // 图标中性（审查 NIT：compact 同屏 ember 只留倒计时数字——「橙=唯一焦点」）
                Image(systemName: "timer")
                    .foregroundStyle(RestPalette.t3)
            } compactTrailing: {
                Text(timerInterval: Self.timerRange(context.state), countsDown: true)
                    .font(.system(size: 13, weight: .medium))
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(RestPalette.ember)
                    .frame(maxWidth: 44)
            } minimal: {
                // minimal 无数字可显——ember 图标作倒计时唯一代理（有意保留，非双焦点）
                Image(systemName: "timer")
                    .foregroundStyle(RestPalette.ember)
            }
            .keylineTint(RestPalette.ember)
        }
    }

    /// 渲染安全：结束时刻已过仍收到渲染请求时给零长区间（显示 0:00），不给倒挂区间
    ///（纯渲染防呆，非业务计算）。
    private static func timerRange(_ state: RestActivityAttributes.ContentState) -> ClosedRange<Date> {
        let end = state.restEndsAt
        return min(Date(), end)...end
    }
}
