import SwiftUI
import RedeL10n
import RedeTrainingDecision

// 签名组件 — 按 docs/rede-prototypes/rede-app.html 的 .ov/.forged/.embar/.reg/.emb/.btn2/.ring/.rule/.tb/.seg/.tg 复原。

// MARK: - 重量显示：吸附是引擎的事，显示层如实转述
//
// 这里曾有一层 LoadDisplay，在显示前把每个重量吸附到「器械×单位」真实梯子最近格，
// 为的是解决 kg 侧 30kg 在 lb 侧显成配不出的 66lb。2026-08-19 owner 真机推翻：选重机上
// 他用「精确」手输 55 lb（机器有微调片），大字却被吸成 60——同屏大字 60 / 精确框 55 /
// 「打勾后 55」三方打架，落盘还是 55。吸附的真实职责在**引擎生成处方那一刻**
//（LoadGrid.snapKg / nextRungKg，TodayPrescriptionEngine 与 WarmupLadderEngine 各自已做）；
// 用户已经发生的事实（落盘组重、上次实际、手输目标）以及会话内延续它的建议，显示层一律
// 交 s.formatKg 如实转述——再吸一次不是在帮用户配重，是在篡改他的真实数据。
// 例外只剩「生成可配格子」：SessionStore.watchWeightLadder 仍走 LoadGrid，那与引擎侧同性质。

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
            // SwiftUI 会把 tracking 也加在末字符之后；收回这段空白让居中/右对齐按字形对齐。
            .padding(.trailing, -RedeTracking.overline)
    }
}

// MARK: - 锻面颗粒（默认对角拉丝；强度待真机校准）

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
    /// ⚠️ **强度待真机校准**：默认对角拉丝只在模拟器上看过。健身房暗光 + OLED 会比模拟器
    /// 明显，下次 TestFlight 需实看后再定。
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

