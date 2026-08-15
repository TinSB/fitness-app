import SwiftUI
import WatchKit

// 表侧视觉基底（v3，2026-08-15）。
//
// owner 判 v2「太常规，就几个大按钮」。v2 用的是 watchOS 库存件：灰底圆角瓦片 + 橙色实心胶囊——
// 那正是设计语言明令禁止的两样东西（整面板公理 §12.1「通用圆角描边框，禁」；Ember 公理
// 「锻面 + ember 左缘，禁 ember 填充」）。表不是另一个 app，它是**同一件锻铁仪器的表盘**：
// 一块连续的锻面，数字直接蚀刻在上面，唯一的橙色是那条指向下一步的 Emberline。
//
// 三条从手机原样带过来的纪律：
// · 橙色只表示下一步：当前组的改动、刻度轨指针、主操作的一条边、休息倒计时（Live Activity
//   §7.1 同款 scoped 豁免）。不做背景、不做描边框、不做成功色。
// · 层级靠字阶 + 亮度，分区靠刻线，控件是工艺件（刻度轨站点 / 机加工圆钮 / 锻面主按钮）
//   或文字级操作。
// · 陈旧态全灰化：倒计时停在 0:00 等手机时，数字与环退 T3，不许橙色假活。
//
// ⚠️ 色值与 ios/Rede/RedeTheme.swift、ios/RedeWidget/RestLiveActivity.swift 的 RestPalette
// 是三份本地副本（extension / watch target 无共享 token 包）——改值三处同改。
enum WatchPalette {
    private static func hex(_ value: UInt32) -> Color {
        Color(.sRGB,
              red: Double((value >> 16) & 0xFF) / 255,
              green: Double((value >> 8) & 0xFF) / 255,
              blue: Double(value & 0xFF) / 255)
    }

    // 面
    static let base = hex(0x131211)
    static let raised = hex(0x232120)      // 锻面按钮底
    static let hair = hex(0x2A2724)        // 轮廓
    static let etch = hex(0x333029)        // S2 刻线（刻度轨轨道）
    // 文字
    static let t1 = hex(0xE9E6E1)
    static let t2 = hex(0xC2BFB9)
    static let t3 = hex(0x948F87)
    static let t4 = hex(0x8A857E)
    // 品牌
    static let ember = hex(0xC85A2E)
    static let ember2 = hex(0xE0855C)
    static let steel = hex(0x8C8884)
}

/// 表盘尺寸缩放。40mm（162pt 宽）是最小表盘，字号按它定基准；更大的表盘按宽度等比放大
///（46mm = 208pt → 1.28 倍），到 1.3 封顶。按宽度算而不是按机型枚举——新机型出来不用改；
/// 也不用 Dynamic Type：训练时这几个数字就该是「屏幕允许的最大」，不随系统字号缩小。
enum WatchMetrics {
    static let scale: CGFloat = min(1.3, max(1, WKInterfaceDevice.current().screenBounds.width / 162))
    /// 记组屏主数字（重量）。40mm 是 32，往上不等比、放得更快（32 → 46）：
    /// 大表盘多出来的高度全给主读数——它是这一屏两米外要看清的东西。
    static var hero: CGFloat { (32 + (scale - 1) * 50).rounded() }
    /// 记组屏次数字（次数 / RIR），比主读数矮一档（22 → 29）。
    static var secondary: CGFloat { (22 + (scale - 1) * 25).rounded() }
    /// 记组屏动作名
    static var title: CGFloat { min(17, (14 * scale).rounded()) }
    /// 休息倒计时（环内）
    static var clock: CGFloat { (24 * scale).rounded() }
    /// 休息进度环直径。40mm 74 → 46mm 88（不等比：环再大按钮就放不下）。
    static var ring: CGFloat { (74 + (scale - 1) * 50).rounded() }
    static var ringStroke: CGFloat { scale > 1.15 ? 7 : 6 }
    /// 主按钮高度
    static var buttonHeight: CGFloat { (38 * scale).rounded() }
    /// 机加工圆钮直径
    static var roundButton: CGFloat { (38 * scale).rounded() }
    /// 进度行 / 休息标题 / 「下一组」预览这类辅助小字
    static var meta: CGFloat { min(13, (11 * scale).rounded()) }
    /// 仪表小标签（值下面的说明）
    static var caption: CGFloat { min(11, (9 * scale).rounded()) }
    /// 仪表标签字距（设计语言 §11.3：instrument overline ~2.2；表上字小，取 1.4）
    static let captionTracking: CGFloat = 1.4
}

// MARK: - 按压反馈（与手机 RedePressableStyle 同一套：降亮 + 微缩）

