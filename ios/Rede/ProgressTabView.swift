import SwiftUI

// Progress — 按 rede-app.html #s-progress 复原(Session/Week/Cycle 三段,默认 Week)。
// 判断句靠字号不靠 ember;图表单色,唯一 ember 标记结论。M4 接引擎真数据,视觉不变。

private struct ProgressScale {
    let verdict: String
    let sub: String
    let chartTitle: String
    let bars: [(label: String, height: CGFloat, tag: String?)]?
    let trend: [CGFloat]?
    let deload: CGFloat?
    let caption: String
    let showMap: Bool
}

private let scales: [String: ProgressScale] = [
    "Session": ProgressScale(
        verdict: "Solid session. New bench PR.",
        sub: "195 × 3 top set · est 1RM 214, +6 lb on the block.",
        chartTitle: "Session · by lift",
        bars: [("Bench", 96, "PR"), ("OHP", 54, nil), ("Incline", 72, nil), ("Triceps", 46, nil), ("Lateral", 60, nil)],
        trend: nil, deload: nil,
        caption: "Bench is the lift that moved — single ember marks the PR.",
        showMap: false
    ),
    "Week": ProgressScale(
        verdict: "Strong week. Back is lagging.",
        sub: "Pulling volume +18%, but back still trails chest. One pull set added next week.",
        chartTitle: "Weekly volume · by muscle",
        bars: [("Chest", 82, nil), ("Back", 48, "−12%"), ("Shldr", 70, nil), ("Legs", 96, nil), ("Arms", 58, nil)],
        trend: nil, deload: nil,
        caption: "Back is the one to fix — single ember marks the conclusion.",
        showMap: true
    ),
    "Cycle": ProgressScale(
        verdict: "Block on track. Deload due.",
        sub: "+9% e1RM across the block — week 5 is a planned deload.",
        chartTitle: "Cycle · e1RM trend",
        bars: nil,
        trend: [40, 56, 72, 90], deload: 54,
        caption: "Week 5 is a planned deload — single ember marks it.",
        showMap: false
    ),
]

struct ProgressTabView: View {
    @State private var scale = "Week"

    private var data: ProgressScale { scales[scale]! }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: "Progress", trailingIcon: "calendar.badge.clock")

                SegControl(options: ["Session", "Week", "Cycle"], selection: $scale)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 16)

                // HERO = 判断句
                VStack(alignment: .leading, spacing: 8) {
                    Text(data.verdict)
                        .font(.redeHeadline)
                        .tracking(RedeTracking.headline)
                        .lineSpacing(22 * 0.3)
                        .foregroundStyle(Color.redeT1)
                        .lineLimit(2)
                    Text(data.sub)
                        .font(.redeBody)
                        .lineSpacing(14 * 0.45)
                        .foregroundStyle(Color.redeT3)
                        .lineLimit(3)
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, RedeSpace.section)

                chartSection
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)

                RuleDivider()

                developmentSection
                    .padding(.horizontal, RedeSpace.page)
            }
            .padding(.bottom, 78)
        }
        .background(Color.redeBase)
    }

    private var chartSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Overline(text: data.chartTitle)
            HStack(alignment: .bottom, spacing: 14) {
                if let bars = data.bars {
                    barChart(bars)
                } else if let trend = data.trend, let deload = data.deload {
                    TrendChart(points: trend, deload: deload)
                        .frame(height: 120)
                        .frame(maxWidth: .infinity)
                }
                if data.showMap {
                    BodyMap().frame(width: 110 * 0.46, height: 110)
                }
            }
            HStack(spacing: 6) {
                Rectangle().fill(Color.redeEmber).frame(width: 11, height: 2)
                Text(data.caption)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
            }
            .padding(.top, -2)
        }
    }

    private func barChart(_ bars: [(label: String, height: CGFloat, tag: String?)]) -> some View {
        HStack(alignment: .bottom, spacing: 11) {
            ForEach(bars, id: \.label) { bar in
                let highlighted = bar.tag != nil
                VStack(spacing: 8) {
                    ZStack(alignment: .top) {
                        if let tag = bar.tag {
                            Text(tag)
                                .font(.redeCaption)
                                .monospacedDigit()
                                .foregroundStyle(Color.redeEmber2)
                                .offset(y: -19)
                        }
                    }
                    .frame(height: 0)
                    UnevenRoundedRectangle(topLeadingRadius: 3, topTrailingRadius: 3)
                        .fill(highlighted ? Color.redeEmber : Color.redeNeu)
                        .frame(height: bar.height)
                        .frame(maxWidth: .infinity)
                    Overline(text: bar.label, color: highlighted ? .redeEmber2 : .redeT4)
                }
                .frame(maxWidth: .infinity, alignment: .bottom)
            }
        }
        .frame(height: 120 + 27, alignment: .bottom)
        .frame(maxWidth: .infinity)
    }

    private var developmentSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Overline(text: "Development")
                Spacer()
                Text("Intermediate · balance 76")
                    .font(.redeCaption)
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT3)
            }
            .padding(.bottom, 8)

            levelRow("Legs", "Lv.15", divider: true)
            levelRow("Arms", "Lv.11", divider: true)
            levelRow("Chest", "Lv.10", divider: true)

            HStack {
                Text("Back").font(.redeBody).foregroundStyle(Color.redeT1)
                Spacer()
                HStack(spacing: 4) {
                    Text("Lv.8 → Lv.9").font(.redeBody).monospacedDigit()
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.redeEmber)
                }
                .foregroundStyle(Color.redeT1)
            }
            .padding(.vertical, 10)
        }
    }

    private func levelRow(_ name: String, _ level: String, divider: Bool) -> some View {
        HStack {
            Text(name).font(.redeBody).foregroundStyle(Color.redeT2)
            Spacer()
            Text(level).font(.redeBody).monospacedDigit().foregroundStyle(Color.redeT2)
        }
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) {
            if divider {
                Rectangle().fill(Color.redeHair2).frame(height: 1)
            }
        }
    }
}

