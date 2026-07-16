// RestLiveActivity — K6 休息计时 Live Activity（2026-07-16）。
//
// 锁屏 + 灵动岛渲染休息倒计时：Text(timerInterval:) / ProgressView(timerInterval:)
// 系统原生自更新（零推送零轮询）。extension 零业务计算——只渲染 app 传入的静态属性
//（动作名/目标串）与休息起止时刻（master §12 同姿态：派生展示、绝不写 canonical、
// 不是真相源）。
// 视觉（2026-07-16 质感批定稿）：锻铁暗底 + ember 单焦点=倒计时（数字 + 其图形化身
// 进度环/条），其余 t1/t3；胶囊左环右数、expanded/锁屏带 4pt 细进度条；isStale 全灰化。
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
            // 锁屏面：动作名 + 下一组目标 + 原生倒计时 + 细进度条
            //（离线渲染定稿：行间 12 / 垂直 padding 14——加条后保持呼吸感）
            VStack(spacing: 12) {
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
                RestProgressBar(state: context.state, isStale: context.isStale)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
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
                    // Bug 修复（owner 真机 1.7(24)）：两 region 默认顶对齐、内容偏上——
                    // 撑满高度垂直居中，左块与右侧倒计时同轴心。
                    .frame(maxHeight: .infinity, alignment: .leading)
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: Self.timerRange(context.state), countsDown: true)
                        .font(.system(size: 28, weight: .semibold))
                        .monospacedDigit()
                        .multilineTextAlignment(.trailing)
                        .foregroundStyle(context.isStale ? RestPalette.t3 : RestPalette.ember)
                        .frame(maxWidth: 84, maxHeight: .infinity, alignment: .trailing)
                        .padding(.trailing, 4)
                }
                // bottom：细线性进度条（克制，无文字；边距 4 与上排文字对齐，离线渲染定稿）
                DynamicIslandExpandedRegion(.bottom) {
                    RestProgressBar(state: context.state, isStale: context.isStale)
                        .padding(.horizontal, 4)
                        .padding(.top, 8)
                }
            } compactLeading: {
                // 静态灰 timer 图标 → ember 环形进度（系统自驱动，苹果自家计时器同语言）。
                // 环=倒计时的图形化身，与右侧数字同为一个焦点，不破「橙=唯一焦点」纪律。
                RestProgressRing(state: context.state, isStale: context.isStale)
            } compactTrailing: {
                Text(timerInterval: Self.timerRange(context.state), countsDown: true)
                    .font(.system(size: 13, weight: .medium))
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(context.isStale ? RestPalette.t3 : RestPalette.ember)
                    // Bug 修复（owner 真机 1.7(24)）：Text(timerInterval:) 理想宽度按最坏
                    // 计时串贪婪测量，maxWidth 约束不了它——超出 compactTrailing 宽度预算时
                    // 系统整个丢弃该视图（胶囊右侧空白）。固定宽度绕开贪婪测量；40pt 实测
                    // 覆盖 MM:SS（37.3pt @13pt medium monospacedDigit），宁大勿裁。
                    .frame(width: 40, alignment: .trailing)
            } minimal: {
                // minimal 无数字可显——环形进度作倒计时唯一代理（有进度信息优于纯图标；
                // 离线渲染密度评估：环内嵌小图标太糊，纯环胜出）
                RestProgressRing(state: context.state, isStale: context.isStale)
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

    /// 进度区间（起点→终点，进度环/条共用分母）。同 timerRange 的防呆姿态：
    /// 起点晚于终点（异常数据）时给零长区间，不给倒挂区间。
    fileprivate static func progressRange(_ state: RestActivityAttributes.ContentState) -> ClosedRange<Date> {
        let end = state.restEndsAt
        return min(state.restStartedAt, end)...end
    }
}

/// 细线性进度条（锁屏 + expanded bottom 共用）：ProgressView(timerInterval:) 系统
/// 自驱动（零推送零轮询，与倒计时数字同机制）。ember 填充 + t3 低透明轨道 ~4pt；
/// countsDown 随时间消耗（与训练页 restFraction 剩余口径一致）；+30 保留起点 →
/// 进度按新总长诚实重算。isStale 退 t3（灰化全家桶，不许橙色假活）。
private struct RestProgressBar: View {
    let state: RestActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        ZStack {
            // t3 低透明轨道（系统 linear 样式轨道色不可定制——垫底成 t3 色调）
            Capsule()
                .fill(RestPalette.t3.opacity(0.25))
                .frame(height: 4)
            ProgressView(
                timerInterval: RestLiveActivity.progressRange(state),
                countsDown: true,
                label: { EmptyView() },
                currentValueLabel: { EmptyView() }
            )
            .progressViewStyle(.linear)
            .tint(isStale ? RestPalette.t3 : RestPalette.ember)
        }
    }
}

/// 环形进度（compactLeading + minimal 共用）：同上系统自驱动，苹果自家计时器
/// 灵动岛同款语言。isStale 退 t3。
private struct RestProgressRing: View {
    let state: RestActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        ProgressView(
            timerInterval: RestLiveActivity.progressRange(state),
            countsDown: true,
            label: { EmptyView() },
            currentValueLabel: { EmptyView() }
        )
        .progressViewStyle(.circular)
        .tint(isStale ? RestPalette.t3 : RestPalette.ember)
    }
}
