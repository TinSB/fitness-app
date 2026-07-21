import RedeDataHealth
import RedeLocalSnapshot
import SwiftUI
import RedeL10n

// Progress — M4-3 接引擎真数据（原型 rede-app.html #s-progress 骨架不变：
// seg 三尺度 + HERO 判断句 + 单色图唯一 ember + caption）。
// 诚实化调整（产品原则 6 > 原型完全一致，留痕 DEV_LOG）：
// · Week 柱图改「按周训练量」（动作目录无肌群权重，按肌群不可诚实）→ 人形图不上；
// · Cycle 折线 = 关键动作真 e1RM 趋势，ember 标最高点（MVP 无训练块/计划减载模型）；
// · Development 肌群等级块（FR-PR6）已解封（MLE 批次 B3 2026-07-07）——引擎接真实
//   数据（B1 喂数/B2 记忆），原「不给用户看编造数据」的封印理由消除；
// · 新增 历史（FR-PR1）与 数据质量（FR-PR4）区块：原型未画，取保守样式。
// 判断全部来自包内（投影/趋势/周对比/质量），本层只渲染。

private enum ScaleKind: Hashable {
    case session, week, cycle
}

enum ProgressScrollTarget: Hashable {
    case dataQuality
}

struct ProgressTabView: View {
    /// M2 空态承接（§12.5）：空态主按钮回今日开训（跨 tab；由 RootTabView 切 selection）。
    let onGoToday: () -> Void
    @Binding private var scrollTarget: ProgressScrollTarget?

