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
    /// 0.5 ≈ 卡面 1.5%（K2 锁定）；base 全屏用 0.33 ≈ 1%（§12.2，真机 25% 亮度校准后定值）。
    var intensity: Double = 0.5

    var body: some View {
        Canvas { context, size in
            var seed: UInt64 = 0x9E3779B97F4A7C15
            func rand() -> Double {
                seed = seed &* 6364136223846793005 &+ 1442695040888963407
                return Double(seed >> 33) / Double(UInt64(1) << 31)
            }
            let step: CGFloat = 3
            var y: CGFloat = 0
            while y < size.height {
                var x: CGFloat = 0
                while x < size.width {
                    let v = rand()
                    if v > 0.5 {
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

// MARK: - 锻面卡(.forged: surface + 12r + 顶缘高光 + 颗粒)

struct ForgedCard<Content: View>: View {
    var emberBarInset: CGFloat? = nil   // 非 nil = 带 embar(top/bottom inset)
    var showReg: Bool = false
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
                    .padding(.vertical, inset)
            }
            if showReg {
                RegMark(corner: .topRight)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(11)
            }
        }
        .background(Color.redeSurface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.redeT1.opacity(0.09))
                .frame(height: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: RedeShape.cardRadius))
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
    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let icon {
                    Image(systemName: icon).font(.system(size: iconSize))
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

struct SegControl: View {
    let options: [String]
    @Binding var selection: String
    /// 机加工凹槽轨（设置面板，rede-app.html .st-seg）：槽顶 inset 暗线模拟铣槽深度。
    var machined: Bool = false

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.self) { option in
                Button {
                    selection = option
                } label: {
                    Text(option)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(selection == option ? Color.redeT1 : Color.redeT3)
                        .frame(maxWidth: .infinity, minHeight: RedeShape.controlHeight)
                        .background(selection == option ? Color.redeHair : .clear)
                        .clipShape(RoundedRectangle(cornerRadius: 7))
                        .contentShape(Rectangle()) // 透明区域也可点中（默认只命中不透明像素）
                }
                .buttonStyle(.redePressableRow)
            }
        }
        .padding(3)
        .background(Color.redeSegBase)
        .clipShape(RoundedRectangle(cornerRadius: 9))
        .overlay(alignment: .top) {
            if machined {
                Rectangle()
                    .fill(Color.black.opacity(0.28))
                    .frame(height: 1)
                    .padding(.horizontal, 6)
            }
        }
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

    private var items: [(tab: RootTab, icon: String, label: String)] {
        let s = localeStore.strings
        return [
            (.today, "house", s.tabToday),
            (.train, "dumbbell", s.tabTrain),
            (.progress, "chart.line.uptrend.xyaxis", s.tabProgress),
            (.plan, "calendar", s.tabPlan),
        ]
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(items, id: \.tab) { item in
                Button {
                    selection = item.tab
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: item.icon).font(.system(size: 22))
                        Text(item.label).font(.system(size: 10, weight: .medium))
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
        .frame(height: 64)
        .padding(.bottom, 6)
        .background(Color.redeTabBar)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
        .sensoryFeedback(.selection, trigger: selection) // tab 切换触觉确认
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
