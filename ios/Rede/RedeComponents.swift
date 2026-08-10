import SwiftUI
import RedeL10n
import RedeTrainingDecision

// 签名组件 — 按 docs/rede-prototypes/rede-app.html 的 .ov/.forged/.embar/.reg/.emb/.btn2/.ring/.rule/.tb/.seg/.tg 复原。

// MARK: - 显示层重量吸附（系统逻辑 §6.0.1 + 内容系统 §8「显示吸附契约」）
//
// 复发根因：旧代码显示层裸换算（formatKg ×2.2046、kg 裸显 double）→ kg 格子 30kg 在 lb 显
// 66lb（配不出）、lb 输入存奇数 kg 切回显长小数。契约：**任何「可配重量」显示都必须先吸附到
// 「器械×当前显示单位」真实梯子最近格**，再交 RedeL10n 格式化。禁止裸换算。
// 只吸附「用户实际要配上器械的重量」（目标/上次/刻度轨/组重）；e1RM、总吨位等估算值不吸附。
enum LoadDisplay {
    private static func loadUnit(_ s: RedeStrings) -> LoadUnit { LoadUnit(unitSystem: s.unit.rawValue) }

    /// 吸附到「器械×显示单位」真实梯子的 kg 值——交给 formatKg/heroNumber/railValue 等的 weightKg 实参。
    /// 格子器械经 LoadGrid.gridEquipment 映射（bodyweight-plus→barbell），与快改档位口径一致。
    static func snap(_ weightKg: Double, loadType: String, equipment: String, _ s: RedeStrings) -> Double {
        LoadGrid.snapKg(weightKg, equipment: LoadGrid.gridEquipment(loadType: loadType, equipment: equipment), unit: loadUnit(s))
    }

    /// 便捷：按 loadType+器械吸附 + formatKg = 直接出显示字符串（处方显示最常用）。
    static func weight(_ weightKg: Double, loadType: String, equipment: String, _ s: RedeStrings) -> String {
        s.formatKg(snap(weightKg, loadType: loadType, equipment: equipment, s))
    }

    /// 历史/进展/训练流：按 exerciseId 回目录查 loadType+器械再吸附（缺→external/dumbbell 兜底）。
    /// 经 loadType 故 bodyweight-plus 也正确落 barbell 外加负重格。
    static func snap(_ weightKg: Double, exerciseId: String, _ s: RedeStrings,
                     catalog: ExerciseCatalog = .minimal) -> Double {
        let entry = catalog.entry(id: exerciseId)
        return snap(weightKg, loadType: entry?.loadType ?? "external", equipment: entry?.equipment ?? "dumbbell", s)
    }

    /// 便捷（历史）：按 exerciseId 吸附 + formatKg。
    static func weight(_ weightKg: Double, exerciseId: String, _ s: RedeStrings,
                       catalog: ExerciseCatalog = .minimal) -> String {
        s.formatKg(snap(weightKg, exerciseId: exerciseId, s, catalog: catalog))
    }
}

// MARK: - Overline(.ov: 11/500/+0.18em/uppercase)

struct Overline: View {
    let text: String
    var color: Color = .redeT4

    var body: some View {
        // 用 .textCase 而非 text.uppercased()：视觉同为大写，但 VoiceOver 读原文（不逐字母拼读）。
        Text(text)
            .textCase(.uppercase)
            .font(.redeOverline)
            .tracking(RedeTracking.overline)
            .foregroundStyle(color)
    }
}

// MARK: - 锻面颗粒(.forged::after 噪声,~1.5% 可见度)

struct ForgedGrain: View {
    /// 材质走向。噪点是各向同性的「砂面」；拉丝有方向，读起来才是**被加工过的金属**。
    /// 竞品参照：Fitbod 的深色底带对角织理——有方向的纹理比纯噪点更像材料、更少像杂讯。
    enum Texture { case noise, brushed, diagonal }

    /// 0.5 ≈ 卡面 1.5%（K2 锁定）；base 全屏用 0.33 ≈ 1%（§12.2，真机 25% 亮度校准后定值）。
    var intensity: Double = 0.5
    var texture: Texture = Self.defaultTexture

    /// 默认对角拉丝（2026-08-07 定）。噪点是各向同性的砂面、更接近杂讯；
    /// 有走向的织理才读作「被加工过的金属」，也和 RegMark 的斜角标、EngraveDivider 的
    /// 刻度构成同一套加工面语言。
    ///
    /// ⚠️ **强度待真机校准**：噪点那档 1.5% 是真机 25% 亮度下校准过的定值，拉丝是新的、
    /// 只在模拟器上看过。健身房暗光 + OLED 会比模拟器明显，下次 TestFlight 需实看后再定。
    /// 调参钩子：-grainTexture noise|brushed|diagonal。
    static var defaultTexture: Texture {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-grainTexture"), args.indices.contains(i + 1)
        else { return .diagonal }
        switch args[i + 1] {
        case "noise": return .noise
        case "brushed": return .brushed
        default: return .diagonal
        }
    }

