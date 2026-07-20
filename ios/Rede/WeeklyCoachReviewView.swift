import Foundation
import SwiftUI
import RedeDataHealth
import RedeDomain
import RedeL10n
import RedeLocalSnapshot
import RedePersistence
import RedeTrainingDecision

// FR-SUB3 Weekly Coach Review app 边界：只读 canonical → 共用 ProgressCoreProjection →
// 上一完整周事实 → 纯决策引擎 → 双语渲染。无缓存、无 seen 状态、无 plan/canonical 写入。

private enum WeeklyCoachReviewScreenState: Equatable {
    case loading
    case ready(WeeklyCoachReviewOutcome)
    case unreadable
}

/// 将 DataHealth 问题诚实归入上一完整周。无法定位日期的 dropped training data
/// 直接返回 nil，使页面进入不可读态；不能静默忽略后继续给出正向判断。
enum WeeklyCoachReviewFindingScope {
    static func count(
        issues: [DataHealthIssue],
        suspectSetDatesISO: [String],
        reviewWeekStartISO: String,
        reviewWeekEndExclusiveISO: String
    ) -> Int? {
        let dropped = issues.filter(\.isDroppedTrainingData)
        guard dropped.allSatisfy({ $0.droppedTrainingDateISO != nil }) else { return nil }

        let droppedInWeek = dropped.filter { issue in
            guard let dateISO = issue.droppedTrainingDateISO else { return false }
            return dateISO >= reviewWeekStartISO && dateISO < reviewWeekEndExclusiveISO
        }.count
        let suspectInWeek = suspectSetDatesISO.filter { dateISO in
            dateISO >= reviewWeekStartISO && dateISO < reviewWeekEndExclusiveISO
        }.count
        return droppedInWeek + suspectInWeek
    }
}

/// TrendAssessment → WeeklyCoachLiftSignal 的唯一映射（2026-07-20 自私有 loader 提炼）。
/// 0kg 假精度防线：校准态 deltaKg 恒为 0（TrendAssessment 合同），若透传会在付费页
/// 渲染成「+0 kg」假结论——calibrating 必须携带 nil，由测试锁死（防线被删测试即红）。
enum WeeklyCoachLiftSignalPolicy {
    static func signal(exerciseId: String, call: TrendCall, deltaKg: Double) -> WeeklyCoachLiftSignal {
        WeeklyCoachLiftSignal(
            exerciseId: exerciseId,
            call: liftCall(call),
            deltaKg: call == .calibrating ? nil : deltaKg
        )
    }

    static func signal(from assessment: TrendAssessment) -> WeeklyCoachLiftSignal {
        signal(
            exerciseId: assessment.exerciseId,
            call: assessment.call,
            deltaKg: assessment.deltaKg
        )
    }

    static func liftCall(_ call: TrendCall) -> WeeklyCoachLiftCall {
        switch call {
        case .up: .up
        case .flat: .flat
        case .down: .down
        case .calibrating: .calibrating
        }
    }
}

/// V2 只重排展示层的事实优先级；typed verdict、evidence 与 action 原样保留。
enum WeeklyCoachReviewMemoPolicy {
    static func spotlightEvidenceIndex(in review: WeeklyCoachReview) -> Int {
        let preferred: ((WeeklyCoachReviewEvidence) -> Bool)
        switch review.verdict {
        case .dataNeedsReview:
            preferred = { if case .dataFindings = $0 { true } else { false } }
        case .rebuildRhythm:
            preferred = { if case .trainingDays = $0 { true } else { false } }
        case .progressing, .holding, .easing:
            preferred = { if case .keyLift = $0 { true } else { false } }
        case .calibrating:
            if let keyLiftIndex = review.evidence.firstIndex(where: {
                if case .keyLift = $0 { true } else { false }
            }) {
                return keyLiftIndex
            }
            preferred = { if case .sessions = $0 { true } else { false } }
        }
        return review.evidence.firstIndex(where: preferred) ?? 0
    }

