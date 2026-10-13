import SwiftUI

// Forged Graphite + Emberline — 2026-08-07 换代后，App 代码（本文件）是视觉真源。
// docs/rede-prototypes/ 内的 HTML 是 2026-06/07 的历史设计稿，不再作为取值依据。
//
// 2026-08-07 配色修订：面与文字的**饱和度**从 17% 压到 6%，色相仍留在 30–40°（暖）。
// 原因：owner 判旧配色「土、像儿童玩具」——根因是那 17% 的黄褐糊在整个画面上，
// 不是暖调本身。压掉饱和后暖只剩底味，ember 因此立得住。
// 试过冷调石墨（#0B0D12，223°）方向，更"科技"但离「锻造 + 余烬」的品牌意象远了，
// 且对已上架用户是断裂式变化，故未采用。
// ember 同步从 #E1652B（施工橙，饱和 76%）沉到 #C85A2E（铜/余烬，饱和 63%）。
// Ember 只表示「下一步 / 当前动作」;主按钮为锻面 + ember 左缘,不用 ember 填充。

extension Color {
    init(redeHex hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    // 面
    static let redeBase = Color(redeHex: 0x131211)      // --base
    static let redeSurface = Color(redeHex: 0x1D1B19)   // --surface
    static let redeRaised = Color(redeHex: 0x232120)    // --raised
    static let redeHair = Color(redeHex: 0x2A2724)      // --hair
    static let redeHair2 = Color(redeHex: 0x222020)     // --hair2
    /// 输入框等浅内陷面（现用点：同步页邮箱框）。分段控件曾借这个色做「槽底」——
    /// 2026-08-09 比稿后分段控件已无槽，不要再往这个方向复用（见 SegControl 头注）。
    static let redeSegBase = Color(redeHex: 0x1A1917)
    static let redeEtch = Color(redeHex: 0x333029)      // S2 刻线（rede-app.html .etick）

    // 文字
    static let redeT1 = Color(redeHex: 0xE9E6E1)
    static let redeT2 = Color(redeHex: 0xC2BFB9)
    static let redeT3 = Color(redeHex: 0x948F87)
    static let redeT4 = Color(redeHex: 0x8A857E)

    // 品牌与语义
    // ⚠️ 色值有三份本地副本：本文件、ios/RedeWatch/WatchTheme.swift 的 WatchPalette、
    // ios/RedeWidget/RestLiveActivity.swift 的 WidgetPalette。extension 无共享 token 包，改值三处同改。
    static let redeEmber = Color(redeHex: 0xC85A2E)
    static let redeEmber2 = Color(redeHex: 0xE0855C)
    static let redeRec = Color(redeHex: 0x2F7D5B)
    static let redeRec2 = Color(redeHex: 0x56B083)
    static let redeCaution = Color(redeHex: 0xC79A3A)
    static let redeRisk = Color(redeHex: 0xC2413A)

    // 控件
    static let redeSteel = Color(redeHex: 0x8C8884)     // --steel 次级控件
    static let redeNeu = Color(redeHex: 0x4A463F)       // --neu 中性数据条
    static let redeGroove = Color(redeHex: 0x1F1D1A)    // 进度/休息条凹槽底（替代裸 hex，统一轨道色）
    static let redeRegMark = Color(redeHex: 0x5F5B52)   // 角标 registration
}

// 字阶(rede-app.html type scale)。tracking = em × size;行高用 lineSpacing 逐处贴齐。
// Dynamic Type（NFR-7，Task 3 2026-07-04）：每档锚定语义相近的系统 text style，用
// UIFontMetrics 缩放**尺寸数值**后仍走 Font.system——保住 .weight()/.monospacedDigit()
// 等既有派生用法（Font(UIFont) 包装会让这些修饰符失效）。默认档 scaledValue 恒等、
// 逐点不变。RedeTracking 常量保持固定——tracking 是品牌雕刻感、非可读性参数，不随
// 档位缩放（有意取舍，防过度工程）。档位读取发生在 body 求值时（computed var）；
// 运行中改系统字号在重进页面/重启后生效——MVP 基线的如实边界。另两条已知边界
// （审查留痕 2026-07-04）：① scaledValue 读进程级全局档位，不感知某子树用
// .environment(\.sizeCategory) 的局部覆盖（当前全库无此用法）；② 勿把 .redeX
// 缓存进 let 常量复用——会固化取值时的档位，请始终在 view body 里直接引用。
extension Font {
    /// 按系统文字样式缩放一个基准字号。LoadCluster 等「字号由调用方传入」的组件也走这里，
    /// 与 .redeX 同一套 UIFontMetrics 缩放（NFR-7）。
    static func redeScaled(_ base: CGFloat, _ style: UIFont.TextStyle) -> CGFloat {
        UIFontMetrics(forTextStyle: style).scaledValue(for: base)
    }
    static var redeDisplay: Font { .system(size: redeScaled(54, .largeTitle), weight: .bold) }     // lh 1, -0.02em
    static var redeTitle: Font { .system(size: redeScaled(29, .title1), weight: .bold) }           // lh 1, -0.01em
    static var redeHeadline: Font { .system(size: redeScaled(22, .title3), weight: .semibold) }    // lh 1.3, -0.01em
    static var redeSubhead: Font { .system(size: redeScaled(16, .headline), weight: .semibold) }   // lh 1.25
    static var redeBody: Font { .system(size: redeScaled(14, .body), weight: .regular) }           // 450≈regular, lh 1.45
    static var redeCallout: Font { .system(size: redeScaled(13, .callout), weight: .regular) }     // lh 1.4
    static var redeCaption: Font { .system(size: redeScaled(12, .caption1), weight: .regular) }
    static var redeOverline: Font { .system(size: redeScaled(11, .caption2), weight: .medium) }    // +0.18em uppercase
}

enum RedeSpace {
    static let page: CGFloat = 20      // 页边距
    static let section: CGFloat = 24   // 区块间
    static let card: CGFloat = 16      // 卡内
    /// 以 44pt 命中高的列表行收尾时，末行文字下方带的不可见留白（≈11pt）。
    /// 分隔线要扣掉它，上下留白才近似等距（进展页 RuleDivider(topInset:)、设置页 EngraveDivider(above:) 同引）。
    static let rowTrailingInset: CGFloat = 11
    /// 单选题卡（引导 / 设置单题编辑）的左内距额外让位：OnbOptionRows 整组向左外挂 14（钢色缘 2 + 内距 12），
    /// 题卡左内距 = 卡内距 + 这个量，选中缘才不贴卡边。
    static let optionRowHang: CGFloat = 13
    /// 底栏避让由悬浮标尺 tab bar 的实际高度和内容呼吸推导，改 tab bar 几何会自动跟上。
    static let bottomBar = RedeTabBarMetrics.height + RedeTabBarMetrics.contentClearance
    /// 悬浮主 CTA（FloatingPrimaryCTA：今日 / 训练待机的「开始训练」）本体高度 = 上边距 + 按钮高。
    /// 撤销条等要让位于 CTA 的浮层引用它，不再各写各的魔数。
    static let floatingCTATop: CGFloat = 10
    static let floatingCTA: CGFloat = floatingCTATop + RedeShape.primaryButtonHeight
    /// 页面内容侧给悬浮 CTA 留的静态底部留白 = tab bar 避让 + CTA 本体 + 14 呼吸。
    /// 不用 safeAreaInset（带条件内容首帧 inset 为 0，model 到位后不重算）。
    static let floatingCTAContentInset = bottomBar + floatingCTA + 14
}

enum RedeShape {
    static let cardRadius: CGFloat = 12
    /// S1 基准（2026-08-06）：列表/内容卡的新默认圆角。大圆角是 iOS 26 的语气，
    /// 也让卡片读起来更像一块实体而非一个框。展开态用 cardRadiusXL。
    static let cardRadiusL: CGFloat = 20
    static let cardRadiusXL: CGFloat = 30
    static let buttonRadius: CGFloat = 10
    static let steelRadius: CGFloat = 8
    static let controlHeight: CGFloat = 44
    /// 主 CTA（EmbButton 默认）高度。
    static let primaryButtonHeight: CGFloat = 50
    /// 裸药丸选中键的视觉高度（命中区仍是 controlHeight）。进展页 SegControl 与计划页日选药丸共用，
    /// 同色同圆角的同类控件不再各写各的。
    static let segmentKeyHeight: CGFloat = 28
}

enum RedeTabBarMetrics {
    static let topInset: CGFloat = 8
    static let controlHeight = RedeShape.controlHeight
    static let iconSlotHeight: CGFloat = 22
    static let rulerHeight: CGFloat = 15
    static let bottomInset: CGFloat = 12
    static let cornerRadius: CGFloat = 22
    static let contentClearance: CGFloat = 14
    static let height = topInset + controlHeight + rulerHeight + bottomInset
}

enum RedeTracking {
    static let overline: CGFloat = 11 * 0.18           // 1.98
    static let display: CGFloat = 54 * -0.02
    static let title: CGFloat = 29 * -0.01
    static let headline: CGFloat = 22 * -0.01
}