// 单色背视人形,背阔肌唯一 ember(原型 bodyMap SVG 复原, viewBox 70×150)
private struct BodyMap: View {
    var body: some View {
        Canvas { context, size in
            let sx = size.width / 70
            let sy = size.height / 150
            let neu = Color.redeNeu
            let ember = Color.redeEmber

            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * sx, y: y * sy) }

            // 头
            context.fill(Path(ellipseIn: CGRect(x: 26 * sx, y: 3 * sy, width: 18 * sx, height: 18 * sy)), with: .color(neu))
            // 肩
            var shoulders = Path()
            shoulders.move(to: pt(25, 21)); shoulders.addLine(to: pt(45, 21))
            shoulders.addLine(to: pt(49, 33)); shoulders.addLine(to: pt(21, 33)); shoulders.closeSubpath()
            context.fill(shoulders, with: .color(neu))
            // 手臂
            context.fill(Path(roundedRect: CGRect(x: 9 * sx, y: 30 * sy, width: 9 * sx, height: 42 * sy), cornerRadius: 4.5 * sx), with: .color(neu))
            context.fill(Path(roundedRect: CGRect(x: 52 * sx, y: 30 * sy, width: 9 * sx, height: 42 * sy), cornerRadius: 4.5 * sx), with: .color(neu))
            // 背阔肌 = 唯一 ember
            var lats = Path()
            lats.move(to: pt(21, 33)); lats.addLine(to: pt(49, 33))
            lats.addLine(to: pt(45, 71)); lats.addLine(to: pt(25, 71)); lats.closeSubpath()
            context.fill(lats, with: .color(ember))
            // 腰
            var waist = Path()
            waist.move(to: pt(27, 71)); waist.addLine(to: pt(43, 71))
            waist.addLine(to: pt(41, 86)); waist.addLine(to: pt(29, 86)); waist.closeSubpath()
            context.fill(waist, with: .color(neu))
            // 臀
            var hips = Path()
            hips.move(to: pt(27, 86)); hips.addLine(to: pt(43, 86))
            hips.addLine(to: pt(44, 99)); hips.addLine(to: pt(26, 99)); hips.closeSubpath()
            context.fill(hips, with: .color(neu))
            // 腿
            context.fill(Path(roundedRect: CGRect(x: 27 * sx, y: 99 * sy, width: 7.6 * sx, height: 45 * sy), cornerRadius: 4 * sx), with: .color(neu))
            context.fill(Path(roundedRect: CGRect(x: 35.4 * sx, y: 99 * sy, width: 7.6 * sx, height: 45 * sy), cornerRadius: 4 * sx), with: .color(neu))
        }
    }
}

// Cycle 折线 + deload 虚线点(原型 SVG 复原, viewBox 200×120)
private struct TrendChart: View {
    let points: [CGFloat]
    let deload: CGFloat

    var body: some View {
        Canvas { context, size in
            let W = size.width
            let H = size.height
            let n = points.count + 1
            func xs(_ i: Int) -> CGFloat { 12 + CGFloat(i) * (W - 24) / CGFloat(n - 1) }
            func ys(_ v: CGFloat) -> CGFloat { H - 8 - (v / 100 * (H - 24)) }

            var line = Path()
            for (i, p) in points.enumerated() {
                let point = CGPoint(x: xs(i), y: ys(p))
                if i == 0 { line.move(to: point) } else { line.addLine(to: point) }
            }
            context.stroke(line, with: .color(.redeNeu), style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))

            let di = points.count
            let dx = xs(di), dy = ys(deload)
            var dash = Path()
            dash.move(to: CGPoint(x: xs(di - 1), y: ys(points[di - 1])))
            dash.addLine(to: CGPoint(x: dx, y: dy))
            context.stroke(dash, with: .color(.redeEmber), style: StrokeStyle(lineWidth: 2.5, dash: [3, 3]))

            context.fill(Path(ellipseIn: CGRect(x: dx - 4.5, y: dy - 4.5, width: 9, height: 9)), with: .color(.redeEmber))

            context.draw(
                Text("Deload").font(.system(size: 11)).foregroundColor(.redeEmber2),
                at: CGPoint(x: dx, y: dy - 16)
            )
        }
    }
}

#Preview {
    ProgressTabView()
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