    static func supportingEvidence(in review: WeeklyCoachReview) -> [WeeklyCoachReviewEvidence] {
        let spotlightIndex = spotlightEvidenceIndex(in: review)
        return Array(review.evidence.enumerated().compactMap { index, evidence in
            index == spotlightIndex ? nil : evidence
        }.prefix(2))
    }
}

struct WeeklyCoachReviewDatePresentation: Equatable {
    let issue: String
    let range: String
}

enum WeeklyCoachReviewDatePolicy {
    static func presentation(
        weekStartISO: String,
        locale: RedeLocale,
        strings: RedeStrings
    ) -> WeeklyCoachReviewDatePresentation {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(secondsFromGMT: 0)
        parser.dateFormat = "yyyy-MM-dd"
        guard let start = parser.date(from: weekStartISO) else {
            return WeeklyCoachReviewDatePresentation(
                issue: strings.weeklyCoachReviewTitle,
                range: weekStartISO
            )
        }

        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        guard let end = calendar.date(byAdding: .day, value: 6, to: start) else {
            return WeeklyCoachReviewDatePresentation(
                issue: strings.weeklyCoachReviewTitle,
                range: weekStartISO
            )
        }
        let week = calendar.component(.weekOfYear, from: start)
        let year = calendar.component(.yearForWeekOfYear, from: start)
        let startCalendarYear = calendar.component(.year, from: start)
        let endCalendarYear = calendar.component(.year, from: end)
        let sameMonth = calendar.component(.month, from: start) == calendar.component(.month, from: end)

        let startFormatter = DateFormatter()
        startFormatter.locale = Locale(identifier: locale == .zh ? "zh_Hans" : "en_US")
        startFormatter.timeZone = calendar.timeZone
        startFormatter.dateFormat = locale == .zh ? "M月d日" : "MMM d"

        let endFormatter = DateFormatter()
        endFormatter.locale = startFormatter.locale
        endFormatter.timeZone = calendar.timeZone
        if sameMonth {
            endFormatter.dateFormat = locale == .zh ? "d日" : "d"
        } else {
            endFormatter.dateFormat = locale == .zh ? "M月d日" : "MMM d"
        }

        let startText = startFormatter.string(from: start)
        let endText = endFormatter.string(from: end)
        let range = if startCalendarYear == endCalendarYear {
            strings.weeklyCoachReviewDateRange(
                startText: startText,
                endText: endText,
                year: year
            )
        } else {
            strings.weeklyCoachReviewCrossYearDateRange(
                startText: startText,
                startYear: startCalendarYear,
                endText: endText,
                endYear: endCalendarYear
            )
        }
        return WeeklyCoachReviewDatePresentation(
            issue: strings.weeklyCoachReviewIssue(weekOfYear: week),
            range: range
        )
    }
}

private enum WeeklyCoachReviewLoader {
    static func loadAsync(
        now: Date = Date(),
        arguments: [String] = ProcessInfo.processInfo.arguments
    ) async -> WeeklyCoachReviewScreenState {
        await Task.detached(priority: .userInitiated) {
            load(now: now, arguments: arguments)
        }.value
    }

    static func load(now: Date, arguments: [String]) -> WeeklyCoachReviewScreenState {
        #if DEBUG
        if let fixture = debugFixture(arguments: arguments) {
            // L3 deterministic UI fixture only. It proves rendering/flow, never StoreKit purchase truth.
            return .ready(fixture)
        }
        #endif

        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        let appData: AppData
        do {
            if let existing = try store.load() {
                appData = existing
            } else if let empty = try? AppData(decoding: .object([
                "schemaVersion": .int(Int64(SchemaVersion.current)),
            ])) {
                appData = empty
            } else {
                return .unreadable
            }
        } catch {
            return .unreadable
        }

        let core = ProgressCoreProjection.build(from: appData)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        let todayISO = formatter.string(from: now)
        guard let facts = WeeklyReviewFactsBuilder.build(
            allSessions: core.records,
            cleanSessions: core.statsRecords,
            facts: core.facts,
            todayISO: todayISO
        ) else {
            return .unreadable
        }

        guard let findingCount = WeeklyCoachReviewFindingScope.count(
            issues: core.cleanView.issues,
            suspectSetDatesISO: core.quality.suspectSets.map(\.dateISO),
            reviewWeekStartISO: facts.reviewWeekStartISO,
            reviewWeekEndExclusiveISO: facts.reviewWeekEndExclusiveISO
        ) else {
            return .unreadable
        }
        let lift = facts.keyLiftTrend.map(WeeklyCoachLiftSignalPolicy.signal(from:))
        let input = WeeklyCoachReviewInput(
            reviewWeekStartISO: facts.reviewWeekStartISO,
            trainingDayCount: facts.trainingDayCount,
            sessionCount: facts.sessionCount,
            cleanVolumeKg: facts.cleanVolumeKg,
            recentMedianTrainingDays: facts.recentMedianTrainingDays,
            keyLift: lift,
            dataFindingCount: findingCount
        )
        return .ready(WeeklyCoachReviewEngine.evaluate(input))
    }

