import Foundation
import RedeDomain
import RedeDataHealth
import RedePersistence
import RedeTrainingDecision

// TodayModel — 组合层（M2-3）：唯一 IO 入口读 canonical → DataHealth 投影 →
// 裁决 → 处方。app 层只接线与渲染，不承载业务判断（阈值/规则全部在包内，
// 系统逻辑 §1.1）；时钟在这里注入（引擎无 clock）。只读——写路径随 M3 接
// CanonicalSessionWriter。加载在后台执行（视图 .task 调 loadOutcomeAsync）。

struct TodayModel {
    /// 三态加载结果：unreadable ≠ 新用户——存在但读不懂的数据绝不当空文档
    /// 渲染（否则会引导用户「首练」覆盖既有记录，违背坏数据不覆盖铁律）。
    enum LoadOutcome {
        case ready(TodayModel)
        case unreadable
    }

    let verdict: TodayVerdict
    let prescription: TodayPrescription?
    let cleanView: CleanAppDataView
    let now: Date
    /// FR-T5 教练动作（切片6b）：优先级排序、已降频的建议；UI 取首条渲染（每屏 ≤1）。
    let coachActions: [CoachAction]

    /// Rail「上次」节点：首个处方动作最近一次实绩（重量×次数 + 日期）。
    struct RailLast {
        let weightKg: Double
        let reps: Int
        let dateISO: String
    }

    var railLast: RailLast? {
        guard let first = prescription?.exercises.first else { return nil }
        // 纯展示查找（最近含该动作的 session 的顶组实绩）；批量投影归 M4 进展层。
        let candidates = cleanView.sessions
            .filter { session in session.exercises.contains { $0.exerciseId == first.exerciseId } }
            .sorted { $0.date < $1.date }
        guard let session = candidates.last else { return nil }
        let sets = session.exercises.filter { $0.exerciseId == first.exerciseId }.flatMap(\.sets)
        guard let top = sets.max(by: { $0.weight < $1.weight }) else { return nil }
        return RailLast(weightKg: top.weight, reps: top.reps, dateISO: session.date)
    }

    /// canonical 路径：Application Support/RedeData/app-data.json（每装机一份）。
    static func canonicalFileURL() -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RedeData", isDirectory: true)
            .appendingPathComponent("app-data.json", isDirectory: false)
    }

    /// 后台加载（同步文件 IO 不进主线程——M3 写路径接通后文件会变大）。
    static func loadOutcomeAsync(now: Date = Date()) async -> LoadOutcome? {
        await Task.detached(priority: .userInitiated) { loadOutcome(now: now) }.value
    }

    static func loadOutcome(now: Date = Date()) -> LoadOutcome? {
        let store = JSONFileAppDataStore(fileURL: canonicalFileURL())
        let appData: AppData
        do {
            if let existing = try store.load() {
                appData = existing
            } else if let empty = try? AppData(decoding: .object(["schemaVersion": .int(Int64(SchemaVersion.current))])) {
                appData = empty // 文件缺失 = 合法首启
            } else {
                return nil
            }
        } catch {
            // unreadable：用户数据在但读不懂——如实降级，绝不渲染成新用户。
            return .unreadable
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current // 用户本地日历日（引擎按天序号计算）
        formatter.dateFormat = "yyyy-MM-dd"
        let todayISO = formatter.string(from: now)

        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        guard let input = try? CleanTrainingDecisionInput.make(from: cleanView, todayISO: todayISO) else {
            return nil
        }
        let verdict = TodayVerdictEngine.evaluate(input)
        // 周期化引擎 S4：从落库配置读 enabled + blockLengthWeeks 喂引擎（默认 false = 零行为回归）；
        // 与计划页周期条（loadCycleState）读同一份 mesocycle 配置 → 两页相位永不分叉（审查 MAJOR-1）。
        // 锚点仍由引擎从真历史现算（FR-PL1 诚实，不读存储 blockStartISO）。
        let prescription = TodayPrescriptionEngine.plan(
            input: input, verdict: verdict,
            mesocycleEnabled: appData.mesocycle.enabled,
            blockLengthWeeks: appData.mesocycle.blockLengthWeeks,
            // FR-T5：换动作前瞻覆盖（schema 11；空表 = 零行为变化，未采纳前恒空）
            substitutions: appData.exerciseSubstitutions
        )

        // FR-T5 教练动作（切片6b）：摊平裁决信号 + 处方到顶 reason + 落库 dismiss/采纳态 → 引擎产卡。
        // 修数据卡需在 Today 算 DataQualityReport，推后（dataFindingCount=0 = 暂不出修数据卡）。
        var last7 = 0, planned = 0
        for signal in verdict.signals {
            if case .sessionsInLast7Days(let n) = signal { last7 = n }
            if case .plannedDaysPerWeek(let n) = signal { planned = n }
        }
        let stalledIds = (prescription?.exercises ?? [])
            .filter { isStalledReason($0.reason) }
            .map(\.exerciseId)
        let weekStartISO = isoWeekStart(now)
        let coachActions = CoachActionEngine.actions(input: CoachActionInput(
            call: verdict.call,
            sessionsLast7: last7,
            plannedDaysPerWeek: planned,
            totalSessionCount: cleanView.sessions.count,
            stalledExerciseIds: stalledIds,
            dataFindingCount: 0,
            weekStartISO: weekStartISO,
            dismissals: appData.coachDismissals,
            volumeBoostAdoptedThisWeek: appData.volumeBoostWeeks.contains(weekStartISO)
        ))
        return .ready(TodayModel(
            verdict: verdict, prescription: prescription, cleanView: cleanView, now: now,
            coachActions: coachActions
        ))
    }

    /// 到顶/毕业 reason（换动作教练卡的触发源；与 TodayTabView.isMilestone 同口径）。
    private static func isStalledReason(_ reason: PrescriptionReason) -> Bool {
        switch reason {
        case .bodyweightCeilingReached, .bandCeilingReached, .assistedGraduated, .bodyweightPlusDegraded:
            return true
        default:
            return false
        }
    }

    /// 本周 ISO 周一（yyyy-MM-dd，本地）——补量按周抑制/采纳的 key 锚点；6c 采纳写入用同一计算。
    /// 绝不静默回退到 now（按日变化的非周一字符串会让"已采纳/已 dismiss"按周查错位、降频哑火，
    /// 且 6c 写入时会把错锚点污染进 volumeBoostWeeks）——date(from:) 对合法日期不会失败，万一失败
    /// 断言暴露 + 返回空串（引擎按周抑制退化为不抑制 = 安全：宁可多弹一次，不查错周，审查 MAJOR-1）。
    static func isoWeekStart(_ now: Date) -> String {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = .current
        guard let monday = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now)) else {
            assertionFailure("ISO 周一锚点计算失败，输入日期异常: \(now)")
            return ""
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: monday)
    }
}