    var body: some View {
        Canvas { context, size in
            var seed: UInt64 = 0x9E3779B97F4A7C15
            func rand() -> Double {
                seed = seed &* 6364136223846793005 &+ 1442695040888963407
                return Double(seed >> 33) / Double(UInt64(1) << 31)
            }
            switch texture {
            case .noise:
                let step: CGFloat = 3
                var y: CGFloat = 0
                while y < size.height {
                    var x: CGFloat = 0
                    while x < size.width {
                        if rand() > 0.5 {
                            let gray = rand()
                            context.fill(
                                Path(CGRect(x: x, y: y, width: 1, height: 1)),
                                with: .color(Color(white: gray, opacity: 0.03))
                            )
                        }
                        x += step
                    }
                    y += step
                }

            case .brushed:
                // 水平拉丝：断续的细线段，长短与亮度都抖动——连续等长会读成扫描线。
                var y: CGFloat = 0
                while y < size.height {
                    var x: CGFloat = -10
                    while x < size.width {
                        let len = 10 + rand() * 30
                        if rand() > 0.40 {
                            context.fill(
                                Path(CGRect(x: x, y: y, width: len, height: 0.7)),
                                with: .color(Color(white: 0.5 + rand() * 0.5,
                                                   opacity: 0.010 + rand() * 0.018))
                            )
                        }
                        x += len + 2 + rand() * 6
                    }
                    y += 2.2
                }

            case .diagonal:
                // 对角拉丝（约 −18°）：更有动势，同样断续抖动。
                let slope: CGFloat = -0.32
                var y: CGFloat = -size.width * 0.35
                while y < size.height + size.width * 0.35 {
                    var x: CGFloat = -10
                    while x < size.width {
                        let len = 12 + rand() * 34
                        if rand() > 0.44 {
                            var path = Path()
                            path.move(to: CGPoint(x: x, y: y))
                            path.addLine(to: CGPoint(x: x + len, y: y + len * slope))
                            context.stroke(
                                path,
                                with: .color(Color(white: 0.5 + rand() * 0.5,
                                                   opacity: 0.010 + rand() * 0.018)),
                                lineWidth: 0.7
                            )
                        }
                        x += len + 3 + rand() * 7
                    }
                    y += 2.4
                }
            }
        }
        .opacity(intensity)
        .allowsHitTesting(false)
    }
}

// MARK: - Registration 角标(.reg 11×11 刻线)

enum RegCorner { case topRight, topLeft, bottomRight }

struct RegMark: View {
    let corner: RegCorner

    var body: some View {
        Path { p in
            switch corner {
            case .topRight:
                p.move(to: CGPoint(x: 2, y: 0))
                p.addLine(to: CGPoint(x: 11, y: 0))
                p.addLine(to: CGPoint(x: 11, y: 9))
            case .topLeft:
                p.move(to: CGPoint(x: 0, y: 9))
                p.addLine(to: CGPoint(x: 0, y: 0))
                p.addLine(to: CGPoint(x: 9, y: 0))
            case .bottomRight:
                p.move(to: CGPoint(x: 0, y: 11))
                p.addLine(to: CGPoint(x: 11, y: 11))
                p.addLine(to: CGPoint(x: 11, y: 2))
            }
        }
        .stroke(Color.redeRegMark, lineWidth: 1)
        .frame(width: 11, height: 11)
        .allowsHitTesting(false)
    }
}

// MARK: - 锻面卡(.forged: 微渐变面 + 20r + 顶缘高光 + 颗粒)
//
// S1 改造（2026-08-06 基准 docs/工作记录/2026-08-06-motion-typography-baseline.md）：
// ① 面从纯色改为极微弱垂直渐变——纯色在深色下读作「贴上去的纸」，渐变才有厚度；
// ② 圆角 12 → 20（owner「再来点圆角」），`radius` 可覆盖，展开态用 30；
// ③ 顶缘高光从整条实线改为两端淡出的渐变描边——实线在大圆角上会在转角处露出突兀的端点。
// 颗粒（ForgedGrain）与 ember bar 是既有资产，原样保留。

struct ForgedCard<Content: View>: View {
    var emberBarInset: CGFloat? = nil   // 非 nil = 带 embar(top/bottom inset)
    var showReg: Bool = false
    var radius: CGFloat = RedeShape.cardRadiusL
    @ViewBuilder var content: Content

    var body: some View {
        ZStack(alignment: .topLeading) {
            content
            ForgedGrain()
            if let inset = emberBarInset {
                VStack { Spacer(minLength: 0) }
                    .frame(width: 2)
                    .frame(maxHeight: .infinity)
                    .background(Color.redeEmber)
                    .clipShape(RoundedRectangle(cornerRadius: 2))
                    .padding(.vertical, max(inset, radius * 0.62))
                    // 圆角越大，贴边的竖条被切得越狠——按半径内缩，让它落在直边段内。
                    .padding(.leading, radius * 0.30)
            }
            if showReg {
                RegMark(corner: .topRight)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(max(11, radius * 0.52))
            }
        }
        .background(
            LinearGradient(colors: [Color.redeRaised, Color.redeSurface],
                           startPoint: .top, endPoint: .bottom)
        )
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [Color.redeT1.opacity(0.085), Color.redeT1.opacity(0.012)],
                        startPoint: .top, endPoint: .bottom),
                    lineWidth: 1)
        )
    }
}

