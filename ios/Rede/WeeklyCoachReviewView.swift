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
        let lift = facts.keyLiftTrend.map { assessment in
            WeeklyCoachLiftSignal(
                exerciseId: assessment.exerciseId,
                call: liftCall(assessment.call),
                deltaKg: assessment.call == .calibrating ? nil : assessment.deltaKg
            )
        }
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

    private static func liftCall(_ call: TrendCall) -> WeeklyCoachLiftCall {
        switch call {
        case .up: .up
        case .flat: .flat
        case .down: .down
        case .calibrating: .calibrating
        }
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
                days = 1; sessions = 1; volume = 2_100; median = 3; findings = 0
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
    @State private var state: WeeklyCoachReviewScreenState = .loading
    @State private var reloadID = 0

    private var s: RedeStrings { localeStore.strings }

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
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ForgedCard(emberBarInset: 18, showReg: true) {
                    VStack(alignment: .leading, spacing: 14) {
                        Overline(
                            text: s.weeklyCoachReviewWeek(dateText: weekDateText(review.reviewWeekStartISO)),
                            color: .redeEmber2
                        )
                        Text(s.weeklyCoachReviewVerdictTitle(code: verdictCode(review.verdict)))
                            .font(.redeTitle)
                            .foregroundStyle(Color.redeT1)
                            .fixedSize(horizontal: false, vertical: true)
                        if let body = s.weeklyCoachReviewVerdictBody(
                            code: verdictCode(review.verdict),
                            count: dataFindingCount(review.evidence)
                        ) {
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
                .accessibilityIdentifier("weekly-review-verdict-\(verdictCode(review.verdict))")

                EngraveDivider()
                    .padding(.vertical, RedeSpace.section)

                Overline(text: s.weeklyCoachReviewEvidenceTitle)
                    .padding(.bottom, 10)

                VStack(spacing: 0) {
                    ForEach(Array(review.evidence.enumerated()), id: \.offset) { index, evidence in
                        evidenceRow(evidence)
                        if index < review.evidence.count - 1 {
                            Rectangle().fill(Color.redeHair2).frame(height: 1)
                        }
                    }
                }
                .background(Color.redeSurface)
                .clipShape(RoundedRectangle(cornerRadius: RedeShape.cardRadius))
                .accessibilityIdentifier("weekly-review-evidence")

                EmbButton(
                    icon: actionIcon(review.action),
                    title: s.weeklyCoachReviewAction(code: actionCode(review.action))
                ) {
                    onAction(review.action)
                }
                .padding(.top, RedeSpace.section)
                .accessibilityIdentifier("weekly-review-action-\(actionCode(review.action))")
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.vertical, 28)
            .padding(.bottom, 24)
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

    private func evidenceRow(_ evidence: WeeklyCoachReviewEvidence) -> some View {
        let presentation = evidencePresentation(evidence)
        return HStack(spacing: 12) {
            Image(systemName: presentation.icon)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.redeT4)
                .frame(width: 20)
                .accessibilityHidden(true)
            Text(presentation.text)
                .font(.redeBody)
                .foregroundStyle(Color.redeT2)
                .monospacedDigit()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 52)
        .accessibilityElement(children: .combine)
    }

    private func evidencePresentation(_ evidence: WeeklyCoachReviewEvidence) -> (icon: String, text: String) {
        switch evidence {
        case .dataFindings(let count):
            return ("exclamationmark.triangle", s.weeklyCoachReviewDataFindings(count))
        case .trainingDays(let count):
            return ("calendar", s.weeklyCoachReviewTrainingDays(count))
        case .recentMedianTrainingDays(let count):
            return ("waveform.path.ecg", s.weeklyCoachReviewRecentMedian(count))
        case .sessions(let count):
            return ("list.bullet.clipboard", s.weeklyCoachReviewSessions(count))
        case .keyLift(let exerciseId, let call, let deltaKg):
            let deltaText = deltaKg.map { value in
                let prefix = value > 0 ? "+" : value < 0 ? "−" : ""
                return "\(prefix)\(s.formatE1Rm(abs(value))) \(s.unitLabel)"
            }
            return (
                "chart.line.uptrend.xyaxis",
                s.weeklyCoachReviewKeyLift(
                    name: localeStore.exerciseName(exerciseId),
                    call: liftCode(call),
                    deltaText: deltaText
                )
            )
        case .cleanVolumeKg(let value):
            return (
                "sum",
                s.weeklyCoachReviewCleanVolume("\(s.formatVolumeKg(value)) \(s.unitLabel)")
            )
        }
    }

    private func weekDateText(_ iso: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(secondsFromGMT: 0)
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: iso) else { return iso }
        let output = DateFormatter()
        output.locale = Locale(identifier: localeStore.locale == .zh ? "zh_Hans" : "en_US")
        output.timeZone = TimeZone(secondsFromGMT: 0)
        output.dateFormat = localeStore.locale == .zh ? "M月d日" : "MMM d"
        return output.string(from: date)
    }

    private func dataFindingCount(_ evidence: [WeeklyCoachReviewEvidence]) -> Int {
        for item in evidence {
            if case .dataFindings(let count) = item { return count }
        }
        return 0
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

    private func actionIcon(_ action: WeeklyCoachReviewAction) -> String {
        switch action {
        case .reviewData: "checklist"
        case .openToday: "arrow.left"
        case .viewProgress: "chart.xyaxis.line"
        }
    }
}