    #if DEBUG
    private static func debugFixture(arguments: [String]) -> WeeklyCoachReviewOutcome? {
        guard let index = arguments.firstIndex(of: "-weeklyCoachReviewFixture"),
              arguments.indices.contains(index + 1) else {
            return nil
        }
        switch arguments[index + 1] {
        case "empty":
            return .empty(.noCompletedTraining)
        case "unavailable":
            return .unavailable(.invalidInput)
        default:
            let fixture = arguments[index + 1]
            let lift: WeeklyCoachLiftSignal?
            let days: Int
            let sessions: Int
            let volume: Double
            let median: Double?
            let findings: Int
            switch fixture {
            case "data":
                lift = WeeklyCoachLiftSignal(exerciseId: "bench-press", call: .up, deltaKg: 2.5)
                days = 3; sessions = 3; volume = 8_400; median = 3; findings = 2
            case "rhythm":
                lift = nil
                days = 2; sessions = 2; volume = 4_200; median = 3; findings = 0
            case "calibrating":
                lift = nil
                days = 1; sessions = 1; volume = 2_100; median = 3; findings = 0
            case "lift-calibrating":
                lift = WeeklyCoachLiftSignal(
                    exerciseId: "bench-press",
                    call: .calibrating,
                    deltaKg: nil
                )
                days = 3; sessions = 3; volume = 8_400; median = 3; findings = 0
            case "holding":
                lift = WeeklyCoachLiftSignal(exerciseId: "bench-press", call: .flat, deltaKg: 0)
                days = 3; sessions = 3; volume = 8_400; median = 3; findings = 0
            case "easing":
                lift = WeeklyCoachLiftSignal(exerciseId: "bench-press", call: .down, deltaKg: -2.5)
                days = 3; sessions = 3; volume = 8_400; median = 3; findings = 0
            default:
                lift = WeeklyCoachLiftSignal(exerciseId: "bench-press", call: .up, deltaKg: 2.5)
                days = 3; sessions = 3; volume = 8_400; median = 3; findings = 0
            }
            return WeeklyCoachReviewEngine.evaluate(WeeklyCoachReviewInput(
                reviewWeekStartISO: "2026-07-06",
                trainingDayCount: days,
                sessionCount: sessions,
                cleanVolumeKg: volume,
                recentMedianTrainingDays: median,
                keyLift: lift,
                dataFindingCount: findings
            ))
        }
    }
    #endif
}

struct WeeklyCoachReviewView: View {
    let onAction: (WeeklyCoachReviewAction) -> Void

    @Environment(LocaleStore.self) private var localeStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var state: WeeklyCoachReviewScreenState = .loading
    @State private var reloadID = 0

    private var s: RedeStrings { localeStore.strings }

    private struct SpotlightPresentation {
        let overline: String
        let title: String
        let detail: String
        let value: String
        let unit: String?
        let usesNumericScale: Bool
        let accessibilityLabel: String
    }

    private struct MetricPresentation {
        let label: String
        let value: String
        let accessibilityLabel: String
    }