// MARK: - 数值簇(.load: 数值大 / 单位小 / 次数中——凡出现数字处统一走这里)
//
// 基准第二条：`37.5 kg × 6` 整串同字号会退化成一个「标签」。拆开才有数据的重心。
// 规则一以贯之：**数值大、单位小、标签最小**。

struct LoadCluster: View {
    var prefix: String? = nil    // "辅助" / "负重"
    var value: String? = nil     // "37.5"；自重/弹力带为 nil
    var unit: String? = nil      // "kg"
    var tail: String? = nil      // "× 6"
    var size: CGFloat = 19       // 数值字号；hero 用 30
    /// 自重/弹力带只有 "× 6"，此时把次数升格成主数值——否则整行只剩一个小字。
    private var repsIsPrimary: Bool { value == nil }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            if let prefix {
                Text("\(prefix) ")
                    .font(.system(size: size * 0.63, weight: .medium))
                    .foregroundStyle(Color.redeT3)
            }
            if let value {
                Text(value)
                    .font(.system(size: size, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT1)
            }
            if let unit {
                Text(" \(unit)")
                    .font(.system(size: size * 0.47, weight: .regular))
                    .foregroundStyle(Color.redeT4)
            }
            if let tail {
                Text(value == nil ? tail : "  \(tail)")
                    .font(.system(size: repsIsPrimary ? size : size * 0.63,
                                  weight: repsIsPrimary ? .semibold : .medium))
                    .monospacedDigit()
                    .foregroundStyle(repsIsPrimary ? Color.redeT1 : Color.redeT3)
            }
        }
    }
}

// MARK: - 读数列(.stat: 标签 + 数值，横排成一把尺子)
//
// 基准巧思一：把「3 组 · 休息 150s · RIR 2」这串文字拆成并列读数。
// 工程感来自结构，不是装饰。数值与 LoadCluster 同源（数值大、单位小）。

struct StatColumn: Identifiable {
    let id = UUID()
    let label: String            // "组数"
    let value: String            // "150"
    var unit: String? = nil      // "s"
}

