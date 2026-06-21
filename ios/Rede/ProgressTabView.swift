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
    /// 点历史行进详情的触感脉冲（单调自增）——不绑 detailRecord?.id：那是 .sheet(item:) 会回落 nil 的
    /// 呈现态，关 sheet 时 id→nil 会幽灵多震一次（审查确认）。只在「打开」自增 → 关闭不误触。
    @State private var historyOpenPulse = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
            .padding(.bottom, RedeSpace.bottomBar)
        }
        .background(Color.redeBase)
        .sensoryFeedback(.selection, trigger: scale)             // 尺度切换 = 轻选择确认
        .sensoryFeedback(.selection, trigger: historyOpenPulse)  // 点历史行进详情 = 轻选择（仅开启时）
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
            // 整面板（2026-06-11）：通用 seg 凹盒升级机加工凹槽（与设置面板同工艺）
            SegControl(options: segOptions, selection: segSelection, machined: true)
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 16)

            // 尺度切换 = 整块交叉淡入（治"硬跳"）：HERO 判断句 + 图表/趋势随 scale 一起换。
            // .id(scale) 让换尺度时旧块淡出、新块淡入；动效由 segSelection setter 的 withAnimation 驱动、
            // reduceMotion 守卫。HERO + 图表合一个块，保证两者同步过渡、不各自闪。
            VStack(alignment: .leading, spacing: 0) {
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

                // 周期尺度（2026-06-15 重做）：多主项 e1RM 趋势清单（小折线 + 升降），
                // 替代原单主项大折线；单次/本周仍走柱图。
                if scale == .cycle {
                    cycleTrendList(model)
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, RedeSpace.section)
                } else {
                    VStack(alignment: .leading, spacing: 14) {
                        Overline(text: view.chartTitle)
                        if let bars = view.bars {
                            barChart(bars)
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
                }
            }
            .id(scale)
            .transition(reduceMotion ? .identity : .opacity)

            // FR-PR7 力量里程碑（实测达成；杠铃配片阈值）——非空才显示，含前导分隔线。
            if !model.milestones.isEmpty {
                RuleDivider()

                milestonesSection(model)
                    .padding(.horizontal, RedeSpace.page)
            }

            // 连续性段（含其前导分隔线）随 continuity 一同存在/消失，避免 nil 时双分隔线黏合（审查 MINOR-1）。
            if let month = model.continuity {
                RuleDivider()

                continuitySection(month)
                    .padding(.horizontal, RedeSpace.page)
            }

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
        let bars: [(label: String, fraction: CGFloat, tag: String?, ember: Bool, a11y: String)]?
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
        let bars = shown.map { item -> (label: String, fraction: CGFloat, tag: String?, ember: Bool, a11y: String) in
            let name = localeStore.exerciseName(item.id)
            let isPR = prSet.contains(item.id)
            return (label: name,
             fraction: CGFloat(item.volume / maxVolume),
             tag: isPR ? s.historyPRBadge : nil,
             ember: isPR,
             a11y: s.a11yChartBar(name, "\(s.formatKg(item.volume)) \(s.unitLabel)", pr: isPR))
        }

        let verdict: String
        let caption: String
        if let firstPR = latest.prExerciseIds.first {
            verdict = s.sessionVerdictPR(localeStore.exerciseName(firstPR))
            caption = s.sessionCaptionPR(localeStore.exerciseName(firstPR))
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
                lift: localeStore.exerciseName(top.exerciseId),
                kg: LoadDisplay.weight(top.weightKg, exerciseId: top.exerciseId, s),
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

        let bars = shown.map { week -> (label: String, fraction: CGFloat, tag: String?, ember: Bool, a11y: String) in
            let isCurrent = week.weekStartISO == latest.weekStartISO
            let tag: String? = isCurrent
                ? deltaPercent.map { "\($0 >= 0 ? "+" : "−")\(abs($0))%" }
                : nil
            let label = s.weekBarLabel(fromISO: week.weekStartISO)
            return (label: label,
                    fraction: CGFloat(week.totalVolumeKg / maxVolume),
                    tag: tag,
                    ember: isCurrent,
                    a11y: s.a11yChartBar(label, s.historyRowMeta(sets: week.setCount, volumeKg: s.formatKg(week.totalVolumeKg))))
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
        let name = localeStore.exerciseName(key.exerciseId)
        let call: String
        switch assessment.call {
        case .up: call = "up"
        case .down: call = "down"
        case .flat: call = "flat"
        case .calibrating: call = "calibrating"
        }
        // 周期改多主项清单后，单主项 trend 字段不再渲染（审查 [1]）：只产 verdict/sub，
        // 不再构造 points[emberIndex]（去死计算 + 潜在越界前体）。
        return ScaleView(
            verdict: s.trendVerdict(call: call, liftName: name),
            sub: s.trendSub(
                call: call,
                sessions: assessment.windowSessionCount,
                deltaKg: s.formatE1Rm(abs(assessment.deltaKg))
            ),
            chartTitle: s.cycleChartTitleFor(name),
            bars: nil,
            trend: nil,
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
                // 尺度切换裹 withAnimation 驱动 content 块的交叉淡入（reduceMotion 守卫）。
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) {
                    if newValue == s.scaleSession { scale = .session }
                    else if newValue == s.scaleWeek { scale = .week }
                    else { scale = .cycle }
                }
            }
        )
    }

    // MARK: - 周期：多主项趋势清单（密而干净，2026-06-15）

    private func cycleTrendList(_ model: ProgressModel) -> some View {
        // 重的主项排前；取 ≤6 条，避免长尾配件刷屏
        let trends = Array(
            model.snapshot.exerciseTrends
                .sorted { $0.bestWeightKg > $1.bestWeightKg }
                .prefix(6)
        )
        return VStack(alignment: .leading, spacing: 0) {
            // id 用 exerciseId（审查 [2]）：bestWeightKg 并列时 offset 会致行错位/闪烁
            ForEach(trends, id: \.exerciseId) { trend in
                trendRow(trend)
            }
        }
    }

    private func trendRow(_ trend: ProgressSnapshot.ExerciseTrend) -> some View {
        let values = trend.points.map { CGFloat($0.e1RmKg) }
        let delta = trend.latestE1RmKg - (trend.points.first?.e1RmKg ?? trend.latestE1RmKg)
        return VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(localeStore.exerciseName(trend.exerciseId))
                        .font(.redeSubhead).foregroundStyle(Color.redeT1)
                    Text(s.estimated1RM).font(.redeCaption).foregroundStyle(Color.redeT4)
                }
                Spacer()
                MiniSparkline(values: values).frame(width: 80, height: 26)
                VStack(alignment: .trailing, spacing: 3) {
                    Text("\(s.formatE1Rm(trend.latestE1RmKg)) \(s.unitLabel)")
                        .font(.redeCallout).monospacedDigit().foregroundStyle(Color.redeT2)
                    deltaLabel(delta)
                }
            }
            .padding(.vertical, 11)
            // 折线图无语义；把整行合成一条可读元素（动作名·估算1RM·最新值·升降），折线静默
            .accessibilityElement(children: .combine)
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
    }

    @ViewBuilder
    private func deltaLabel(_ delta: Double) -> some View {
        if delta > 0.5 {
            // 选项 C（owner 拍板）：橙 = 正向进步（ember 守"进展/下一步"纪律）。
            Text("\(Image(systemName: "arrow.up")) \(s.formatE1Rm(delta))").font(.redeCaption).monospacedDigit().foregroundStyle(Color.redeEmber)
        } else if delta < -0.5 {
            // 回调用中性灰、不报警不羞辱（不用橙、不用红绿灯语义色）。
            Text("\(Image(systemName: "arrow.down")) \(s.formatE1Rm(abs(delta)))").font(.redeCaption).monospacedDigit().foregroundStyle(Color.redeT3)
        } else {
            Text(s.holdShort).font(.redeCaption).foregroundStyle(Color.redeT4)
        }
    }

    // MARK: - 柱图（原型形态：120pt 区、唯一 ember、标签浮顶）

    private func barChart(_ bars: [(label: String, fraction: CGFloat, tag: String?, ember: Bool, a11y: String)]) -> some View {
        // 仅当有 PR 标签时才预留顶部标签头位（offset -19 的浮标）；无标签时去掉那 27pt 死空间。
        let hasTag = bars.contains { $0.tag != nil }
        return HStack(alignment: .bottom, spacing: 11) {
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
                        .frame(height: max(8, bar.fraction * 96)) // 柱区高 96（hasTag 时容器额外预留 27pt 给浮标头位）
                        .frame(maxWidth: .infinity)
                    Overline(text: bar.label, color: bar.ember ? .redeEmber2 : .redeT4)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, alignment: .bottom)
                // 每根柱合成一条读数（标签·原始值[·PR]），替代不可读的归一化柱形
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(bar.a11y)
            }
        }
        .frame(height: 120 + (hasTag ? 27 : 0), alignment: .bottom)
        .frame(maxWidth: .infinity)
    }

    // MARK: - 连续性月历（FR-PR5；card-free，守 ProgressTabView 0-card 预算；中性，不羞辱断签）

    private func continuitySection(_ month: ContinuityCalendar.Month) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Overline(text: s.continuityTitle)
                Spacer()
                Text(s.calendarMonthLabel(year: month.year, month: month.month))
                    .font(.redeCaption).monospacedDigit()
                    .foregroundStyle(Color.redeT4)
            }
            HStack(spacing: 0) {
                ForEach(Array(s.weekdayInitialsMonFirst.enumerated()), id: \.offset) { _, initial in
                    Text(initial)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT4)
                        .frame(maxWidth: .infinity)
                }
            }
            .accessibilityHidden(true)
            VStack(spacing: 7) {
                ForEach(Array(month.weeks.enumerated()), id: \.offset) { _, week in
                    HStack(spacing: 0) {
                        ForEach(Array(week.enumerated()), id: \.offset) { _, day in
                            dayCell(day).frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            Text(s.continuityCount(month.trainedCount))
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
        }
    }

    /// 单格：训练日 = 余烬实心 + 深色日号；今天 = 描边圈；空格 = 透明占位。
    /// 训练优先：当某天既是今天又是训练日，显示余烬实心、不叠描边圈（行为有 ContinuityCalendarTests 守着）。
    @ViewBuilder
    private func dayCell(_ day: ContinuityCalendar.Day) -> some View {
        if let iso = day.dateISO {
            ZStack {
                if day.isTrained {
                    Circle().fill(Color.redeEmber).frame(width: 26, height: 26)
                } else if day.isToday {
                    Circle().stroke(Color.redeT4, lineWidth: 1).frame(width: 26, height: 26)
                }
                Text(String(Int(iso.suffix(2)) ?? 0))
                    .font(.redeCaption).monospacedDigit()
                    .foregroundStyle(day.isTrained ? Color.redeBase : Color.redeT3)
            }
            .frame(height: 32)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(s.continuityDayA11y(dateISO: iso, trained: day.isTrained))
        } else {
            Color.clear.frame(height: 32)
        }
    }

    // MARK: - 力量里程碑（FR-PR7；card-free，0-card 预算；实测达成的杠铃配片阈值）

    private func milestonesSection(_ model: ProgressModel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Overline(text: s.milestonesTitle)
            // id 用整条（Hashable）——同一动作可能既有实测又有估算两条，不能再用 exerciseId（会重复 id）。
            ForEach(model.milestones, id: \.self) { milestone in
                let value = "\(milestone.achievedThreshold) \(milestone.unitLabel)"
                HStack(spacing: 8) {
                    Text(localeStore.exerciseName(milestone.exerciseId))
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT2)
                    // 估算里程碑明确标「估算」中性微标——不冒充实测（FR-PR7 诚信红线）。
                    if milestone.isEstimated {
                        Text(s.milestoneEstimatedBadge)
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT4)
                    }
                    Spacer()
                    Text(value)
                        .font(.redeCallout).monospacedDigit()
                        // 实测 = ember 成就口音；估算 = 降一档中性，视觉上不与实测争辉。
                        .foregroundStyle(milestone.isEstimated ? Color.redeT3 : Color.redeEmber2)
                }
                .padding(.vertical, 6)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(s.milestoneA11y(lift: localeStore.exerciseName(milestone.exerciseId), value: value, estimated: milestone.isEstimated))
            }
        }
    }

    // MARK: - 历史（FR-PR1；原型未画——保守样式：ov 标题 + 行 + 细分隔线）

    private func historySection(_ model: ProgressModel) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Overline(text: s.historyTitle)
                .padding(.bottom, 8)
            ForEach(Array(model.snapshot.history.prefix(10).enumerated()), id: \.element.sessionId) { index, entry in
                Button {
                    detailRecord = model.records.first { $0.id == entry.sessionId }
                    historyOpenPulse += 1
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
                        // 可点线索：整行可点开当次详情，尾部 chevron 明示（affordance 三件套之一）。
                        Image(systemName: "chevron.right")
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT4)
                            .accessibilityHidden(true) // 装饰性线索；行的可点性已由 Button 表达
                    }
                    .padding(.vertical, 10)
                    .contentShape(Rectangle()) // 整行可点（含 Spacer）+ 按压反馈覆盖全行
                }
                .buttonStyle(.redePressableRow)
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
                        Text(localeStore.exerciseName(exercise.exerciseId))
                            .font(.redeBody)
                            .foregroundStyle(Color.redeT1)
                        ForEach(Array(exercise.sets.enumerated()), id: \.offset) { setIndex, set in
                            HStack {
                                Text("\(setIndex + 1)")
                                    .font(.redeCaption)
                                    .monospacedDigit()
                                    .foregroundStyle(Color.redeT4)
                                    .frame(width: 18, alignment: .leading)
                                Text(s.historySetLine(kg: LoadDisplay.weight(set.weightKg, exerciseId: exercise.exerciseId, s), reps: set.reps))
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
        // 整面板公理（2026-06-11）：sheet = 掀开的 base 锻面；raised 是抬升层语义，不当整面底。
        // 审查 MINOR-3：用 presentationBackground（盖整个 sheet chrome），不是内容 background
        .presentationBackground(Color.redeBase)
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
            // 超 3 条时给溢出提示——与今日「修数据」卡显示的可疑组总数对账（卡说 N 条、这里别只见 3 条）。
            if quality.suspectSets.count > 3 {
                Text(s.suspectMoreLine(quality.suspectSets.count - 3))
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
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
                dateISO: suspect.dateISO, lift: localeStore.exerciseName(suspect.exerciseId),
                setIndex: suspect.setIndex, reps: suspect.reps
            )
        case .weightFarAboveOwnHistory, .weightBeyondPlausibleCeiling:
            return s.suspectWeightLine(
                dateISO: suspect.dateISO, lift: localeStore.exerciseName(suspect.exerciseId),
                setIndex: suspect.setIndex, kg: s.formatKg(suspect.weightKg)
            )
        }
    }
}

// SnapshotSessionRecord 作 sheet(item:) 标识（id 即 session id）
extension SnapshotSessionRecord: @retroactive Identifiable {}

// 行内小折线（周期趋势清单）：单色线 + 余烬橙末点；单点退化为一个点。
private struct MiniSparkline: View {
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

#Preview {
    ProgressTabView()
        .environment(LocaleStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
