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
    /// FR-T5 换动作覆盖（切片6c）：originalId→actualId 落库真相。UI 据此在处方行显「已换·撤销」微标、
    /// detail sheet 露撤销入口（读落库 map = 真相、不缓存 @State，抗教练卡 reload 消失）。
    let substitutions: [String: String]
    /// FR-TR6「只换这次」今天有效的临时换动作（originalId→actualId，已按今日过滤）。
    /// UI 据此把微标显成「今天临时换」并把撤销路由到 remove-one-time（区别于永久换）。
    let oneTimeSubstitutions: [String: String]
    /// 器械场景（commercial-gym/home-dumbbell/minimal/nil）：换动作候选过滤用，与引擎同口径。
    let equipmentScenario: String?

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
                return .unreadable // 连默认空文档都构造不出 = 异常，如实降级（不返回 nil 让今日页无限转圈，审计 MAJOR）
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
            return .unreadable // 数据在但 clean 视图构不出 = 读不懂，如实降级（不返回 nil 让今日页无限转圈，审计 MAJOR）
        }
        let verdict = TodayVerdictEngine.evaluate(input)
        // FR-TR6「只换这次」：只取今天有效的临时换动作（dateISO==今天；次日对不上→自动失效）。
        let oneTimeToday = appData.oneTimeSubstitutions
            .filter { $0.value.dateISO == todayISO }
            .mapValues { $0.actualId }
        // 喂引擎的有效替换 = 永久替换 + 今天的临时替换（临时优先）。**合并在 app 层做、引擎不区分二者**
        // → 引擎零改动、golden 零回归；临时项只今天混入、不落进永久表。
        let effectiveSubs = appData.exerciseSubstitutions.merging(oneTimeToday) { _, oneTime in oneTime }
        // 周期化引擎 S4：从落库配置读 enabled + blockLengthWeeks 喂引擎（默认 false = 零行为回归）；
        // 与计划页周期条（loadCycleState）读同一份 mesocycle 配置 → 两页相位永不分叉（审查 MAJOR-1）。
        // 锚点仍由引擎从真历史现算（FR-PL1 诚实，不读存储 blockStartISO）。
        let prescription = TodayPrescriptionEngine.plan(
            input: input, verdict: verdict,
            mesocycleEnabled: appData.mesocycle.enabled,
            blockLengthWeeks: appData.mesocycle.blockLengthWeeks,
            // FR-T5 永久换 + FR-TR6 今天的临时换（已合并；空表 = 零行为变化）
            substitutions: effectiveSubs,
            // FR-PL6/PL7：用户自定义计划覆盖（缺 = .empty = 逐字段等价于现状、零回归）
            customization: PlanCustomizationBridge.input(from: appData.planCustomization)
        )

        // FR-T5 教练动作（切片6b）：摊平裁决信号 + 处方到顶 reason + 落库 dismiss/采纳态 → 引擎产卡。
        // FR-T5 收尾：算数据质量报告（与进展页同口径，DataQualityComposer）→ 可疑组条数喂修数据卡。
        // 可疑组数（"看起来不对劲、去核对"）才触发卡；静默净化的丢弃/忽略不算（无可核对项）。
        // 注：此处为取 count 算了全量报告（进展页加载时会再算一次，不共享缓存）——健身数据量级小、可接受。
        let dataFindingCount = DataQualityComposer.report(cleanView: cleanView).suspectSets.count
        var last7 = 0, planned = 0
        for signal in verdict.signals {
            if case .sessionsInLast7Days(let n) = signal { last7 = n }
            if case .plannedDaysPerWeek(let n) = signal { planned = n }
        }
        let stalledIds = (prescription?.exercises ?? [])
            .filter { $0.reason.isCeilingOrGraduationMilestone }
            .map(\.exerciseId)
        let weekStartISO = WeekAnchor.isoWeekStart(now)
        let coachActions = CoachActionEngine.actions(input: CoachActionInput(
            call: verdict.call,
            sessionsLast7: last7,
            plannedDaysPerWeek: planned,
            totalSessionCount: cleanView.sessions.count,
            stalledExerciseIds: stalledIds,
            dataFindingCount: dataFindingCount,
            weekStartISO: weekStartISO,
            dismissals: appData.coachDismissals,
            volumeBoostAdoptedThisWeek: appData.volumeBoostWeeks.contains(weekStartISO)
        ))
        return .ready(TodayModel(
            verdict: verdict, prescription: prescription, cleanView: cleanView, now: now,
            coachActions: coachActions, substitutions: appData.exerciseSubstitutions,
            oneTimeSubstitutions: oneTimeToday,
            equipmentScenario: input.profile.equipmentScenario
        ))
    }
}