struct StatStrip: View {
    let columns: [StatColumn]
    var valueSize: CGFloat = 25

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(columns) { col in
                VStack(alignment: .leading, spacing: 6) {
                    Text(col.label)
                        .font(.system(size: 10, weight: .medium))
                        .tracking(1.6)
                        .foregroundStyle(Color.redeT4.opacity(0.9))
                    HStack(alignment: .firstTextBaseline, spacing: 1) {
                        Text(col.value)
                            .font(.system(size: valueSize, weight: .medium, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(Color.redeT1)
                        if let unit = col.unit {
                            Text(unit)
                                .font(.system(size: valueSize * 0.52, weight: .regular, design: .rounded))
                                .foregroundStyle(Color.redeT4)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - 工序列表(.cues: 01/02/03 序号 + 正文)
//
// 基准巧思二：`·` 只说明「这是一条」，序号说明「这是第几步」——技术要点本就有先后，
// 且可指认（"第二点没做到"）。序号压到极暗，只在余光里起编排作用。

struct CueList: View {
    let items: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, text in
                HStack(alignment: .top, spacing: 13) {
                    Text(String(format: "%02d", i + 1))
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.redeT4.opacity(0.75))
                        .padding(.top, 3)
                        .accessibilityHidden(true)   // 序号是排版，不念给 VoiceOver
                    Text(text)
                        .font(.system(size: 14.5))
                        .lineSpacing(4)
                        .foregroundStyle(Color.redeT2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 连续变形展开层(.morph: 卡片就地长大成详情)
//
// 基准（docs/工作记录/2026-08-06-motion-typography-baseline.md 第一节）：
// 一体感 = 同一元素连续变形，不是「一个淡出、一个淡入」。
//
// **为什么不用 .sheet**：sheet 是独立呈现上下文，会盖住整个 App、读作「进入新页面」；
// 页内 overlay 才读作「我还在这一页、只是把这张卡打开了」。
//
// **为什么不用 matchedGeometryEffect**：它的语义是「一个视图提供几何、其余采用」。
// 这里源（列表行）与目标（展开卡）必须共存且结构完全不同——无论谁当 source，
// 另一边要么被锁死在错误尺寸、要么完全没有动画。改用宿主上报行位置 + 锚点缩放
// （见 RowFramePreference 与调用方的 expandAnchor）。
//
// 代价（有意接受）：overlay 只覆盖宿主视图，盖不住 RootTabView 的 tab bar。
// 这反而贴合「我还在这一页、只是展开了一张卡」的心智——不是进入新页面。
// 遮罩因此也止于 tab bar 上沿，不做假的全屏黑幕。

struct MorphExpansion<Content: View>: View {
    var topInset: CGFloat = 92
    let onDismiss: () -> Void
    @ViewBuilder var content: Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dragOffset: CGFloat = 0

    var body: some View {
        ZStack(alignment: .top) {
            // 遮罩单独淡入。**不要**给整个展开层加 .transition(.opacity)——
            // 整块淡入会把 matchedGeometryEffect 的几何动画盖掉，读起来就是「突然冒出来」。
            Color.black.opacity(0.46)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture(perform: onDismiss)
                .transition(.opacity)
                .accessibilityLabel(Text(verbatim: ""))
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { onDismiss() }

            // 卡面直接用 ForgedCard——颗粒 / ember 左缘 / registration 角标都是既有品牌资产，
            // 不另起炉灶。装饰必须是**材质与结构性**的（锻面、刻线、定位标记），
            // 不是图形贴纸——后者正是 owner 判为廉价的那一类。
            ForgedCard(emberBarInset: 20, showReg: true, radius: RedeShape.cardRadiusXL) {
                VStack(spacing: 0) {
                    // 拖拽把手：下拉收起的手势**只落在这一条**上。
                    // 曾把 DragGesture 加在整张卡上——结果内容区的滚动被整个拦截，
                    // 向上滑变成了收起。手势区必须与滚动区分离。
                    Capsule()
                        .fill(Color.redeT4.opacity(0.34))
                        .frame(width: 38, height: 4)
                        .padding(.top, 12)
                        .padding(.bottom, 6)
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture()
                                .onChanged { v in
                                    guard !reduceMotion else { return }
                                    dragOffset = max(0, v.translation.height)
                                }
                                .onEnded { v in
                                    if v.translation.height > 70 || v.predictedEndTranslation.height > 180 {
                                        onDismiss()
                                    }
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.9)) { dragOffset = 0 }
                                }
                        )
                        .accessibilityHidden(true)

                    content
                        // 内容后于容器落位：容器先到，信息再淡入，避免文字跟着缩放变糊。
                        .transition(.opacity.combined(with: .offset(y: 12)))
                        .padding(.horizontal, 22)
                        .padding(.bottom, 20)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            // 再点一次即收起：点开与收起用同一个动作，不必去够空白处。
            // 卡内的按钮/链接（换回原动作、替代动作、查看来源）手势优先级更高会先吃掉点击；
            // 滚动是拖拽、不触发 tap。三者不冲突。
            .contentShape(RoundedRectangle(cornerRadius: RedeShape.cardRadiusXL, style: .continuous))
            .onTapGesture(perform: onDismiss)
            .shadow(color: .black.opacity(0.6), radius: 34, y: 16)
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, topInset)
            .padding(.bottom, RedeSpace.bottomBar)
            .offset(y: dragOffset)
        }
    }
}

// MARK: - 按压反馈样式（统一手感：按下降亮 + 轻微缩放，reduceMotion 守卫）
//
// 复发根因：全 app 可点元素用 `.buttonStyle(.plain)`，而 `.plain` **不给任何按下态**
// （无降亮、无缩放）——点下去画面纹丝不动，是 owner UX 反馈「手感生硬」的头号来源。
// 契约：常规可点元素（行/卡/按钮/控件）**默认**统一用本样式给即时视觉反馈。reduce-motion 下只降亮、
// 不缩放（动效守卫）。行/卡类用 `.redePressableRow`（不缩放——整行缩放会让边缘内拉、反显廉价）；
// 常规控件用 `.redePressable`。**豁免**（自带状态切换反馈，故不套本样式）：`SteelToggle`（滑块横移动画）、
// `RedeTabBar`（选中 ember 色 + 切换触感）。
struct RedePressableStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var scale: CGFloat = 0.97
    var dim: Double = 0.55

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? dim : 1)
            .scaleEffect(configuration.isPressed && !reduceMotion ? scale : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == RedePressableStyle {
    /// 常规控件按压反馈（降亮 + 微缩）。
    static var redePressable: RedePressableStyle { RedePressableStyle() }
    /// 行 / 卡按压反馈（只降亮、不缩放——整行缩放会让边缘内拉、显廉价）。
    static var redePressableRow: RedePressableStyle { RedePressableStyle(scale: 1, dim: 0.6) }
}

// MARK: - 主操作按钮(.emb: 锻面底 + ember 左缘,默认全宽)

struct EmbButton: View {
    let icon: String?
    let title: String
    var iconSize: CGFloat = 16
    var fontSize: CGFloat = 16
    /// 与其他控件并排的语境收回内容宽（唯一现用点：训练页休息条）；页面主 CTA 默认全宽。
    var hug: Bool = false
    let action: () -> Void

    // M1 提权（2026-07-06 去 AI 感中期批次）：主 CTA 曾 hug 半宽 + redeBtn 底与面板
    // 明度几乎无差，读作次级按钮。提权限 Ember 公理内（锻面 + ember 左缘，禁 ember
    // 填充）：默认全宽 + 底提亮一档（redeRaised）+ hair 轮廓 + 50pt + 3px 缘 + 16pt 字。
    /// 点击计数——驱动图标的一次性弹跳（symbolEffect 需要一个变化的值做触发）。
    @State private var tapTick = 0

    var body: some View {
        Button(action: {
            tapTick += 1
            action()
        }) {
            HStack(spacing: 7) {
                if let icon {
                    Image(systemName: icon).font(.system(size: iconSize))
                        // 主 CTA 的图标在按下时弹一下：动作确认的最短反馈，
                        // 比整块按钮变色克制。reduceMotion 由系统自动降级。
                        .symbolEffect(.bounce, options: .nonRepeating, value: tapTick)
                }
                Text(title)
            }
            .font(.system(size: fontSize, weight: .semibold))
            .foregroundStyle(Color.redeT1)
            .padding(.horizontal, 18)
            .frame(minHeight: 50)
            .frame(maxWidth: hug ? nil : .infinity)
            .background(Color.redeRaised)
            .clipShape(RoundedRectangle(cornerRadius: RedeShape.buttonRadius))
            .overlay(
                RoundedRectangle(cornerRadius: RedeShape.buttonRadius)
                    .stroke(Color.redeHair, lineWidth: 1)
            )
            .overlay(alignment: .leading) {
                Rectangle().fill(Color.redeEmber).frame(width: 3)
            }
            .clipShape(RoundedRectangle(cornerRadius: RedeShape.buttonRadius))
        }
        .buttonStyle(.redePressable)
    }
}

// MARK: - 次级按钮(.btn2: 钢色描边)

struct SteelButton: View {
    let title: String
    var icon: String? = nil
    var isOn: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon {
                    Image(systemName: icon).font(.system(size: 14))
                }
                Text(title)
            }
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(isOn ? Color.redeT1 : Color.redeT2)
            .padding(.horizontal, 13)
            .frame(minHeight: RedeShape.controlHeight)
            .background(isOn ? Color.redeSteel.opacity(0.16) : .clear)
            .overlay(
                RoundedRectangle(cornerRadius: RedeShape.steelRadius)
                    .stroke(Color.redeSteel, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: RedeShape.steelRadius))
        }
        .buttonStyle(.redePressable)
    }
}

// MARK: - Ring 节点(.ring: 扁平描环)

struct RingDot: View {
    var size: CGFloat = 14
    var fill: Color = .redeEmber

    var body: some View {
        Circle()
            .fill(fill)
            .frame(width: size, height: size)
            .overlay(
                Circle()
                    .stroke(Color.redeEmber.opacity(0.5), lineWidth: 2)
                    .padding(-2)
            )
    }
}

// MARK: - 刻线分隔(.rule)

struct RuleDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color.redeHair2)
            .frame(height: 1)
            .padding(.horizontal, RedeSpace.page)
            .padding(.vertical, RedeSpace.section / 2)
    }
}

// MARK: - 分段控件(.seg)

/// S2 刻线分组分隔（设置面板首用，rede-app.html .etick）：短竖刻线序列，两端略长收边。
struct EngraveDivider: View {
    var body: some View {
        HStack(spacing: 20) {
            ForEach(0..<9, id: \.self) { i in
                Rectangle()
                    .fill(Color.redeEtch)
                    .frame(width: 1, height: (i == 0 || i == 8) ? 9 : 6)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }
}

// 分段控件（rede-app.html .st-seg）：机加工凹槽轨 + 在槽里滑动的凸台键。
//
// 2026-08-09 质感重做（owner：「两个大按钮感觉有点丑」）。旧版三处问题：
//   ① **切换是硬切**——选中底色直接跳到另一格，没有任何位移，读起来像两个独立按钮
//      互相顶掉，而不是一个键在槽里滑。全仓 matchedGeometryEffect 用量此前为 0，这是第一处。
//   ② **「机加工」只是槽顶一条 1px 黑线**——那是记号，不是材质。真凹槽是上沿背光吃暗、
//      下唇接光吃亮；两条边一起才读得出深度。键那边同理：单一填色做不出「抬起来」，
//      要顶受光 + 底背光 + 下方投影三层。
//   ③ **控件高 50pt**（44 轨 + 3×2 内边），比 Apple 分段控件（32）高一半，所以显得笨重。
//      现在 painted 轨道 32、键 26，而**点击热区仍是 44**——轨道居中垫在 44 高的行里，
//      视觉收窄不牺牲可点性。
struct SegControl: View {
    let options: [String]
    @Binding var selection: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 每个 SegControl 实例各自的命名空间——同页多个控件的键不会互相吸附。
    @Namespace private var keySlot

    private let trackHeight: CGFloat = 32
    private let keyHeight: CGFloat = 26
    private let keyInset: CGFloat = 3
    private let trackRadius: CGFloat = 10
    private let keyRadius: CGFloat = 7.5

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.self) { option in
                segment(option)
            }
        }
        // 轨道垫在 44 高的行里居中：视觉 32、可点 44。
        .background { track.frame(height: trackHeight) }
    }

