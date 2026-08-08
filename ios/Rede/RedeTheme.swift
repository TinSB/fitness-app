import SwiftUI

// Forged Graphite + Emberline — token 与字阶按 docs/rede-prototypes/rede-app.html 精确提取。
//
// 2026-08-07 配色修订：面与文字的**饱和度**从 17% 压到 6%，色相仍留在 30–40°（暖）。
// 原因：owner 判旧配色「土、像儿童玩具」——根因是那 17% 的黄褐糊在整个画面上，
// 不是暖调本身。压掉饱和后暖只剩底味，ember 因此立得住。
// 试过冷调石墨（#0B0D12，223°）方向，更"科技"但离「锻造 + 余烬」的品牌意象远了，
// 且对已上架用户是断裂式变化，故未采用。
// ember 同步从 #E1652B（施工橙，饱和 76%）沉到 #C85A2E（铜/余烬，饱和 63%）。
// 原型为最新设计真相(含 D-A/D-B):与设计语言文档取值不一致处以原型为准。
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
    static let redeBtn = Color(redeHex: 0x1F1D1B)       // --btn 锻面按钮底
    static let redeHair = Color(redeHex: 0x2A2724)      // --hair
    static let redeHair2 = Color(redeHex: 0x222020)     // --hair2
    static let redeTabBar = Color(redeHex: 0x111010)    // tab bar 底
    static let redeSegBase = Color(redeHex: 0x1A1917)   // 分段控件底
    static let redeEtch = Color(redeHex: 0x333029)      // S2 刻线（rede-app.html .etick）

    // 文字
    static let redeT1 = Color(redeHex: 0xE9E6E1)
    static let redeT2 = Color(redeHex: 0xC2BFB9)
    static let redeT3 = Color(redeHex: 0x948F87)
    static let redeT4 = Color(redeHex: 0x8A857E)

    // 品牌与语义
    // ⚠️ ember/base/T1/T3 在 ios/RedeWidget/RestLiveActivity.swift 的 RestPalette 有
    // 本地副本（extension 无共享 token 包）——改值时两处同改（K6 审查留痕）。
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
    static let redeNextDot = Color(redeHex: 0x373430)   // next 节点描边
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
    private static func redeScaled(_ base: CGFloat, _ style: UIFont.TextStyle) -> CGFloat {
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
    static let group: CGFloat = 8      // 组内
    /// 底栏避让。2026-08-07 tab bar 改悬浮标尺后整体变高（8 + 44 + 15 刻度 + 12 离底 ≈ 79），
    /// 78 已不够——固定元素（如今日页悬浮 CTA）会贴到 tab bar 上。留 14 的呼吸。
    static let bottomBar: CGFloat = 93
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
}

enum RedeTracking {
    static let overline: CGFloat = 11 * 0.18           // 1.98
    static let display: CGFloat = 54 * -0.02
    static let title: CGFloat = 29 * -0.01
    static let headline: CGFloat = 22 * -0.01
}