    var body: some View {
        Group {
            switch state {
            case .loading:
                statusContent(
                    title: s.weeklyCoachReviewLoading,
                    body: nil,
                    identifier: "weekly-review-loading",
                    showsProgress: true
                )
            case .unreadable:
                unavailableContent
            case .ready(let outcome):
                outcomeContent(outcome)
            }
        }
        .task(id: reloadID) {
            state = .loading
            state = await WeeklyCoachReviewLoader.loadAsync()
        }
        .accessibilityIdentifier("weekly-coach-review")
    }

    @ViewBuilder
    private func outcomeContent(_ outcome: WeeklyCoachReviewOutcome) -> some View {
        switch outcome {
        case .review(let review):
            reviewContent(review)
        case .empty:
            ScrollView {
                VStack(alignment: .leading, spacing: RedeSpace.section) {
                    statusCard(
                        title: s.weeklyCoachReviewEmptyTitle,
                        body: nil,
                        identifier: "weekly-review-empty"
                    )
                    EmbButton(icon: "arrow.left", title: s.weeklyCoachReviewAction(code: "openToday")) {
                        onAction(.openToday)
                    }
                    .accessibilityIdentifier("weekly-review-action-openToday")
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.vertical, 28)
            }
        case .unavailable:
            unavailableContent
        }
    }

    private func reviewContent(_ review: WeeklyCoachReview) -> some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    reviewIdentity(review.reviewWeekStartISO)

                    VStack(alignment: .leading, spacing: 8) {
                        Overline(text: s.weeklyCoachReviewDecisionLabel, color: .redeEmber2)
                        Text(s.weeklyCoachReviewVerdictDisplayTitle(code: verdictCode(review.verdict)))
                            .font(.redeTitle)
                            .tracking(RedeTracking.title)
                            .foregroundStyle(Color.redeT1)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.top, 30)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier("weekly-review-verdict-\(verdictCode(review.verdict))")

                    spotlightCard(review)
                        .padding(.top, 30)

                    let supportingEvidence = WeeklyCoachReviewMemoPolicy.supportingEvidence(in: review)
                    if !supportingEvidence.isEmpty {
                        evidenceMemo(supportingEvidence)
                            .padding(.top, RedeSpace.section)
                    }

                    Spacer(minLength: 48)