    private func segment(_ option: String) -> some View {
        let isOn = selection == option
        return Button {
            guard selection != option else { return }
            // 键滑过去，不是底色跳过去。reduceMotion 下退回瞬时（沿项目动效守卫约定）。
            // 注：调用方的 binding setter 若自己裹了 withAnimation（进展页尺度切换就是这样，
            // 用 easeInOut 0.22 驱动内容交叉淡入），那条曲线会覆盖这里的 spring——
            // 键与内容同步过渡，是那个页面想要的，不修正。
            withAnimation(reduceMotion ? nil : .spring(response: 0.30, dampingFraction: 0.86)) {
                selection = option
            }
        } label: {
            Text(option)
                .font(.system(size: 13, weight: isOn ? .semibold : .medium))
                .foregroundStyle(isOn ? Color.redeT1 : Color.redeT3)
                .frame(maxWidth: .infinity, minHeight: RedeShape.controlHeight)
                .background {
                    if isOn {
                        key
                            .padding(.horizontal, keyInset)
                            .frame(height: keyHeight)
                            .matchedGeometryEffect(id: "segKey", in: keySlot)
                    }
                }
                .contentShape(Rectangle()) // 透明区域也可点中（默认只命中不透明像素）
        }
        .buttonStyle(.redePressableRow)
    }