struct WatchPressableStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var scale: CGFloat = 0.97
    var dim: Double = 0.55

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? dim : 1)
            // 关动效时只降亮、不缩放（设计语言 §14.1）；降亮本身不算 motion。
            .scaleEffect(configuration.isPressed && !reduceMotion ? scale : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// 表侧动效口径，与手机同一套数字（§14.3）：
/// · morph = 屏间原地变形（记组 ⇄ 休息 ⇄ 热身、清单 ⇄ 训练）：0.22s easeInOut，透明度 + 0.98 缩放
/// · caret = 刻度轨指针在读数间滑动：0.2s easeOut（手机刻度轨指针同款）
/// · 一切位移 / 缩放过 reduceMotion 守卫，关则退化为纯透明度或直接切换
enum WatchMotion {
    static let morph: Animation = .easeInOut(duration: 0.22)
    static let caret: Animation = .easeOut(duration: 0.2)
    static let tint: Animation = .easeOut(duration: 0.18)

    /// 屏间 morph 的转场：关动效时只淡入淡出。
    static func morphTransition(reduceMotion: Bool) -> AnyTransition {
        reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.98))
    }
}

extension ButtonStyle where Self == WatchPressableStyle {
    static var watchPressable: WatchPressableStyle { WatchPressableStyle() }
    /// 文字级操作：只降亮、不缩放。
    static var watchPressableText: WatchPressableStyle { WatchPressableStyle(scale: 1, dim: 0.6) }
}

// MARK: - 锻面主按钮（与手机 EmbButton 同一件：锻面底 + hair 轮廓 + 3pt ember 左缘，禁 ember 填充）

struct EmbWatchButton: View {
    let icon: String?
    let title: String
    var enabled = true
    let action: () -> Void

    /// 点击计数——驱动图标的一次性弹跳（symbolEffect 需要一个变化的值做触发）。
    /// 与手机 EmbButton 同款：主 CTA 的图标在按下时弹一下，是动作确认的最短反馈，
    /// 比整块按钮变色克制。reduceMotion 由系统自动降级。
    @State private var tapTick = 0

    var body: some View {
        Button(action: { tapTick += 1; action() }) {
            HStack(spacing: 6) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                        .symbolEffect(.bounce, options: .nonRepeating, value: tapTick)
                }
                Text(verbatim: title)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .foregroundStyle(WatchPalette.t1)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: WatchMetrics.buttonHeight)
            .background(WatchPalette.raised)
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(WatchPalette.hair, lineWidth: 1))
            .overlay(alignment: .leading) { Rectangle().fill(WatchPalette.ember).frame(width: 3) }
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.watchPressable)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.45)
        .animation(WatchMotion.tint, value: enabled)
    }
}

// MARK: - 机加工圆钮（休息屏 +30 / 下一组）：锻面圆底 + 轮廓；主动作的轮廓是 ember 缘

struct MachinedRoundButton<Label: View>: View {
    var primary = false
    var enabled = true
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            label()
                .foregroundStyle(WatchPalette.t1)
                .frame(width: WatchMetrics.roundButton, height: WatchMetrics.roundButton)
                .background(Circle().fill(WatchPalette.raised))
                .overlay(Circle().stroke(primary ? WatchPalette.ember : WatchPalette.hair,
                                         lineWidth: primary ? 1.5 : 1))
                .contentShape(Circle())
        }
        .buttonStyle(.watchPressable)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.45)
        .animation(WatchMotion.tint, value: enabled)
    }
}

// MARK: - 刻度轨指针（与手机快改刻度轨的 ember 指针同形：小三角 + 短柄）

struct RailCaret: View {
    var body: some View {
        VStack(spacing: 0) {
            RailCaretTriangle().fill(WatchPalette.ember).frame(width: 7, height: 5)
            Rectangle().fill(WatchPalette.ember).frame(width: 2, height: 5)
        }
    }
}

struct RailCaretTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

// MARK: - 组进度刻标：本动作每一组一格，做完 = 钢色，当前 = ember，未做 = 刻线色

struct SetMarks: View {
    let total: Int
    let current: Int   // 1-based

    var body: some View {
        HStack(spacing: 2) {
            ForEach(1...max(total, 1), id: \.self) { i in
                RoundedRectangle(cornerRadius: 1, style: .continuous)
                    .fill(i < current ? WatchPalette.steel : (i == current ? WatchPalette.ember : WatchPalette.etch))
                    .frame(width: 7, height: 3)
                    // 记完一组：当前格退钢色、下一格亮 ember——两格同拍换色，读作「推进了一格」。
                    .animation(WatchMotion.tint, value: current)
            }
        }
    }
}

// MARK: - 仪表标签：值下面的说明小字（大写 + 字距，设计语言 §11.3 instrument overline）

struct InstrumentCaption: View {
    let text: String
    var uppercase = true

    var body: some View {
        Text(verbatim: text)
            .textCase(uppercase ? .uppercase : nil)
            .font(.system(size: WatchMetrics.caption, weight: .medium))
            .tracking(WatchMetrics.captionTracking)
            .foregroundStyle(WatchPalette.t3)
            .lineLimit(1).minimumScaleFactor(0.7)
    }
}