                    reviewAction(review.action)
                }
                .frame(
                    maxWidth: .infinity,
                    minHeight: max(0, proxy.size.height - 52),
                    alignment: .topLeading
                )
                .padding(.leading, 18)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(Color.redeEmber)
                        .frame(width: 2)
                        .padding(.vertical, 10)
                        .accessibilityHidden(true)
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 24)
                .padding(.bottom, 28)
            }
        }
    }

    private var unavailableContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RedeSpace.section) {
                statusCard(
                    title: s.weeklyCoachReviewUnavailableTitle,
                    body: s.weeklyCoachReviewUnavailableBody,
                    identifier: "weekly-review-unavailable"
                )
                EmbButton(icon: "arrow.clockwise", title: s.weeklyCoachReviewRetry) {
                    reloadID += 1
                }
                .accessibilityIdentifier("weekly-review-retry")
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.vertical, 28)
        }
    }

    private func statusContent(
        title: String,
        body: String?,
        identifier: String,
        showsProgress: Bool
    ) -> some View {
        VStack(spacing: 14) {
            if showsProgress {
                ProgressView().tint(Color.redeEmber2)
            }
            Text(title)
                .font(.redeHeadline)
                .foregroundStyle(Color.redeT1)
            if let body {
                Text(body).font(.redeBody).foregroundStyle(Color.redeT2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(RedeSpace.page)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }

    private func statusCard(title: String, body: String?, identifier: String) -> some View {
        ForgedCard(showReg: true) {
            VStack(alignment: .leading, spacing: 12) {
                Text(title)
                    .font(.redeHeadline)
                    .foregroundStyle(Color.redeT1)
                    .fixedSize(horizontal: false, vertical: true)
                if let body {
                    Text(body)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(identifier)
    }

    private func reviewIdentity(_ weekStartISO: String) -> some View {
        let date = WeeklyCoachReviewDatePolicy.presentation(
            weekStartISO: weekStartISO,
            locale: localeStore.locale,
            strings: s
        )
        return VStack(alignment: .leading, spacing: 6) {
            Overline(text: date.issue, color: .redeT3)
            Text(s.weeklyCoachReviewTitle)
                .font(.redeSubhead)
                .foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)
            Text(date.range)
                .font(.redeCallout)
                .foregroundStyle(Color.redeT3)
                .monospacedDigit()
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    private func spotlightCard(_ review: WeeklyCoachReview) -> some View {
        let presentation = spotlightPresentation(review)
        return VStack(alignment: .leading, spacing: 0) {
            Overline(text: presentation.overline, color: .redeEmber2)
            Text(presentation.title)
                .font(.redeHeadline)
                .tracking(RedeTracking.headline)
                .foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Text(presentation.detail)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)

            spotlightValue(presentation)
                .padding(.top, 22)
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
        .background(Color.redeRaised)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.redeHair, lineWidth: 1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(presentation.accessibilityLabel)
        .accessibilityIdentifier("weekly-review-spotlight")
    }

    @ViewBuilder
    private func spotlightValue(_ presentation: SpotlightPresentation) -> some View {
        if presentation.usesNumericScale {
            if dynamicTypeSize.isAccessibilitySize, let unit = presentation.unit {
                VStack(alignment: .leading, spacing: 2) {
                    Text(presentation.value)
                        .font(.redeDisplay)
                        .tracking(RedeTracking.display)
                        .foregroundStyle(Color.redeT1)
                        .monospacedDigit()
                    Text(unit)
                        .font(.redeSubhead)
                        .foregroundStyle(Color.redeT2)
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(presentation.value)
                        .font(.redeDisplay)
                        .tracking(RedeTracking.display)
                        .foregroundStyle(Color.redeT1)
                        .monospacedDigit()
                    if let unit = presentation.unit {
                        Text(unit)
                            .font(.redeSubhead)
                            .foregroundStyle(Color.redeT2)
                    }
                }
            }
        } else {
            Text(presentation.value)
                .font(.redeTitle)
                .tracking(RedeTracking.title)
                .foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func evidenceMemo(_ evidence: [WeeklyCoachReviewEvidence]) -> some View {
        let presentations = evidence.map(metricPresentation)
        return VStack(alignment: .leading, spacing: 14) {
            Overline(text: s.weeklyCoachReviewEvidenceMemoLabel, color: .redeT3)
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(presentations.enumerated()), id: \.offset) { index, item in
                        metricCell(item)
                        if index < presentations.count - 1 {
                            Rectangle()
                                .fill(Color.redeHair)
                                .frame(height: 1)
                                .accessibilityHidden(true)
                        }
                    }
                }
            } else {
                HStack(alignment: .top, spacing: 16) {
                    ForEach(Array(presentations.enumerated()), id: \.offset) { index, item in
                        metricCell(item)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if index < presentations.count - 1 {
                            Rectangle()
                                .fill(Color.redeHair)
                                .frame(width: 1, height: 44)
                                .accessibilityHidden(true)
                        }
                    }
                }
            }
        }
        .accessibilityIdentifier("weekly-review-evidence")
    }

    private func metricCell(_ presentation: MetricPresentation) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(presentation.value)
                .font(.redeHeadline)
                .tracking(RedeTracking.headline)
                .foregroundStyle(Color.redeT1)
                .monospacedDigit()
                .fixedSize(horizontal: false, vertical: true)
            Text(presentation.label)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(presentation.accessibilityLabel)
    }

    private func reviewAction(_ action: WeeklyCoachReviewAction) -> some View {
        let title = s.weeklyCoachReviewAction(code: actionCode(action))
        return Button {
            onAction(action)
        } label: {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 5) {
                    Overline(text: s.weeklyCoachReviewNextLabel, color: .redeT3)
                    Text(title)
                        .font(.redeSubhead)
                        .foregroundStyle(Color.redeT1)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.redeEmber2)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, minHeight: 66, alignment: .leading)
            .background(Color.redeSurface)
            .clipShape(RoundedRectangle(cornerRadius: RedeShape.cardRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: RedeShape.cardRadius, style: .continuous)
                    .stroke(Color.redeHair2, lineWidth: 1)
            }
        }
        .buttonStyle(.redePressableRow)
        .accessibilityLabel(title)
        .accessibilityIdentifier("weekly-review-action-\(actionCode(action))")
    }

    private func spotlightPresentation(_ review: WeeklyCoachReview) -> SpotlightPresentation {
        let index = WeeklyCoachReviewMemoPolicy.spotlightEvidenceIndex(in: review)
        guard review.evidence.indices.contains(index) else {
            return SpotlightPresentation(
                overline: s.weeklyCoachReviewBaselineLabel,
                title: s.weeklyCoachReviewTitle,
                detail: s.weeklyCoachReviewLastFullWeek,
                value: s.weeklyCoachReviewLiftCallMetric(code: "calibrating"),
                unit: nil,
                usesNumericScale: false,
                accessibilityLabel: s.weeklyCoachReviewVerdictTitle(code: "calibrating")
            )
        }

        switch review.evidence[index] {
        case .dataFindings(let count):
            return SpotlightPresentation(
                overline: s.weeklyCoachReviewDataCheckLabel,
                title: s.weeklyCoachReviewDataFindingsMetric,
                detail: s.weeklyCoachReviewLastFullWeek,
                value: "\(count)",
                unit: s.weeklyCoachReviewEntryUnit(count),
                usesNumericScale: true,
                accessibilityLabel: s.weeklyCoachReviewDataFindings(count)
            )
        case .trainingDays(let count):
            return SpotlightPresentation(
                overline: s.weeklyCoachReviewRhythmLabel,
                title: s.weeklyCoachReviewTrainingRhythmMetric,
                detail: s.weeklyCoachReviewLastFullWeek,
                value: "\(count)",
                unit: s.weeklyCoachReviewDayUnit(Double(count)),
                usesNumericScale: true,
                accessibilityLabel: s.weeklyCoachReviewTrainingDays(count)
            )
        case .recentMedianTrainingDays(let count):
            return SpotlightPresentation(
                overline: s.weeklyCoachReviewRhythmLabel,
                title: s.weeklyCoachReviewRecentRhythmMetric,
                detail: s.weeklyCoachReviewLastFullWeek,
                value: formattedDayCount(count),
                unit: s.weeklyCoachReviewDayUnit(count),
                usesNumericScale: true,
                accessibilityLabel: s.weeklyCoachReviewRecentMedian(count)
            )
        case .sessions(let count):
            return SpotlightPresentation(
                overline: s.weeklyCoachReviewBaselineLabel,
                title: s.weeklyCoachReviewSessionsMetric,
                detail: s.weeklyCoachReviewLastFullWeek,
                value: "\(count)",
                unit: s.weeklyCoachReviewSessionUnit(count),
                usesNumericScale: true,
                accessibilityLabel: s.weeklyCoachReviewSessions(count)
            )
        case .keyLift(let exerciseId, let call, let deltaKg):
            let name = localeStore.exerciseName(exerciseId)
            let deltaText = deltaKg.map { formattedLiftDelta($0, includesUnit: true) }
            return SpotlightPresentation(
                overline: s.weeklyCoachReviewMovementLabel,
                title: name,
                detail: s.weeklyCoachReviewLiftDetail(
                    code: liftCode(call),
                    hasDelta: deltaKg != nil
                ),
                value: deltaKg.map { formattedLiftDelta($0, includesUnit: false) }
                    ?? s.weeklyCoachReviewLiftCallMetric(code: liftCode(call)),
                unit: deltaKg == nil ? nil : s.unitLabel,
                usesNumericScale: deltaKg != nil,
                accessibilityLabel: s.weeklyCoachReviewKeyLift(
                    name: name,
                    call: liftCode(call),
                    deltaText: deltaText
                )
            )
        case .cleanVolumeKg(let value):
            let formatted = s.formatVolumeKg(value)
            return SpotlightPresentation(
                overline: s.weeklyCoachReviewBaselineLabel,
                title: s.weeklyCoachReviewEffectiveVolumeMetric,
                detail: s.weeklyCoachReviewLastFullWeek,
                value: formatted,
                unit: s.unitLabel,
                usesNumericScale: true,
                accessibilityLabel: s.weeklyCoachReviewCleanVolume("\(formatted) \(s.unitLabel)")
            )
        }
    }

    private func metricPresentation(_ evidence: WeeklyCoachReviewEvidence) -> MetricPresentation {
        switch evidence {
        case .dataFindings(let count):
            return MetricPresentation(
                label: s.weeklyCoachReviewDataFindingsMetric,
                value: "\(count) \(s.weeklyCoachReviewEntryUnit(count))",
                accessibilityLabel: s.weeklyCoachReviewDataFindings(count)
            )
        case .trainingDays(let count):
            return MetricPresentation(
                label: s.weeklyCoachReviewTrainingRhythmMetric,
                value: "\(count) \(s.weeklyCoachReviewDayUnit(Double(count)))",
                accessibilityLabel: s.weeklyCoachReviewTrainingDays(count)
            )
        case .recentMedianTrainingDays(let count):
            return MetricPresentation(
                label: s.weeklyCoachReviewRecentRhythmMetric,
                value: "\(formattedDayCount(count)) \(s.weeklyCoachReviewDayUnit(count))",
                accessibilityLabel: s.weeklyCoachReviewRecentMedian(count)
            )
        case .sessions(let count):
            return MetricPresentation(
                label: s.weeklyCoachReviewSessionsMetric,
                value: "\(count) \(s.weeklyCoachReviewSessionUnit(count))",
                accessibilityLabel: s.weeklyCoachReviewSessions(count)
            )
        case .keyLift(let exerciseId, let call, let deltaKg):
            let name = localeStore.exerciseName(exerciseId)
            let deltaText = deltaKg.map { formattedLiftDelta($0, includesUnit: true) }
            let accessibilityLabel = s.weeklyCoachReviewKeyLift(
                name: name,
                call: liftCode(call),
                deltaText: deltaText
            )
            return MetricPresentation(
                label: name,
                value: deltaText ?? s.weeklyCoachReviewLiftCallMetric(code: liftCode(call)),
                accessibilityLabel: accessibilityLabel
            )
        case .cleanVolumeKg(let value):
            let formatted = "\(s.formatVolumeKg(value)) \(s.unitLabel)"
            return MetricPresentation(
                label: s.weeklyCoachReviewEffectiveVolumeMetric,
                value: formatted,
                accessibilityLabel: s.weeklyCoachReviewCleanVolume(formatted)
            )
        }
    }

    private func formattedLiftDelta(_ value: Double, includesUnit: Bool) -> String {
        let prefix = value > 0 ? "+" : value < 0 ? "−" : ""
        let number = "\(prefix)\(s.formatE1Rm(abs(value)))"
        return includesUnit ? "\(number) \(s.unitLabel)" : number
    }

    private func formattedDayCount(_ count: Double) -> String {
        count.rounded() == count ? String(Int(count)) : String(count)
    }

    private func verdictCode(_ verdict: WeeklyCoachReviewVerdict) -> String {
        switch verdict {
        case .dataNeedsReview: "dataNeedsReview"
        case .rebuildRhythm: "rebuildRhythm"
        case .progressing: "progressing"
        case .holding: "holding"
        case .easing: "easing"
        case .calibrating: "calibrating"
        }
    }

    private func liftCode(_ call: WeeklyCoachLiftCall) -> String {
        switch call {
        case .up: "up"
        case .flat: "flat"
        case .down: "down"
        case .calibrating: "calibrating"
        }
    }

    private func actionCode(_ action: WeeklyCoachReviewAction) -> String {
        switch action {
        case .reviewData: "reviewData"
        case .openToday: "openToday"
        case .viewProgress: "viewProgress"
        }
    }

}