    /// 铣槽：上沿背光吃暗、下唇接光吃亮。
    private var track: some View {
        RoundedRectangle(cornerRadius: trackRadius, style: .continuous)
            .fill(Color.redeSegGroove)
            .overlay {
                RoundedRectangle(cornerRadius: trackRadius, style: .continuous)
                    .strokeBorder(
                        LinearGradient(
                            stops: [
                                .init(color: .black.opacity(0.55), location: 0),
                                .init(color: .black.opacity(0.10), location: 0.5),
                                .init(color: .white.opacity(0.07), location: 1),
                            ],
                            startPoint: .top, endPoint: .bottom
                        ),
                        lineWidth: 1
                    )
            }
    }

    /// 凸台键：顶受光 + 底背光 + 下方投影。
    private var key: some View {
        RoundedRectangle(cornerRadius: keyRadius, style: .continuous)
            .fill(
                LinearGradient(
                    colors: [Color.redeSegKeyHi, Color.redeSegKeyLo],
                    startPoint: .top, endPoint: .bottom
                )
            )
            .overlay {
                RoundedRectangle(cornerRadius: keyRadius, style: .continuous)
                    .strokeBorder(
                        LinearGradient(
                            colors: [.white.opacity(0.11), .white.opacity(0.015)],
                            startPoint: .top, endPoint: .bottom
                        ),
                        lineWidth: 1
                    )
            }
            .shadow(color: .black.opacity(0.5), radius: 2.5, y: 1.5)
    }
}

// MARK: - 开关(.tg: 钢色,40×24)

struct SteelToggle: View {
    @Binding var isOn: Bool