struct RegMark: View {
    var body: some View {
        Path { p in
            p.move(to: CGPoint(x: 2, y: 0))
            p.addLine(to: CGPoint(x: 11, y: 0))
            p.addLine(to: CGPoint(x: 11, y: 9))
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
                RegMark()
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
    var size: CGFloat = 19       // 数值基准字号（默认档）；hero 用 30
    /// 随 Dynamic Type 缩放时锚定的系统文字样式（DL §12.4c / NFR-7：禁固定 pt）。
    /// 行内 19pt 锚 title3，hero 30pt 锚 title1——与 redeHeadline / redeTitle 同一套缩放曲线。
    var textStyle: UIFont.TextStyle = .title3
    /// 自重/弹力带只有 "× 6"，此时把次数升格成主数值——否则整行只剩一个小字。
    private var repsIsPrimary: Bool { value == nil }

    var body: some View {
        // 在 body 里求值（同 Font.redeX 的约定：不缓存），默认档数值与 size 逐点相同。
        let scaled = Font.redeScaled(size, textStyle)
        return HStack(alignment: .firstTextBaseline, spacing: 0) {
            // 各段单行；数值段 fixedSize——数字永不折成「62.」与「5」两行（大字号下宁可整簇变宽，
            // 由调用方在 isAccessibilitySize 下改上下堆叠，见今日页动作行）。
            if let prefix {
                Text("\(prefix) ")
                    .font(.system(size: scaled * 0.63, weight: .medium))
                    .foregroundStyle(Color.redeT3)
                    .lineLimit(1)
            }
            if let value {
                Text(value)
                    .font(.system(size: scaled, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT1)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
            if let unit {
                Text(" \(unit)")
                    .font(.system(size: scaled * 0.47, weight: .regular))
                    .foregroundStyle(Color.redeT4)
                    .lineLimit(1)
            }
            if let tail {
                Text(value == nil ? tail : "  \(tail)")
                    .font(.system(size: repsIsPrimary ? scaled : scaled * 0.63,
                                  weight: repsIsPrimary ? .semibold : .medium))
                    .monospacedDigit()
                    .foregroundStyle(repsIsPrimary ? Color.redeT1 : Color.redeT3)
                    .lineLimit(1)
            }
        }
    }
}

/// 处方目标（重量 × 次数）的分段数值簇 + 整串无障碍标签——今日页动作行 / hero 与
/// 训练页待机预览共用，两页同一批动作读出同一个样子。分段来自 L10n 的 targetParts
/// （与 targetLine 逐字一致，见 RedeL10n 契约测试），视图层不解析字符串；
/// VoiceOver 念完整串，避免读出「37.5 停顿 kg 停顿 乘 6」。
struct PrescriptionTarget: View {
    let strings: RedeStrings
    let exercise: ExercisePrescriptionPlan
    var size: CGFloat = 19
    var textStyle: UIFont.TextStyle = .title3

    var body: some View {
        let parts = strings.targetParts(
            loadType: exercise.loadType,
            weightKg: exercise.targetWeightKg,
            reps: exercise.targetReps)
        LoadCluster(prefix: parts.prefix, value: parts.value, unit: parts.unit,
                    tail: parts.reps, size: size, textStyle: textStyle)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(strings.targetLine(
                loadType: exercise.loadType,
                weightKg: exercise.targetWeightKg,
                reps: exercise.targetReps))
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

extension Font {
    /// 长段说明正文（动作详情的技术要点 / 退阶进阶 / 注意事项共用）：14.5 锚 body，随 Dynamic Type 缩放。
    static var redeProse: Font { .system(size: redeScaled(14.5, .body), weight: .regular) }
}

extension View {
    /// 长段说明正文的统一排版：redeProse + 行距 4 + T2。同一个 sheet 内的几段正文必须同款，
    /// 否则读起来像两种排版混用。
    func redeProse() -> some View {
        font(.redeProse).lineSpacing(4).foregroundStyle(Color.redeT2)
    }
}

struct CueList: View {
    let items: [String]

    /// 条间距（技术要点 / 退阶·进阶两段并列条目共用同一个节奏）。
    static let itemGap: CGFloat = 13

    var body: some View {
        VStack(alignment: .leading, spacing: Self.itemGap) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, text in
                HStack(alignment: .top, spacing: 13) {
                    Text(String(format: "%02d", i + 1))
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.redeT4.opacity(0.75))
                        .padding(.top, 3)
                        .accessibilityHidden(true)   // 序号是排版，不念给 VoiceOver
                    Text(text)
                        .redeProse()
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
// 遮罩铺满宿主；悬浮 tab bar 是 RootTabView 的兄弟层，始终画在遮罩之上。

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
    /// 默认 50（页面主 CTA）；与 SteelButton 并排时传 RedeShape.controlHeight，上下沿才齐。
    var minHeight: CGFloat = RedeShape.primaryButtonHeight
    let action: () -> Void

    // M1 提权（2026-07-06 去 AI 感中期批次）：主 CTA 曾 hug 半宽 + 锻面底与面板
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
            .frame(minHeight: minHeight)
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

// MARK: - 悬浮主 CTA（今日 / 训练待机共用）
//
// 用法：页面 ScrollView 上 `.overlay(alignment: .bottom) { if 条件 { FloatingPrimaryCTA(...) } }`，
// 内容侧底部留白用 RedeSpace.floatingCTAContentInset，要避让它的浮层用 RedeSpace.floatingCTA。
// **不用 safeAreaInset**：它的 content 带条件（model 未加载时为空），首帧算出的 inset 是 0，
// model 到位后不会重算——真机上表现为 CTA 压住最后一个动作（2026-08-10 用户实拍反馈）。
// 改成 overlay + 内容侧静态留白，留白量与 CTA 实际高度对齐，不依赖任何时序。

struct FloatingPrimaryCTA: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        EmbButton(icon: icon, title: title, action: action)
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, RedeSpace.floatingCTATop)
            // 垫开 tab bar：tab bar 是 RootTabView 的兄弟层、压在本视图之上。
            .padding(.bottom, RedeSpace.bottomBar)
            .background {
                ZStack(alignment: .top) {
                    Color.redeBase.ignoresSafeArea(edges: .bottom)
                    // 上方 24pt 渐隐，列表内容滑到 CTA 下不露出半截字。
                    LinearGradient(colors: [Color.redeBase.opacity(0), Color.redeBase],
                                   startPoint: .top, endPoint: .bottom)
                        .frame(height: 24)
                        .offset(y: -24)
                }
            }
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

// MARK: - 刻线分隔(.rule)

struct RuleDivider: View {
    /// 上方区块若以 44pt 命中高的行收尾，行内文字下方已自带 RedeSpace.rowTrailingInset 的留白，再叠 12pt 上边距，
    /// 线上方就比下方松一截。topInset = 上方已有的留白量，从上边距里扣掉（不低于 0），使线上下近似等距。
    /// 默认 0 = 紧跟文字型区块，行为不变。
    var topInset: CGFloat = 0

    var body: some View {
        Rectangle()
            .fill(Color.redeHair2)
            .frame(height: 1)
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, max(0, RedeSpace.section / 2 - topInset))
            .padding(.bottom, RedeSpace.section / 2)
    }
}

// MARK: - 行尾披露箭头 / 行首图标槽 / 文字中线对齐

/// 行尾披露 chevron——全 App 唯一规格：.redeCaption 常规字重 + T4，装饰性（VoiceOver 隐藏，
/// 行的可点性由 Button 与 hint 表达）。禁止再写 `Image(systemName: "chevron.right")` + 自选字号字重。
/// 不含「文字 + chevron」的行内动作链接（那是另一类，随文字字号）。
struct DisclosureChevron: View {
    var body: some View {
        Image(systemName: "chevron.right")
            .font(.redeCaption)
            .foregroundStyle(Color.redeT4)
            .accessibilityHidden(true)
    }
}

/// 开放行的行首图标：固定宽度槽（随 caption 字号缩放），不同宽度的 SF Symbol 不再把标题推到
/// 不同的竖线上。与图标后的标题间距统一 8（调用方 HStack(spacing: 8)）。
/// 颜色继承外层 foregroundStyle；对 VoiceOver 隐藏（行标题自解释）。
struct RowLeadIcon: View {
    let systemName: String
    @ScaledMetric(relativeTo: .caption) private var slot: CGFloat = 16

    var body: some View {
        Image(systemName: systemName)
            .font(.redeCaption)
            .frame(width: slot, alignment: .leading)
            .accessibilityHidden(true)
    }
}

/// 让没有文字基线的元素（进度条 Capsule、chevron）在 `.firstTextBaseline` 行里居中于同行 body 字的
/// 视觉中线：无基线的元素默认以底边落在基线上，会整体低于字的视觉中线。
/// 4.5 = 14pt 正文字形中线到基线的高度（实测 4.7），随 body 字号缩放。
private struct TextMidlineAligned: ViewModifier {
    @ScaledMetric(relativeTo: .body) private var rise: CGFloat = 4.5

    func body(content: Content) -> some View {
        content.alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + rise }
    }
}

extension View {
    func alignedToTextMidline() -> some View { modifier(TextMidlineAligned()) }
}

// MARK: - 分段控件(.seg)

/// S2 刻线分组分隔（设置面板首用，rede-app.html .etick）：短竖刻线序列，两端略长收边。
struct EngraveDivider: View {
    /// 上方留白。默认 0 = 由调用方自己在外面补（既有用法）；设置页用它按「上一块是什么收尾」取值
    ///（紧接 44pt 行要扣掉行盒里不可见的内边距），见 SettingsSheet.dividerAfterRow。
    var above: CGFloat = 0

    var body: some View {
        HStack(spacing: 20) {
            ForEach(0..<9, id: \.self) { i in
                Rectangle()
                    .fill(Color.redeEtch)
                    .frame(width: 1, height: (i == 0 || i == 8) ? 9 : 6)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, above)
    }
}

// 分段控件（rede-app.html .st-seg）：一颗安静的键，没有槽。
//
// 2026-08-09 质感重做（owner：「两个大按钮感觉有点丑」→ 四档比稿后拍板 C）。
// 旧版三处问题：
//   ① **切换是硬切**——选中底色直接跳到另一格，没有任何位移，读起来像两个独立按钮
//      互相顶掉。改用 matchedGeometryEffect + spring（全仓此前用量为 0，这是第一处）。
//   ② **廉价感来自两圈同心描边**——槽描一圈、键再描一圈，叠在一起就是廉价的来源。
//      中途试过「把槽压黑、把键提亮」，反而更糟：键的明度冲出了 app 自己的材质梯子
//      （铭牌卡才 redeSurface 0x1D1B19），两个最不影响行为的设置成了整页最重的实心块。
//      **现在一条描边都没有**——去掉槽，只留一颗 redeHair 纯色胶囊裹住选中项，
//      状态靠形状 + 字重 + 字色说话。
//   ③ **控件高 50pt**（44 轨 + 3×2 内边），比 Apple 分段控件（32）高一半，所以笨重。
//      现在键 28，而**点击热区仍是 44**——键垫在 44 高的行里居中，视觉收窄不牺牲可点性。
struct SegControl: View {
    let options: [String]
    @Binding var selection: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 每个 SegControl 实例各自的命名空间——同页多个控件的键不会互相吸附。
    @Namespace private var keySlot

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.self) { option in
                segment(option)
            }
        }
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
                .foregroundStyle(isOn ? Color.redeT1 : Color.redeT4)
                .frame(maxWidth: .infinity, minHeight: RedeShape.controlHeight)
                .background {
                    if isOn {
                        Capsule(style: .continuous)
                            .fill(Color.redeHair)
                            .frame(height: RedeShape.segmentKeyHeight)
                            .matchedGeometryEffect(id: "segKey", in: keySlot)
                    }
                }
                .contentShape(Rectangle()) // 透明区域也可点中（默认只命中不透明像素）
        }
        .buttonStyle(.redePressableRow)
        .accessibilityAddTraits(isOn ? .isSelected : [])
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
            .frame(minWidth: RedeShape.controlHeight, minHeight: RedeShape.controlHeight, alignment: .trailing)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 悬浮标尺 Tab Bar（锻面块 + 行程标尺 + ember 游标）

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
                                .frame(height: RedeTabBarMetrics.iconSlotHeight)
                            Text(item.label).font(.system(size: 9.5, weight: .medium))
                        }
                        .foregroundStyle(selection == item.tab ? Color.redeEmber : Color.redeT4)
                        .frame(maxWidth: .infinity, minHeight: RedeTabBarMetrics.controlHeight)
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
        .padding(.top, RedeTabBarMetrics.topInset)
        .background(
            ZStack {
                // 读 token，不硬编码——曾经写死过一组冷调色值，换主题时 tab bar 整块掉队。
                LinearGradient(colors: [Color.redeRaised, Color.redeSurface],
                               startPoint: .top, endPoint: .bottom)
                ForgedGrain(intensity: 0.4)
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: RedeTabBarMetrics.cornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: RedeTabBarMetrics.cornerRadius, style: .continuous)
                .strokeBorder(LinearGradient(
                    colors: [Color.redeT1.opacity(0.14), Color.redeT1.opacity(0.02), .clear],
                    startPoint: .top, endPoint: .bottom), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.6), radius: 17, y: 8)
        .padding(.horizontal, RedeSpace.page)
        .padding(.bottom, RedeTabBarMetrics.bottomInset)
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
        .frame(height: RedeTabBarMetrics.rulerHeight)
        .accessibilityHidden(true)      // 纯装饰：选中态已由每个 tab 的 .isSelected 播报
    }
}

// MARK: - 页头(.hdr)

private enum ScreenHeaderMetrics {
    /// 44pt 热区内的图标与 22pt 标题首行视觉中心对齐（像素审计校准）。
    static let trailingIconTitleCenterAdjustment: CGFloat = -9
}

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
                        .frame(width: RedeShape.controlHeight, height: RedeShape.controlHeight, alignment: .trailing)
                        .padding(.top, ScreenHeaderMetrics.trailingIconTitleCenterAdjustment)
                        .frame(width: RedeShape.controlHeight, height: RedeShape.controlHeight, alignment: .top)
                        .contentShape(Rectangle())
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
                    DisclosureChevron()
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
