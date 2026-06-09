import SwiftUI
import RedeL10n

// Progress — 按 rede-app.html #s-progress 复原(Session/Week/Cycle 三段,默认 Week)。
// 判断句靠字号不靠 ember;图表单色,唯一 ember 标记结论。M4 接引擎真数据,视觉不变。
// 文案走 RedeL10n 双语 key(M0-3)。

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

private enum ScaleKind: Hashable {
    case session, week, cycle
}

struct ProgressTabView: View {
    @Environment(LocaleStore.self) private var localeStore
    @State private var scale: ScaleKind = .week

    private var s: RedeStrings { localeStore.strings }

    private var data: ProgressScale {
        switch scale {
        case .session:
            return ProgressScale(
                verdict: s.sessionVerdict,
                sub: s.sessionSub,
                chartTitle: s.sessionChartTitle,
                bars: [(s.liftBench, 96, "PR"), (s.liftOhp, 54, nil), (s.liftIncline, 72, nil), (s.liftTriceps, 46, nil), (s.liftLateral, 60, nil)],
                trend: nil, deload: nil,
                caption: s.sessionCaption,
                showMap: false
            )
        case .week:
            return ProgressScale(
                verdict: s.weekVerdict,
                sub: s.weekSub,
                chartTitle: s.weekChartTitle,
                bars: [(s.muscleChest, 82, nil), (s.muscleBack, 48, "−12%"), (s.muscleShoulders, 70, nil), (s.muscleLegs, 96, nil), (s.muscleArms, 58, nil)],
                trend: nil, deload: nil,
                caption: s.weekCaption,
                showMap: true
            )
        case .cycle:
            return ProgressScale(
                verdict: s.cycleVerdict,
                sub: s.cycleSub,
                chartTitle: s.cycleChartTitle,
                bars: nil,
                trend: [40, 56, 72, 90], deload: 54,
                caption: s.cycleCaption,
                showMap: false
            )
        }
    }

    private var segOptions: [String] { [s.scaleSession, s.scaleWeek, s.scaleCycle] }

    private var segSelection: Binding<String> {
        Binding(
            get: {
                switch scale {
                case .session: return s.scaleSession
                case .week: return s.scaleWeek
                case .cycle: return s.scaleCycle
                }
            },
            set: { newValue in
                if newValue == s.scaleSession { scale = .session }
                else if newValue == s.scaleWeek { scale = .week }
                else { scale = .cycle }
            }
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: s.progressTitle, trailingIcon: "calendar.badge.clock")

                SegControl(options: segOptions, selection: segSelection)
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
                    TrendChart(points: trend, deload: deload, deloadLabel: s.cycleDeload)
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
                Overline(text: s.developmentTitle)
                Spacer()
                Text(s.developmentSummary)
                    .font(.redeCaption)
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT3)
            }
            .padding(.bottom, 8)

            levelRow(s.muscleLegs, "Lv.15", divider: true)
            levelRow(s.muscleArms, "Lv.11", divider: true)
            levelRow(s.muscleChest, "Lv.10", divider: true)

            HStack {
                Text(s.muscleBack).font(.redeBody).foregroundStyle(Color.redeT1)
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

            context.fill(Path(ellipseIn: CGRect(x: 26 * sx, y: 3 * sy, width: 18 * sx, height: 18 * sy)), with: .color(neu))
            var shoulders = Path()
            shoulders.move(to: pt(25, 21)); shoulders.addLine(to: pt(45, 21))
            shoulders.addLine(to: pt(49, 33)); shoulders.addLine(to: pt(21, 33)); shoulders.closeSubpath()
            context.fill(shoulders, with: .color(neu))
            context.fill(Path(roundedRect: CGRect(x: 9 * sx, y: 30 * sy, width: 9 * sx, height: 42 * sy), cornerRadius: 4.5 * sx), with: .color(neu))
            context.fill(Path(roundedRect: CGRect(x: 52 * sx, y: 30 * sy, width: 9 * sx, height: 42 * sy), cornerRadius: 4.5 * sx), with: .color(neu))
            var lats = Path()
            lats.move(to: pt(21, 33)); lats.addLine(to: pt(49, 33))
            lats.addLine(to: pt(45, 71)); lats.addLine(to: pt(25, 71)); lats.closeSubpath()
            context.fill(lats, with: .color(ember))
            var waist = Path()
            waist.move(to: pt(27, 71)); waist.addLine(to: pt(43, 71))
            waist.addLine(to: pt(41, 86)); waist.addLine(to: pt(29, 86)); waist.closeSubpath()
            context.fill(waist, with: .color(neu))
            var hips = Path()
            hips.move(to: pt(27, 86)); hips.addLine(to: pt(43, 86))
            hips.addLine(to: pt(44, 99)); hips.addLine(to: pt(26, 99)); hips.closeSubpath()
            context.fill(hips, with: .color(neu))
            context.fill(Path(roundedRect: CGRect(x: 27 * sx, y: 99 * sy, width: 7.6 * sx, height: 45 * sy), cornerRadius: 4 * sx), with: .color(neu))
            context.fill(Path(roundedRect: CGRect(x: 35.4 * sx, y: 99 * sy, width: 7.6 * sx, height: 45 * sy), cornerRadius: 4 * sx), with: .color(neu))
        }
    }
}

// Cycle 折线 + deload 虚线点(原型 SVG 复原, viewBox 200×120)
private struct TrendChart: View {
    let points: [CGFloat]
    let deload: CGFloat
    let deloadLabel: String

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
                Text(deloadLabel).font(.system(size: 11)).foregroundColor(.redeEmber2),
                at: CGPoint(x: dx, y: dy - 16)
            )
        }
    }
}

#Preview {
    ProgressTabView()
        .environment(LocaleStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