    var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) { isOn.toggle() }
        } label: {
            ZStack(alignment: isOn ? .trailing : .leading) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(isOn ? Color.redeSteel : Color.redeHair)
                    .frame(width: 40, height: 24)
                Circle()
                    .fill(Color.redeBase)
                    .frame(width: 20, height: 20)
                    .padding(2)
            }
            .frame(minWidth: RedeShape.controlHeight, minHeight: RedeShape.controlHeight)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 自定义 Tab Bar(.tb: h64 / #100E0B / 选中 ember)

struct RedeTabBar: View {
    @Binding var selection: RootTab
    @Environment(LocaleStore.self) private var localeStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var items: [(tab: RootTab, icon: String, label: String)] {
        let s = localeStore.strings
        return [
            (.today, "target", s.tabToday),
            (.train, "dumbbell", s.tabTrain),
            (.progress, "chart.bar", s.tabProgress),
            (.plan, "calendar", s.tabPlan),
        ]
    }

    private var selectedIndex: Int {
        items.firstIndex { $0.tab == selection } ?? 0
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(items, id: \.tab) { item in
                    Button {
                        withAnimation(reduceMotion ? nil : .spring(response: 0.34, dampingFraction: 0.82)) {
                            selection = item.tab
                        }
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: item.icon)
                                .font(.system(size: 21, weight: .medium))
                                .symbolRenderingMode(.monochrome)
                            Text(item.label).font(.system(size: 9.5, weight: .medium))
                        }
                        .foregroundStyle(selection == item.tab ? Color.redeEmber : Color.redeT4)
                        .frame(maxWidth: .infinity, minHeight: RedeShape.controlHeight)
                    }
                    .buttonStyle(.plain)
                    // VoiceOver：图标+文字合成一条原子标签，并报当前选中态（图标本身不单独念）
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(item.label)
                    .accessibilityAddTraits(selection == item.tab ? [.isButton, .isSelected] : .isButton)
                }
            }
            ruler
        }
        .padding(.top, 8)
        .background(
            ZStack {
                // 读 token，不硬编码——曾经写死过一组冷调色值，换主题时 tab bar 整块掉队。
                LinearGradient(colors: [Color.redeRaised, Color.redeSurface],
                               startPoint: .top, endPoint: .bottom)
                ForgedGrain(intensity: 0.4)
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(LinearGradient(
                    colors: [Color.redeT1.opacity(0.14), Color.redeT1.opacity(0.02), .clear],
                    startPoint: .top, endPoint: .bottom), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.6), radius: 17, y: 8)
        .padding(.horizontal, 14)
        .padding(.bottom, 12)
        .sensoryFeedback(.selection, trigger: selection) // tab 切换触觉确认
    }

    /// 行程标尺：主刻度对齐四个 tab 中心，之间夹次刻度；ember 游标压在当前位上。
    /// 切换时游标沿标尺滑过去——那一下滑动本身就是导航动效，不另加。
    private var ruler: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let slot = w / CGFloat(items.count)
            ZStack(alignment: .bottomLeading) {
                // 主刻度：严格落在每个 tab 的中心（与图标同一坐标系——曾给 ruler 单独加过
                // 水平 padding，槽宽跟 tabs 不一致，刻度就整体漂移了）。
                ForEach(0..<items.count, id: \.self) { i in
                    Rectangle()
                        .fill(Color.redeEtch)
                        .frame(width: 1, height: 8)
                        .offset(x: slot * (CGFloat(i) + 0.5) - 0.5, y: -5)
                }
                // 次刻度：相邻两个中心的中点
                ForEach(0..<(items.count - 1), id: \.self) { i in
                    Rectangle()
                        .fill(Color.redeEtch.opacity(0.55))
                        .frame(width: 1, height: 4)
                        .offset(x: slot * (CGFloat(i) + 1) - 0.5, y: -5)
                }
                Capsule()
                    .fill(Color.redeEmber)
                    .frame(width: 20, height: 2.5)
                    .offset(x: slot * (CGFloat(selectedIndex) + 0.5) - 10, y: -4)
            }
            .frame(width: w, height: geo.size.height, alignment: .bottomLeading)
        }
        .frame(height: 15)
        .accessibilityHidden(true)      // 纯装饰：选中态已由每个 tab 的 .isSelected 播报
    }
}

// MARK: - 页头(.hdr)

struct ScreenHeader: View {
    let title: String
    var subtitle: String? = nil
    var trailingIcon: String? = nil
    /// VoiceOver 标签（尾部图标按钮）——图标无文字，缺它只念「按钮」。
    var trailingAccessibilityLabel: String? = nil
    var onTrailingTap: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .foregroundStyle(Color.redeT1)
                if let subtitle {
                    Overline(text: subtitle)
                        .monospacedDigit()
                }
            }
            Spacer()
            if let trailingIcon {
                Button {
                    onTrailingTap?()
                } label: {
                    Image(systemName: trailingIcon)
                        .font(.system(size: 20))
                        .foregroundStyle(Color.redeT4)
                        .frame(minWidth: RedeShape.controlHeight, minHeight: RedeShape.controlHeight)
                }
                .buttonStyle(.redePressable)
                .disabled(onTrailingTap == nil)
                .accessibilityLabel(trailingAccessibilityLabel ?? "")
            }
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, 8)
    }
}

// MARK: - 品牌选择面板（替代 iOS 原生 confirmationDialog / actionSheet）
//
// 为什么有它：原生 action sheet 走系统字体+系统毛玻璃，跟 Rede「锻面/刻线」品牌语言不搭。
// 凡是「给我几个选项点一个」的决策（换一天练选日、单次/永久、换动作单次/永久）统一用这块品牌
// 底板：redeBase 底 + 拖拽条 + Overline 标题 + 44pt 动作行 + 发丝分隔 + ember 强调首要项 +
// redePressableRow 手感。沿用 TrainTabView 跳过/换动作面板已有的房屋样式，不再散落原生弹窗。

/// 一个可点选项：title 必填；subtitle 给后果说明（次行 redeT3）；emphasis=true 用 ember 强调首要项；
/// role=.destructive 用 redeRisk。点击执行 action（关闭由调用方在 action 里负责）。
struct RedeChoiceOption: Identifiable {
    let id = UUID()
    var title: String
    var subtitle: String? = nil
    var icon: String? = nil          // 前导 SF Symbol（nil = 无）
    var emphasis: Bool = false       // ember 强调（首要选项）
    var role: ButtonRole? = nil      // .destructive → redeRisk
    var action: () -> Void
}

