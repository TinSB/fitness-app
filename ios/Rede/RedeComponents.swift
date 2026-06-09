import SwiftUI

// 签名组件 — 按 docs/rede-prototypes/rede-app.html 的 .ov/.forged/.embar/.reg/.emb/.btn2/.ring/.rule/.tb/.seg/.tg 复原。

// MARK: - Overline(.ov: 11/500/+0.18em/uppercase)

struct Overline: View {
    let text: String
    var color: Color = .redeT4

    var body: some View {
        Text(text.uppercased())
            .font(.redeOverline)
            .tracking(RedeTracking.overline)
            .foregroundStyle(color)
    }
}

// MARK: - 锻面颗粒(.forged::after 噪声,~1.5% 可见度)

struct ForgedGrain: View {
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
        .opacity(0.5)
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

// MARK: - 主操作按钮(.emb: 锻面底 + ember 左缘 2px,非全宽左锚)

struct EmbButton: View {
    let icon: String?
    let title: String
    var iconSize: CGFloat = 16
    var fontSize: CGFloat = 15
    let action: () -> Void

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
            .frame(minHeight: RedeShape.controlHeight)
            .background(Color.redeBtn)
            .clipShape(RoundedRectangle(cornerRadius: RedeShape.buttonRadius))
            .overlay(alignment: .leading) {
                Rectangle().fill(Color.redeEmber).frame(width: 2)
            }
            .clipShape(RoundedRectangle(cornerRadius: RedeShape.buttonRadius))
        }
        .buttonStyle(.plain)
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
        .buttonStyle(.plain)
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

struct SegControl: View {
    let options: [String]
    @Binding var selection: String

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
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Color.redeSegBase)
        .clipShape(RoundedRectangle(cornerRadius: 9))
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

    private let items: [(tab: RootTab, icon: String, label: String)] = [
        (.today, "house", "Today"),
        (.train, "dumbbell", "Train"),
        (.progress, "chart.line.uptrend.xyaxis", "Progress"),
        (.plan, "calendar", "Plan"),
    ]

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
            }
        }
        .frame(height: 64)
        .padding(.bottom, 6)
        .background(Color.redeTabBar)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
    }
}

// MARK: - 页头(.hdr)

struct ScreenHeader: View {
    let title: String
    var subtitle: String? = nil
    var trailingIcon: String? = nil

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
                Image(systemName: trailingIcon)
                    .font(.system(size: 20))
                    .foregroundStyle(Color.redeT4)
                    .frame(minWidth: RedeShape.controlHeight, minHeight: RedeShape.controlHeight)
            }
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, 8)
    }
}
