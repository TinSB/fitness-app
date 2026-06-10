import RedeDataHealth
import RedeLocalSnapshot
import SwiftUI
import RedeL10n

// Progress — M4-3 接引擎真数据（原型 rede-app.html #s-progress 骨架不变：
// seg 三尺度 + HERO 判断句 + 单色图唯一 ember + caption）。
// 诚实化调整（产品原则 6 > 原型完全一致，留痕 DEV_LOG）：
// · Week 柱图改「按周训练量」（动作目录无肌群权重，按肌群不可诚实）→ 人形图不上；
// · Cycle 折线 = 关键动作真 e1RM 趋势，ember 标最高点（MVP 无训练块/计划减载模型）；
// · Development 肌群等级块（FR-PR6 FF）不上——不给用户看编造数据；
// · 新增 历史（FR-PR1）与 数据质量（FR-PR4）区块：原型未画，取保守样式。
// 判断全部来自包内（投影/趋势/周对比/质量），本层只渲染。

private enum ScaleKind: Hashable {
    case session, week, cycle
}

struct ProgressTabView: View {
    @Environment(LocaleStore.self) private var localeStore
    @State private var scale: ScaleKind = {
        // 验证脚手架（沿 -initialTab 先例）：截图脚本预设尺度，不影响真实用户
        switch UserDefaults.standard.string(forKey: "progressScale") {
        case "session": return .session
        case "cycle": return .cycle
        default: return .week // 原型默认 Week
        }
    }()
    @State private var outcome: ProgressModel.LoadOutcome?
    @State private var detailRecord: SnapshotSessionRecord?

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: s.progressTitle)

                switch outcome {
                case nil:
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 80)
                case .unreadable:
                    unreadableState
                case .ready(let model):
                    if model.snapshot.history.isEmpty {
                        emptyState(model)
                    } else {
                        content(model)
                    }
                }
            }
            .padding(.bottom, 78)
        }
        .background(Color.redeBase)
        .onAppear { reload() }
        .sheet(item: $detailRecord) { record in
            historyDetailSheet(record)
        }
    }

    private func reload() {
        Task { outcome = await ProgressModel.loadOutcomeAsync() }
    }

    // MARK: - 三态

    private var unreadableState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(s.dataUnreadableHeadline)
                .font(.redeHeadline)
                .tracking(RedeTracking.headline)
                .foregroundStyle(Color.redeT1)
            Text(s.dataUnreadableReceipt)
                .font(.redeBody)
                .foregroundStyle(Color.redeT3)
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, RedeSpace.section)
    }

    private func emptyState(_ model: ProgressModel) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text(s.progressEmptyTitle)
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .foregroundStyle(Color.redeT1)
                Text(s.progressEmptySub)
                    .font(.redeBody)
                    .foregroundStyle(Color.redeT3)
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, RedeSpace.section)

            // 历史为空但存在坏数据时仍要诚实提示（如整库损坏后部分丢弃）
            if model.quality.hasFindings {
                dataQualitySection(model.quality)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)
            }
        }
    }

    // MARK: - 真数据内容

    private func content(_ model: ProgressModel) -> some View {
        let view = scaleView(model)
        return VStack(alignment: .leading, spacing: 0) {
            SegControl(options: segOptions, selection: segSelection)
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 16)

            // HERO = 判断句（靠字号不靠 ember）
            VStack(alignment: .leading, spacing: 8) {
                Text(view.verdict)
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .lineSpacing(22 * 0.3)
                    .foregroundStyle(Color.redeT1)
                    .lineLimit(2)
                Text(view.sub)
                    .font(.redeBody)
                    .lineSpacing(14 * 0.45)
                    .foregroundStyle(Color.redeT3)
                    .lineLimit(3)
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, RedeSpace.section)

            VStack(alignment: .leading, spacing: 14) {
                Overline(text: view.chartTitle)
                if let bars = view.bars {
                    barChart(bars)
                } else if let trend = view.trend {
                    TrendChart(points: trend.values, emberIndex: trend.emberIndex, emberLabel: trend.emberLabel)
                        .frame(height: 120)
                        .frame(maxWidth: .infinity)
                }
                HStack(spacing: 6) {
                    Rectangle().fill(Color.redeEmber).frame(width: 11, height: 2)
                    Text(view.caption)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                }
                .padding(.top, -2)
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, RedeSpace.section)

            RuleDivider()

            historySection(model)
                .padding(.horizontal, RedeSpace.page)

            if model.quality.hasFindings {
                dataQualitySection(model.quality)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)
            }
        }
    }

    // MARK: - 尺度投影（纯展示组装；判断来自包内 insight）

    private struct ScaleView {
        let verdict: String
        let sub: String
        let chartTitle: String
        let bars: [(label: String, fraction: CGFloat, tag: String?, ember: Bool)]?
        let trend: (values: [CGFloat], emberIndex: Int, emberLabel: String)?
        let caption: String
    }

    private func scaleView(_ model: ProgressModel) -> ScaleView {
        switch scale {
        case .session: return sessionScale(model)
        case .week: return weekScale(model)
        case .cycle: return cycleScale(model)
        }
    }

    private func sessionScale(_ model: ProgressModel) -> ScaleView {
        let latest = model.snapshot.history[0]
        let record = model.statsRecords.first { $0.id == latest.sessionId }
        let volumes: [(id: String, volume: Double)] = (record?.exercises ?? []).map { exercise in
            (exercise.exerciseId, exercise.sets.reduce(0) { $0 + $1.weightKg * Double($1.reps) })
        }
        let shown = Array(volumes.prefix(5))
        let maxVolume = max(shown.map(\.volume).max() ?? 1, 1)
        let prSet = Set(latest.prExerciseIds)
        let bars = shown.map { item in
            (label: s.exerciseName(item.id),
             fraction: CGFloat(item.volume / maxVolume),
             tag: prSet.contains(item.id) ? s.historyPRBadge : nil,
             ember: prSet.contains(item.id))
        }

        let verdict: String
        let caption: String
        if let firstPR = latest.prExerciseIds.first {
            verdict = s.sessionVerdictPR(s.exerciseName(firstPR))
            caption = s.sessionCaptionPR(s.exerciseName(firstPR))
        } else {
            verdict = s.sessionVerdictDone
            caption = s.sessionCaptionNoPR
        }
        var sub = s.historyRowMeta(sets: latest.setCount, volumeKg: s.formatKg(latest.totalVolumeKg))
        if let top = latest.topSet,
           let e1rm = model.snapshot.exerciseTrends
               .first(where: { $0.exerciseId == top.exerciseId })?
               .points.first(where: { $0.sessionId == latest.sessionId })?.e1RmKg {
            // e1RM 点缺失（理论不可达）→ 保持不含 e1RM 的兜底句，绝不显示「0 kg」
            sub = s.sessionSubTopSet(
                lift: s.exerciseName(top.exerciseId),
                kg: s.formatKg(top.weightKg),
                reps: top.reps,
                e1rmKg: s.formatE1Rm(e1rm)
            )
        }
        return ScaleView(
            verdict: verdict, sub: sub,
            chartTitle: s.sessionChartTitle,
            bars: bars, trend: nil, caption: caption
        )
    }

    private func weekScale(_ model: ProgressModel) -> ScaleView {
        let weeks = model.snapshot.weeklyVolume // 新→旧
        let latest = weeks[0]
        let shown = Array(weeks.prefix(5)).reversed() // 旧→新（左→右）
        let maxVolume = max(shown.map(\.totalVolumeKg).max() ?? 1, 1)

        var deltaPercent: Int?
        if case .vsPreviousWeek(let delta)? = model.weeklyComparison { deltaPercent = delta }

        let bars = shown.map { week in
            let isCurrent = week.weekStartISO == latest.weekStartISO
            let tag: String? = isCurrent
                ? deltaPercent.map { "\($0 >= 0 ? "+" : "−")\(abs($0))%" }
                : nil
            return (label: s.weekBarLabel(fromISO: week.weekStartISO),
                    fraction: CGFloat(week.totalVolumeKg / maxVolume),
                    tag: tag,
                    ember: isCurrent)
        }

        let verdictCode: String
        let sub: String
        switch model.weeklyComparison {
        case .vsPreviousWeek(let delta)?:
            verdictCode = delta > 0 ? "up" : (delta < 0 ? "down" : "level")
            sub = s.weekSubCompared(deltaPercent: delta, sets: latest.setCount, volumeKg: s.formatKg(latest.totalVolumeKg))
        case .previousWeekMissing?:
            verdictCode = "gap"
            sub = s.weekSubGapWeek(sets: latest.setCount, volumeKg: s.formatKg(latest.totalVolumeKg))
        default:
            verdictCode = "first"
            sub = s.weekSubFirstWeek(sets: latest.setCount, volumeKg: s.formatKg(latest.totalVolumeKg))
        }

        return ScaleView(
            verdict: s.weekVerdict(verdictCode),
            sub: sub,
            chartTitle: s.weekChartTitleByWeek,
            bars: bars, trend: nil,
            caption: s.weekCaptionCurrent
        )
    }

    private func cycleScale(_ model: ProgressModel) -> ScaleView {
        guard let key = model.keyTrend, let assessment = model.trendAssessment else {
            // history 非空时必有趋势；防御兜底走校准文案
            return ScaleView(
                verdict: s.trendVerdict(call: "calibrating", liftName: ""),
                sub: s.trendSub(call: "calibrating", sessions: 0, deltaKg: "0"),
                chartTitle: s.cycleChartTitleFor("—"), bars: nil, trend: nil,
                caption: s.cycleCaptionPeak
            )
        }
        let name = s.exerciseName(key.exerciseId)
        let points = Array(key.points.suffix(6))
        let values = points.map { CGFloat($0.e1RmKg) }
        let emberIndex = values.indices.max(by: { values[$0] < values[$1] }) ?? 0
        let call: String
        switch assessment.call {
        case .up: call = "up"
        case .down: call = "down"
        case .flat: call = "flat"
        case .calibrating: call = "calibrating"
        }
        return ScaleView(
            verdict: s.trendVerdict(call: call, liftName: name),
            sub: s.trendSub(
                call: call,
                sessions: assessment.windowSessionCount,
                deltaKg: s.formatE1Rm(abs(assessment.deltaKg))
            ),
            chartTitle: s.cycleChartTitleFor(name),
            bars: nil,
            trend: (values, emberIndex, s.formatE1Rm(points[emberIndex].e1RmKg)),
            caption: s.cycleCaptionPeak
        )
    }

    // MARK: - seg

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

    // MARK: - 柱图（原型形态：120pt 区、唯一 ember、标签浮顶）

    private func barChart(_ bars: [(label: String, fraction: CGFloat, tag: String?, ember: Bool)]) -> some View {
        HStack(alignment: .bottom, spacing: 11) {
            ForEach(Array(bars.enumerated()), id: \.offset) { _, bar in
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
                        .fill(bar.ember ? Color.redeEmber : Color.redeNeu)
                        .frame(height: max(8, bar.fraction * 96)) // 容器 120，最高柱 96——顶部留标签头位（原型口径）
                        .frame(maxWidth: .infinity)
                    Overline(text: bar.label, color: bar.ember ? .redeEmber2 : .redeT4)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, alignment: .bottom)
            }
        }
        .frame(height: 120 + 27, alignment: .bottom)
        .frame(maxWidth: .infinity)
    }

    // MARK: - 历史（FR-PR1；原型未画——保守样式：ov 标题 + 行 + 细分隔线）

    private func historySection(_ model: ProgressModel) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Overline(text: s.historyTitle)
                .padding(.bottom, 8)
            ForEach(Array(model.snapshot.history.prefix(10).enumerated()), id: \.element.sessionId) { index, entry in
                Button {
                    detailRecord = model.records.first { $0.id == entry.sessionId }
                } label: {
                    HStack {
                        Text(s.shortDate(fromISO: entry.dateISO))
                            .font(.redeBody)
                            .monospacedDigit()
                            .foregroundStyle(Color.redeT2)
                        if !entry.prExerciseIds.isEmpty {
                            Text(s.historyPRBadge)
                                .font(.redeCaption)
                                .monospacedDigit()
                                .foregroundStyle(Color.redeEmber2)
                        }
                        Spacer()
                        Text(s.historyRowMeta(sets: entry.setCount, volumeKg: s.formatKg(entry.totalVolumeKg)))
                            .font(.redeBody)
                            .monospacedDigit()
                            .foregroundStyle(Color.redeT3)
                    }
                    .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
                .overlay(alignment: .bottom) {
                    if index < min(model.snapshot.history.count, 10) - 1 {
                        Rectangle().fill(Color.redeHair2).frame(height: 1)
                    }
                }
            }
        }
    }

    private func historyDetailSheet(_ record: SnapshotSessionRecord) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RedeSpace.section) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(s.shortDate(fromISO: record.dateISO))
                        .font(.redeHeadline)
                        .tracking(RedeTracking.headline)
                        .foregroundStyle(Color.redeT1)
                    Overline(text: s.historyDetailSets)
                }
                ForEach(Array(record.exercises.enumerated()), id: \.offset) { _, exercise in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(s.exerciseName(exercise.exerciseId))
                            .font(.redeBody)
                            .foregroundStyle(Color.redeT1)
                        ForEach(Array(exercise.sets.enumerated()), id: \.offset) { setIndex, set in
                            HStack {
                                Text("\(setIndex + 1)")
                                    .font(.redeCaption)
                                    .monospacedDigit()
                                    .foregroundStyle(Color.redeT4)
                                    .frame(width: 18, alignment: .leading)
                                Text(s.historySetLine(kg: s.formatKg(set.weightKg), reps: set.reps))
                                    .font(.redeBody)
                                    .monospacedDigit()
                                    .foregroundStyle(Color.redeT2)
                                Spacer()
                            }
                        }
                    }
                }
            }
            .padding(RedeSpace.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.redeRaised)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - 数据质量（FR-PR4；原型未画——保守样式；修正入口随 M5 编辑类写入）

    private func dataQualitySection(_ quality: DataQualityReport) -> some View {
        let dropped = quality.droppedSessionCount + quality.droppedExerciseCount + quality.droppedSetCount
        return VStack(alignment: .leading, spacing: 8) {
            Overline(text: s.dataQualityTitle)
            ForEach(Array(quality.suspectSets.prefix(3).enumerated()), id: \.offset) { _, suspect in
                Text(suspectLine(suspect))
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
            }
            if dropped > 0 {
                Text(s.droppedRecordsLine(dropped))
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
            }
        }
    }

    private func suspectLine(_ suspect: DataQualityReport.SuspectSet) -> String {
        switch suspect.reason {
        case .repsImplausiblyHigh:
            return s.suspectRepsLine(
                dateISO: suspect.dateISO, lift: s.exerciseName(suspect.exerciseId),
                setIndex: suspect.setIndex, reps: suspect.reps
            )
        case .weightFarAboveOwnHistory, .weightBeyondPlausibleCeiling:
            return s.suspectWeightLine(
                dateISO: suspect.dateISO, lift: s.exerciseName(suspect.exerciseId),
                setIndex: suspect.setIndex, kg: s.formatKg(suspect.weightKg)
            )
        }
    }
}