    init(
        onGoToday: @escaping () -> Void = {},
        scrollTarget: Binding<ProgressScrollTarget?> = .constant(nil)
    ) {
        self.onGoToday = onGoToday
        _scrollTarget = scrollTarget
    }

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
    /// MLE 分享卡预览（B5：Development 块入口 → 现算 projection → 预览 sheet）。
    @State private var muscleSharePreview: SharePreviewItem?
    /// FR-PR6 肌群详情页（钻取层 2026-07-09：行内展开升级为详情 sheet——
    /// 子肌群等级/依据/未来趋势图的承载页；§6.5.11 解释入口）。
    @State private var muscleDetail: MuscleDetailItem?
    /// 点历史行进详情的触感脉冲（单调自增）——不绑 detailRecord?.id：那是 .sheet(item:) 会回落 nil 的
    /// 呈现态，关 sheet 时 id→nil 会幽灵多震一次（审查确认）。只在「打开」自增 → 关闭不误触。
    @State private var historyOpenPulse = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        ScrollViewReader { proxy in
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
            // .task 自动在视图消失时取消、重现时重跑——杜绝 .onAppear{Task{}} 的无结构化并发
            //（多次进出页并发 Task 乱序完成会用过期数据覆盖 outcome，审计 MAJOR）。
            .task { outcome = await ProgressModel.loadOutcomeAsync() }
            .sheet(item: $detailRecord) { record in
                historyDetailSheet(record)
            }
            .sheet(item: $muscleSharePreview) { item in
                ShareCardPreviewView(snapshots: item.snapshots)
            }
            .sheet(item: $muscleDetail) { item in
                MuscleDetailSheet(item: item)
            }
            .onChange(of: outcome != nil) {
                // 截图钩子（沿 -progressScale 先例）：-openMuscleDetail <raw> 数据就绪后自动开详情
                guard case .ready(let model) = outcome else { return }
                let args = ProcessInfo.processInfo.arguments
                if let idx = args.firstIndex(of: "-openMuscleDetail"), args.indices.contains(idx + 1) {
                    openMuscleDetail(args[idx + 1], model: model)
                }
                // 截图钩子：-progressScrollTo <锚点> 数据就绪后滚到区块（development/
                // milestones/continuity/history——下折叠线区块无法交互滚动时的审计通道）
                if let idx = args.firstIndex(of: "-progressScrollTo"), args.indices.contains(idx + 1) {
                    let anchor = args[idx + 1]
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        proxy.scrollTo(anchor, anchor: .top)
                    }
                }
                consumeScrollTarget(proxy)
            }
            .onChange(of: scrollTarget) { _, _ in consumeScrollTarget(proxy) }
        }
    }

    private func consumeScrollTarget(_ proxy: ScrollViewProxy) {
        guard outcome != nil, let target = scrollTarget else { return }
        let anchor: String
        switch target {
        case .dataQuality: anchor = "data-quality"
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            proxy.scrollTo(anchor, anchor: .top)
            scrollTarget = nil
        }
    }

    /// 按 rawValue 打开肌群详情 sheet（热力图区块点击 + 截图钩子共用；未知值静默忽略）。
    private func openMuscleDetail(_ raw: String, model: ProgressModel) {
        guard let estimate = model.muscleProfile.estimates.first(where: { $0.muscleId.rawValue == raw })
        else { return }
        muscleDetail = MuscleDetailItem(
            id: estimate.muscleId.rawValue, estimate: estimate,
            subLevels: model.subLevelsByMuscle[estimate.muscleId] ?? [])
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

            // M2 空态结构预告（§12.5）：示意柱勾出「数据会长成什么样」——纯装饰、
            // 明确非数据（redeNeu 低透明、无标签无数值、a11y 隐藏）；柱下一行 caption
            // 说明防「骨架屏/加载失败」误读（审查 MAJOR）。空屏变「预告 + 承接」。
            VStack(alignment: .leading, spacing: 10) {
                emptyStatePreviewBars
                Text(s.progressEmptyPreviewHint)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, RedeSpace.section)

            EmbButton(icon: "arrow.left", title: s.trainEmptyAction, action: onGoToday)
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, RedeSpace.section)

            // 历史为空但存在坏数据时仍要诚实提示（如整库损坏后部分丢弃）
            if model.quality.hasFindings {
                dataQualitySection(model.quality)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)
                    .id("data-quality")
            }
        }
    }

    /// 空态示意柱：五槽错落（固定比例，确定性），同真柱几何但一律中性灰、显著降透明。
    private var emptyStatePreviewBars: some View {
        HStack(alignment: .bottom, spacing: 11) {
            ForEach(Array([0.35, 0.55, 0.45, 0.7, 0.6].enumerated()), id: \.offset) { _, fraction in
                UnevenRoundedRectangle(topLeadingRadius: 3, topTrailingRadius: 3)
                    .fill(Color.redeNeu.opacity(0.35))
                    .frame(height: max(8, fraction * 96))
                    .frame(maxWidth: 40)          // 同真柱几何（柱宽上限，审计 2026-07-13）
                    .frame(maxWidth: .infinity)   // 槽位仍均分、柱居中
            }
        }
        .frame(height: 96, alignment: .bottom)
        .frame(maxWidth: .infinity)
        .accessibilityHidden(true)
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
                    // 图例行退役（进度页审计 2026-07-13）：单序列图不配「橙色标出…」
                    // 教学小字——当前柱的日期标签已橙、PR 已浮标，图自解释；柱的完整
                    // 读数在每柱 accessibilityLabel 里。
                    VStack(alignment: .leading, spacing: 14) {
                        Overline(text: view.chartTitle)
                        if let bars = view.bars {
                            barChart(bars)
                        }
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)
                }
            }
            .id(scale)
            .transition(reduceMotion ? .identity : .opacity)

            // FR-PR6 肌群发展等级（MLE B3 解封）：引擎已接真实数据（B1/B2），
            // 不再是「编造数据」——头注的封印理由已消除。判断全部在包内，此层只渲染。
            RuleDivider()

            developmentSection(model)
                .padding(.horizontal, RedeSpace.page)
                .id("development")   // -progressScrollTo 锚点

            // FR-PR7 力量里程碑（实测达成；杠铃配片阈值）——非空才显示，含前导分隔线。
            if !model.milestones.isEmpty {
                RuleDivider()

                milestonesSection(model)
                    .padding(.horizontal, RedeSpace.page)
                    .id("milestones")   // -progressScrollTo 锚点
            }

            // 连续性段（含其前导分隔线）随 continuity 一同存在/消失，避免 nil 时双分隔线黏合（审查 MINOR-1）。
            if let month = model.continuity {
                RuleDivider()

                continuitySection(month)
                    .padding(.horizontal, RedeSpace.page)
                    .id("continuity")   // -progressScrollTo 锚点
            }

            RuleDivider()

            historySection(model)
                .padding(.horizontal, RedeSpace.page)
                .id("history")   // -progressScrollTo 锚点

            if model.quality.hasFindings {
                dataQualitySection(model.quality)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)
                    .id("data-quality")
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
    }

    private func scaleView(_ model: ProgressModel) -> ScaleView {
        switch scale {
        case .session: return sessionScale(model)
        case .week: return weekScale(model)
        case .cycle: return cycleScale(model)
        }
    }

    /// 柱图窗口容量（单次/周尺度同窗）。柱数不足时 barChart 补透明幽灵槽——
    /// 均分布局下唯一柱会独占全图宽渲染成一整块色块（T4 2026-07-05）。
    private static let barChartWindow = 5

    private func sessionScale(_ model: ProgressModel) -> ScaleView {
        let latest = model.snapshot.history[0]
        let record = model.statsRecords.first { $0.id == latest.sessionId }
        let volumes: [(id: String, volume: Double)] = (record?.exercises ?? []).map { exercise in
            (exercise.exerciseId, exercise.sets.reduce(0) { $0 + $1.weightKg * Double($1.reps) })
        }
        let shown = Array(volumes.prefix(Self.barChartWindow))
        let maxVolume = max(shown.map(\.volume).max() ?? 1, 1)
        let prSet = Set(latest.prExerciseIds)
        let bars = shown.map { item -> (label: String, fraction: CGFloat, tag: String?, ember: Bool, a11y: String) in
            let name = localeStore.exerciseName(item.id)
            let isPR = prSet.contains(item.id)
            return (label: name,
             fraction: CGFloat(item.volume / maxVolume),
             tag: isPR ? s.historyPRBadge : nil,
             ember: isPR,
             a11y: s.a11yChartBar(name, "\(s.formatVolumeKg(item.volume)) \(s.unitLabel)", pr: isPR))
        }

        let verdict: String
        if let firstPR = latest.prExerciseIds.first {
            verdict = s.sessionVerdictPR(localeStore.exerciseName(firstPR))
        } else {
            verdict = s.sessionVerdictDone
        }
        var sub = s.historyRowMeta(sets: latest.setCount, volumeKg: s.formatVolumeKg(latest.totalVolumeKg))
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
            bars: bars, trend: nil
        )
    }

    private func weekScale(_ model: ProgressModel) -> ScaleView {
        let weeks = model.snapshot.weeklyVolume // 新→旧
        let latest = weeks[0]
        let shown = Array(weeks.prefix(Self.barChartWindow)).reversed() // 旧→新（左→右）
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
                    a11y: s.a11yChartBar(label, s.historyRowMeta(sets: week.setCount, volumeKg: s.formatVolumeKg(week.totalVolumeKg))))
        }

        let verdictCode: String
        let sub: String
        switch model.weeklyComparison {
        case .vsPreviousWeek(let delta)?:
            verdictCode = delta > 0 ? "up" : (delta < 0 ? "down" : "level")
            sub = s.weekSubCompared(deltaPercent: delta, sets: latest.setCount, volumeKg: s.formatVolumeKg(latest.totalVolumeKg))
        case .currentWeekInProgress?:
            verdictCode = "inProgress"
            sub = s.weekSubInProgress(sets: latest.setCount, volumeKg: s.formatVolumeKg(latest.totalVolumeKg))
        case .previousWeekMissing?:
            verdictCode = "gap"
            sub = s.weekSubGapWeek(sets: latest.setCount, volumeKg: s.formatVolumeKg(latest.totalVolumeKg))
        default:
            verdictCode = "first"
            sub = s.weekSubFirstWeek(sets: latest.setCount, volumeKg: s.formatVolumeKg(latest.totalVolumeKg))
        }

        return ScaleView(
            verdict: s.weekVerdict(verdictCode),
            sub: sub,
            chartTitle: s.weekChartTitleByWeek,
            bars: bars, trend: nil
        )
    }

    private func cycleScale(_ model: ProgressModel) -> ScaleView {
        guard let key = model.keyTrend, let assessment = model.trendAssessment else {
            // history 非空时必有趋势；防御兜底走校准文案
            return ScaleView(
                verdict: s.trendVerdict(call: "calibrating", liftName: ""),
                sub: s.trendSub(call: "calibrating", sessions: 0, deltaKg: "0"),
                chartTitle: s.cycleChartTitleFor("—"), bars: nil, trend: nil
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
            trend: nil
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
        // 「估算 1RM」口径在标题声明一次（审计 2026-07-13）——替代每行重复副标
        //（T2 排期折叠同款）；末行不画 hairline（下方就是 RuleDivider，防双线黏合）。
        return VStack(alignment: .leading, spacing: 14) {
            Overline(text: s.cycleTrendTitle)
            VStack(alignment: .leading, spacing: 0) {
                // id 用 exerciseId（审查 [2]）：bestWeightKg 并列时 offset 会致行错位/闪烁
                ForEach(Array(trends.enumerated()), id: \.element.exerciseId) { index, trend in
                    trendRow(trend, isLast: index == trends.count - 1)
                }
            }
        }
    }

    private func trendRow(_ trend: ProgressSnapshot.ExerciseTrend, isLast: Bool) -> some View {
        let values = trend.points.map { CGFloat($0.e1RmKg) }
        let delta = trend.latestE1RmKg - (trend.points.first?.e1RmKg ?? trend.latestE1RmKg)
        return VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text(localeStore.exerciseName(trend.exerciseId))
                    .font(.redeSubhead).foregroundStyle(Color.redeT1)
                Spacer()
                MiniSparkline(values: values).frame(width: 80, height: 26)
                VStack(alignment: .trailing, spacing: 3) {
                    Text("\(s.formatE1Rm(trend.latestE1RmKg)) \(s.unitLabel)")
                        .font(.redeCallout).monospacedDigit().foregroundStyle(Color.redeT2)
                    deltaLabel(delta)
                }
            }
            .padding(.vertical, 12)
            // 折线图无语义；把整行合成一条可读元素（动作名·最新值·升降），折线静默
            .accessibilityElement(children: .combine)
            if !isLast {
                Rectangle().fill(Color.redeHair2).frame(height: 1)
            }
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
                        // 柱宽上限（审计 2026-07-13）：等分槽内居中、不再满槽填充——
                        // 62pt 满宽砖块 → 柱形（Apple Health 柱:距比例口径）
                        .frame(maxWidth: 40)
                    Overline(text: bar.label, color: bar.ember ? .redeEmber2 : .redeT4)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, alignment: .bottom)
                // 每根柱合成一条读数（标签·原始值[·PR]），替代不可读的归一化柱形
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(bar.a11y)
            }
            // 幽灵槽：柱数不足窗口时按满窗均分补透明占位（真柱靠左、宽度恒定），
            // 单柱不再独占全图宽（T4）。装饰性留白，无障碍不朗读。
            ForEach(0..<max(0, Self.barChartWindow - bars.count), id: \.self) { _ in
                Color.clear
                    .frame(maxWidth: .infinity)
                    .frame(height: 1)
                    .accessibilityHidden(true)
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

    // MARK: - 肌群发展等级（FR-PR6；card-free，0-card 预算；MLE B3 解封）
    // §6.5.9 冷启动：全员校准=一句校准文案（不列 10 行灰——空态克制）；部分解锁=
    // 解锁行亮 + 其余折叠一行。§6.5.11：置信度零读数（行为表达）；maintain 无标签
    // （标签只给 prioritize/recover——批次执行中对交接件原稿的收敛，交接件已同步，
    // 收口写回 §6.5.11）；MLE 里程碑徽标不在此重复渲染（下方 FR-PR7 区块已是里程碑
    // 面，floor 影响由展开依据行 milestoneFloorApplied 表达——同为执行中收敛）；
    // 点行展开 evidence/limitation 人话=解释入口。判断全在包内，此层只渲染。

    private func developmentSection(_ model: ProgressModel) -> some View {
        let profile = model.muscleProfile
        let unlocked = profile.estimates
            .filter { $0.decision != .insufficientData }
            .sorted {
                $0.currentLevel != $1.currentLevel
                    ? $0.currentLevel > $1.currentLevel
                    : $0.muscleId.rawValue < $1.muscleId.rawValue
            }
        let calibratingCount = profile.estimates.count - unlocked.count
        return VStack(alignment: .leading, spacing: 14) {
            Overline(text: s.developmentTitle)

            if unlocked.isEmpty {
                Text(s.developmentCalibratingBody)
                    .font(.redeBody)
                    .lineSpacing(14 * 0.45)
                    .foregroundStyle(Color.redeT3)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(s.developmentTierLabel)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT3)
                    Text(tierDisplayName(profile.overallTier))
                        .font(.redeBody.weight(.semibold))
                        .foregroundStyle(Color.redeT1)
                    Spacer()
                    if let balance = profile.balanceScore {
                        Text(s.developmentBalanceLine(Int(balance.rounded())))
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT3)
                    }
                }
                .accessibilityElement(children: .combine)

                // 人形肌群热力图（批次 G N1，v2 造型：人体剪影+曲线板块）：前/后人形按
                // 等级着色，点区块进详情——文字行的入口增强不替换（信息完整性）；
                // 校准中区块=描边态不可点
                MuscleHeatmapView(
                    states: Dictionary(uniqueKeysWithValues: profile.estimates.map { estimate in
                        (estimate.muscleId.rawValue,
                         HeatmapMuscleState(level: estimate.decision == .insufficientData
                             ? nil : estimate.currentLevel))
                    }),
                    onTap: { raw in openMuscleDetail(raw, model: model) }
                )
                .frame(height: 240)
                .padding(.vertical, 4)

                // 行间距 0：行自身 44pt 命中高（HIG 最小命中区，审计 2026-07-13）——
                // 密度与历史区行一致，不再靠 section 的 spacing 14 拉开
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(unlocked, id: \.muscleId.rawValue) { estimate in
                        developmentRow(estimate, subLevels: model.subLevelsByMuscle[estimate.muscleId] ?? [])
                    }
                }

                if calibratingCount > 0 {
                    Text(s.developmentRemainingCalibrating(calibratingCount))
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                        .padding(.top, 2)
                }

                // 分享入口（B5）：沿 Development 块行样式（ember2 + chevron 披露），非练完态按钮复刻（审查 m2 措辞校准）
                Button {
                    muscleSharePreview = SharePreviewItem(
                        snapshots: [Self.muscleLevelShareSnapshot(from: profile)])
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "square.and.arrow.up").font(.redeCaption)
                        Text(s.developmentShareAction)
                        Spacer()
                        Image(systemName: "chevron.right").font(.redeCaption).foregroundStyle(Color.redeT4)
                    }
                    .font(.redeCallout)
                    .foregroundStyle(Color.redeEmber2)
                    .frame(minHeight: RedeShape.controlHeight)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Development 块 → 分享快照（组合层：只传已解锁行；tier 校准中不出卡——
    /// 「还没有整体级别」不是可分享成绩；隐私守门在 SharePrivacyFilter）。
    static func muscleLevelShareSnapshot(from profile: MuscleDevelopmentProfile) -> ShareSnapshot {
        let rows = profile.estimates
            .filter { $0.decision != .insufficientData }
            .map { ShareSnapshot.MuscleLevel.MuscleRow(
                muscleRaw: $0.muscleId.rawValue, level: $0.currentLevel,
                trendRaw: $0.trend.rawValue) }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = .current
        fmt.dateFormat = "yyyy-MM-dd"
        return SharePrivacyFilter.muscleLevel(
            generatedDateISO: fmt.string(from: Date()),
            tierRaw: profile.overallTier == .calibrating ? nil : profile.overallTier.rawValue,
            balanceScore: profile.balanceScore,
            muscles: rows)
    }

    private func developmentRow(_ estimate: MuscleLevelEstimate, subLevels: [MuscleSubLevel]) -> some View {
        let muscleRaw = estimate.muscleId.rawValue
        let name = MuscleGroupLabel(rawValue: muscleRaw).map(s.muscleGroupName) ?? muscleRaw
        let decisionLabel: String?
        switch estimate.decision {
        case .prioritize: decisionLabel = s.muscleDecisionLabel(.prioritize)
        case .recover:
            // detraining 触发的 recover=「只是没练」，不冒充伤病/超量信号（审查 M7）
            decisionLabel = estimate.trend == .detraining
                ? s.muscleDecisionEaseBackIn : s.muscleDecisionLabel(.recover)
        default: decisionLabel = nil
        }
        // 钻取层（2026-07-09）：行内展开退役，点行进详情 sheet（子肌群等级/依据/未来趋势图）
        return Button {
            muscleDetail = MuscleDetailItem(id: muscleRaw, estimate: estimate, subLevels: subLevels)
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(name)
                    .font(.redeBody)
                    .foregroundStyle(Color.redeT1)
                Text(s.developmentLevel(estimate.currentLevel))
                    .font(.redeBody.weight(.semibold))
                    .foregroundStyle(Color.redeEmber2)
                if estimate.trend == .rising {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.redeEmber2)
                } else if estimate.trend == .declining {
                    Image(systemName: "arrow.down.right")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.redeT3)
                }
                if let decisionLabel {
                    Text("· \(decisionLabel)")
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                }
                Spacer(minLength: 12)
                // Lv 内进度（抬底命中时引擎已置 0——「刚进入此级」如实从零）
                // 0.28：0 进度时空轨道仍可见（审计 2026-07-13——0.18 在 base 底上
                // 近隐形，「刚进入此级」的行看着像坏了）
                Capsule()
                    .fill(Color.redeT3.opacity(0.28))
                    .frame(width: 64, height: 4)
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(Color.redeEmber)
                            .frame(width: 64 * min(max(estimate.levelProgress, 0), 1), height: 4)
                    }
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color.redeT4)
            }
            .frame(minHeight: 44)   // HIG 最小命中区（审计 2026-07-13：原内容高 ~20pt）
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(s.developmentRowA11y(muscle: name, level: estimate.currentLevel,
                                                 decision: decisionLabel))
        .accessibilityHint(s.developmentExpandHint)
    }

    private func tierDisplayName(_ tier: TrainingTier) -> String {
        TrainingTierLabel(rawValue: tier.rawValue).map(s.trainingTierName) ?? tier.rawValue
    }

    // MARK: - 力量里程碑（FR-PR7；card-free，0-card 预算；实测达成的杠铃配片阈值）

    /// 同动作合并行（owner 拍板 2026-07-14）：实测与估算两条并成一行——「深蹲 135 lb ·
    /// 估算 225 lb」，不再上下两行重复动作名。引擎契约保证估算仅在严格高于实测档时
    /// 产出（StrengthMilestoneCatalog 头注），合并展示不损失信息。
    private struct MilestoneRowItem {
        let exerciseId: String
        var measured: StrengthMilestone?
        var estimated: StrengthMilestone?
    }

    private func milestoneRows(_ milestones: [StrengthMilestone]) -> [MilestoneRowItem] {
        var order: [String] = []
        var byExercise: [String: MilestoneRowItem] = [:]
        for milestone in milestones {
            if byExercise[milestone.exerciseId] == nil {
                order.append(milestone.exerciseId)
                byExercise[milestone.exerciseId] = MilestoneRowItem(exerciseId: milestone.exerciseId)
            }
            if milestone.isEstimated {
                byExercise[milestone.exerciseId]?.estimated = milestone
            } else {
                byExercise[milestone.exerciseId]?.measured = milestone
            }
        }
        return order.compactMap { byExercise[$0] }
    }

    private func milestonesSection(_ model: ProgressModel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Overline(text: s.milestonesTitle)
            ForEach(milestoneRows(model.milestones), id: \.exerciseId) { row in
                let name = localeStore.exerciseName(row.exerciseId)
                let measuredValue = row.measured.map { "\($0.achievedThreshold) \($0.unitLabel)" }
                let estimatedValue = row.estimated.map { "\($0.achievedThreshold) \($0.unitLabel)" }
                HStack(spacing: 8) {
                    Text(name)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT2)
                    // 纯估算行保留「估算」前置微标——不冒充实测（FR-PR7 诚信红线）；
                    // 实测+估算合并行的估算值自带「估算」前缀，不再重复微标。
                    if measuredValue == nil {
                        Text(s.milestoneEstimatedBadge)
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT4)
                    }
                    Spacer()
                    // 实测 = ember 成就口音；估算 = 降一档中性，视觉上不与实测争辉。
                    if let measuredValue {
                        Text(measuredValue)
                            .font(.redeCallout).monospacedDigit()
                            .foregroundStyle(Color.redeEmber2)
                    }
                    if let estimatedValue {
                        Text(measuredValue == nil
                             ? estimatedValue
                             : "· \(s.milestoneEstimatedBadge) \(estimatedValue)")
                            .font(.redeCallout).monospacedDigit()
                            .foregroundStyle(Color.redeT3)
                    }
                }
                .padding(.vertical, 6)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(milestoneRowA11y(name: name, measured: measuredValue,
                                                     estimated: estimatedValue))
            }
        }
    }

    private func milestoneRowA11y(name: String, measured: String?, estimated: String?) -> String {
        if let measured, let estimated {
            return s.milestoneCombinedA11y(lift: name, measured: measured, estimated: estimated)
        }
        if let measured { return s.milestoneA11y(lift: name, value: measured) }
        return s.milestoneA11y(lift: name, value: estimated ?? "", estimated: true)
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
                        Text(s.historyRowMeta(sets: entry.setCount, volumeKg: s.formatVolumeKg(entry.totalVolumeKg)))
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

// MiniSparkline 已提取到 RedeComponents.swift（N3b，2026-07-14）：周期趋势清单与今日页
// 练完态总结卡两处共用。

#Preview {
    ProgressTabView()
        .environment(LocaleStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