/// 品牌选择面板：Overline 标题 + 可选说明 + 一列动作行 + 可选取消行。
/// 用法：`.sheet(isPresented:/item:) { RedeChoiceSheet(title:..., options:[...], cancelLabel: s.commonCancel) { 关闭 } }`
/// 自带 sheet 房屋样式（redeBase 背景 / 拖拽条 / 按内容估高的固定档），调用方只管给数据。
struct RedeChoiceSheet: View {
    let title: String
    var message: String? = nil
    let options: [RedeChoiceOption]
    var cancelLabel: String? = nil
    let onCancel: () -> Void   // 必填：cancelLabel 有值却忘了关闭逻辑是无声陷阱，故不给默认空实现

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Overline(text: title).padding(.top, 18)
            if let message {
                Text(message)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
            }
            VStack(spacing: 0) {
                // 按位置取 id（不用 element.id）：选项数组每次 body 重算都新建、UUID 会变，
                // 用 UUID 做 diff 会让 ForEach 每次父刷新都重建行；面板内选项不重排，位置即稳定 id。
                ForEach(Array(options.enumerated()), id: \.offset) { idx, opt in
                    optionRow(opt, divider: idx < options.count - 1)
                }
            }
            .padding(.top, 14)
            if let cancelLabel {
                EngraveDivider().padding(.vertical, 10)
                Button(action: onCancel) {
                    Text(cancelLabel)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT3)
                        .frame(maxWidth: .infinity, minHeight: RedeShape.controlHeight)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.redePressableRow)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, RedeSpace.page)
        .frame(maxWidth: .infinity, alignment: .leading)
        .presentationDetents([.height(estimatedHeight)])
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.redeBase)
    }

    // 按内容估高（房屋无「贴合内容」detent，沿用 moreSheet 固定档做法）：标题/说明/各行/取消 + 余量。
    // 留 dynamic type 余头并封顶，避免极端字号或多日序列把 sheet 顶穿。
    private var estimatedHeight: CGFloat {
        var h: CGFloat = 18 + 22                 // 顶距 + Overline
        if message != nil { h += 46 }
        h += 14
        for opt in options { h += opt.subtitle != nil ? 64 : 48 }
        if cancelLabel != nil { h += 20 + RedeShape.controlHeight }  // 刻线分隔 + 取消行
        h += 30                                  // 底部呼吸
        return min(max(h, 200), 560)
    }

    private func optionRow(_ opt: RedeChoiceOption, divider: Bool) -> some View {
        Button(action: opt.action) {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    if let icon = opt.icon {
                        Image(systemName: icon)
                            .font(.system(size: 15))
                            .foregroundStyle(tint(opt))
                            .frame(width: 22)
                            .accessibilityHidden(true)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(opt.title)
                            .font(.redeBody)
                            .foregroundStyle(tint(opt))
                        if let subtitle = opt.subtitle {
                            Text(subtitle)
                                .font(.redeCaption)
                                .foregroundStyle(Color.redeT3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.redeT4)
                        .accessibilityHidden(true)  // 装饰性 affordance；行 Button 已承载动作
                }
                .frame(minHeight: RedeShape.controlHeight)
                .padding(.vertical, opt.subtitle != nil ? 6 : 0)
                if divider {
                    Rectangle().fill(Color.redeHair2).frame(height: 1)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
    }

    private func tint(_ opt: RedeChoiceOption) -> Color {
        if opt.role == .destructive { return .redeRisk }
        return opt.emphasis ? .redeEmber2 : .redeT2
    }
}

// MARK: - 行内小折线（MiniSparkline）
// 原 ProgressTabView 底部 private struct，N3b（2026-07-14）提取共用：周期趋势清单 +
// 今日页练完态总结卡体量折线。单色线 + 余烬橙末点；单点退化为一个点。

struct MiniSparkline: View {
    let values: [CGFloat]

    var body: some View {
        Canvas { context, size in
            guard values.count >= 2 else {
                let y = size.height / 2
                context.fill(
                    Path(ellipseIn: CGRect(x: size.width - 5, y: y - 2.5, width: 5, height: 5)),
                    with: .color(.redeEmber)
                )
                return
            }
            let W = size.width, H = size.height
            let maxV = values.max() ?? 1, minV = values.min() ?? 0
            let span = max(maxV - minV, 1)
            func xs(_ i: Int) -> CGFloat { 2 + CGFloat(i) * (W - 4) / CGFloat(values.count - 1) }
            func ys(_ v: CGFloat) -> CGFloat { H - 3 - (v - minV) / span * (H - 6) }
            var line = Path()
            for (i, v) in values.enumerated() {
                let p = CGPoint(x: xs(i), y: ys(v))
                if i == 0 { line.move(to: p) } else { line.addLine(to: p) }
            }
            context.stroke(line, with: .color(.redeNeu), style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
            let lx = xs(values.count - 1), ly = ys(values[values.count - 1])
            context.fill(Path(ellipseIn: CGRect(x: lx - 2.5, y: ly - 2.5, width: 5, height: 5)), with: .color(.redeEmber))
        }
    }
}

/// 列表行的屏幕位置上报（展开动画的锚点来源）。
struct RowFramePreference: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]
    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue()) { _, new in new }
    }
}