// SnapshotSessionRecord 作 sheet(item:) 标识（id 即 session id）
extension SnapshotSessionRecord: @retroactive Identifiable {}

// Cycle 折线（原型 SVG 形态）：单色 polyline，唯一 ember 实心点标最高值 + 数值标签
private struct TrendChart: View {
    let points: [CGFloat]
    let emberIndex: Int
    let emberLabel: String

    var body: some View {
        Canvas { context, size in
            guard points.count >= 2 else { return }
            let W = size.width
            let H = size.height
            let maxV = max(points.max() ?? 1, 1)
            let minV = points.min() ?? 0
            let span = max(maxV - minV, 1)
            func xs(_ i: Int) -> CGFloat { 12 + CGFloat(i) * (W - 24) / CGFloat(points.count - 1) }
            func ys(_ v: CGFloat) -> CGFloat { H - 24 - (v - minV) / span * (H - 48) }

            var line = Path()
            for (i, p) in points.enumerated() {
                let point = CGPoint(x: xs(i), y: ys(p))
                if i == 0 { line.move(to: point) } else { line.addLine(to: point) }
            }
            context.stroke(line, with: .color(.redeNeu), style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))

            let dx = xs(emberIndex), dy = ys(points[emberIndex])
            context.fill(Path(ellipseIn: CGRect(x: dx - 4.5, y: dy - 4.5, width: 9, height: 9)), with: .color(.redeEmber))
            context.draw(
                Text(emberLabel).font(.system(size: 11)).foregroundColor(.redeEmber2),
                at: CGPoint(x: min(max(dx, 18), W - 18), y: dy - 16)
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
