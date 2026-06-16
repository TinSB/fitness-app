import SwiftUI

// Forged Graphite + Emberline — token 与字阶按 docs/rede-prototypes/rede-app.html 精确提取。
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
    static let redeBase = Color(redeHex: 0x15130F)      // --base
    static let redeSurface = Color(redeHex: 0x1F1C17)   // --surface
    static let redeRaised = Color(redeHex: 0x262219)    // --raised
    static let redeBtn = Color(redeHex: 0x211E18)       // --btn 锻面按钮底
    static let redeHair = Color(redeHex: 0x2A261F)      // --hair
    static let redeHair2 = Color(redeHex: 0x221F1B)     // --hair2
    static let redeTabBar = Color(redeHex: 0x100E0B)    // tab bar 底
    static let redeSegBase = Color(redeHex: 0x1A1712)   // 分段控件底
    static let redeEtch = Color(redeHex: 0x2E2A22)      // S2 刻线（rede-app.html .etick）

    // 文字
    static let redeT1 = Color(redeHex: 0xECE6D8)
    static let redeT2 = Color(redeHex: 0xC9C2B4)
    static let redeT3 = Color(redeHex: 0x9C9484)
    static let redeT4 = Color(redeHex: 0x908A7C)

    // 品牌与语义
    static let redeEmber = Color(redeHex: 0xE1652B)
    static let redeEmber2 = Color(redeHex: 0xF0875A)
    static let redeRec = Color(redeHex: 0x2F7D5B)
    static let redeRec2 = Color(redeHex: 0x56B083)
    static let redeCaution = Color(redeHex: 0xC79A3A)
    static let redeRisk = Color(redeHex: 0xC2413A)

    // 控件
    static let redeSteel = Color(redeHex: 0x8C8A86)     // --steel 次级控件
    static let redeNeu = Color(redeHex: 0x4A453B)       // --neu 中性数据条
    static let redeGroove = Color(redeHex: 0x231F19)    // 进度/休息条凹槽底（替代裸 hex，统一轨道色）
    static let redeRegMark = Color(redeHex: 0x5F594C)   // 角标 registration
    static let redeNextDot = Color(redeHex: 0x3A352B)   // next 节点描边
}

// 字阶(rede-app.html type scale)。tracking = em × size;行高用 lineSpacing 逐处贴齐。
extension Font {
    static let redeDisplay = Font.system(size: 54, weight: .bold)     // lh 1, -0.02em
    static let redeTitle = Font.system(size: 29, weight: .bold)       // lh 1, -0.01em
    static let redeHeadline = Font.system(size: 22, weight: .semibold) // lh 1.3, -0.01em
    static let redeSubhead = Font.system(size: 16, weight: .semibold)  // lh 1.25
    static let redeBody = Font.system(size: 14, weight: .regular)      // 450≈regular, lh 1.45
    static let redeCallout = Font.system(size: 13, weight: .regular)   // lh 1.4
    static let redeCaption = Font.system(size: 12, weight: .regular)
    static let redeOverline = Font.system(size: 11, weight: .medium)   // +0.18em uppercase
}

enum RedeSpace {
    static let page: CGFloat = 20      // 页边距
    static let section: CGFloat = 24   // 区块间
    static let card: CGFloat = 16      // 卡内
    static let group: CGFloat = 8      // 组内
}

enum RedeShape {
    static let cardRadius: CGFloat = 12
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
