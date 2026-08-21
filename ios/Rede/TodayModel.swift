import Foundation
import RedeDomain
import RedeLocalSnapshot
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
    /// FR-TR12 本分化的训练日序（如 ["upper","lower"]）：今日页「换一天练」选择器列这些。
    let daySequence: [String]
    /// FR-TR12 今日按轮转**本该**练的训练日（不含临时覆盖）；与 prescription.dayCode 不同 = 今天临时换过了，
    /// 被跳过的就是它（撤销浮条「明天补回 X」、今日页「今天临时换为…」据此判断）。
    let scheduledDayCode: String?
    /// 每周循环模式（换天弹窗/撤销条文案分流：weekly 下不承诺「顺延补回」——审查 S1）。
    let weeklyCycleRestart: Bool

    /// Rail「上次」节点：首个处方动作最近一次实绩（重量×次数 + 日期）。
    struct RailLast {
        let weightKg: Double
        let reps: Int
        let dateISO: String
    }

    var railLast: RailLast? {
        guard let first = prescription?.exercises.first else { return nil }
        // 纯展示查找：先在每场聚合同 id occurrence，空 occurrence 不得遮住更早真绩；
        // 再取最近非空场的顶组。批量投影归 M4 进展层。
        var candidates: [(
            dayISO: String,
            canonicalOffset: Int,
            dateISO: String,
            sets: [CleanLoggedSet]
        )] = []
        for (canonicalOffset, session) in cleanView.sessions.enumerated() {
            let sets = session.exercises
                .filter { $0.exerciseId == first.exerciseId }
                .flatMap(\.sets)
            guard !sets.isEmpty else { continue }
            candidates.append((
                String(session.date.prefix(10)),
                canonicalOffset,
                session.date,
                sets
            ))
        }
        guard let candidate = candidates.max(by: {
            $0.dayISO == $1.dayISO
                ? $0.canonicalOffset < $1.canonicalOffset
                : $0.dayISO < $1.dayISO
        }),
              let top = candidate.sets.max(by: { $0.weight < $1.weight })
        else { return nil }
        return RailLast(weightKg: top.weight, reps: top.reps, dateISO: candidate.dateISO)
    }

    /// canonical 路径：Application Support/RedeData/app-data.json（每装机一份）。
    static func canonicalFileURL() -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RedeData", isDirectory: true)
            .appendingPathComponent("app-data.json", isDirectory: false)
    }

    /// 后台加载（同步文件 IO 不进主线程——M3 写路径接通后文件会变大）。
    /// paidCoach：**由 app 层解析好再传进来**（FR-SUB1 修订）。TodayModel 与引擎都不读 entitlement；
    /// 付费能力的关法是把引擎输入置空（周期化 false、优先肌群空表），引擎代码零改动。
    /// 默认 `.inactive` = 购买闸未开 = 全部照旧可用（生产今日形态，也是全部既有测试的口径）。
    static func loadOutcomeAsync(now: Date = Date(), paidCoach: PaidCoachAccess = .inactive) async -> LoadOutcome? {
        await Task.detached(priority: .userInitiated) { loadOutcome(now: now, paidCoach: paidCoach) }.value
    }

    static func loadOutcome(now: Date = Date(), paidCoach: PaidCoachAccess = .inactive) -> LoadOutcome? {
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
        // FR-TR12「今天换一天练」：本分化日序 + 今日轮转默认（含 rotationOffset）+ 今日临时覆盖（dateISO==今天且合法成员）。
        let daySequence = TodayPrescriptionEngine.resolvedDaySequence(
            splitType: input.program.splitType, override: appData.planCustomization?.daySequence)
        // 「今天本来该练什么」与引擎单一真源（含回归重启/每周循环模式）——旧公式
        // app 层复算曾在两种新模式下漂移，误显示「今天临时换为」（2026-07-08 实拍抓获）。
        let scheduledDayCode = TodayPrescriptionEngine.scheduledTodayDayCode(
            input: input, verdict: verdict,
            customization: PlanCustomizationBridge.input(from: appData.planCustomization),
            rotationOffset: appData.rotationOffset,
            weeklyCycleRestart: appData.weeklyCycleRestart)
        let dayCodeOverride: String? = appData.oneTimeDayOverride
            .flatMap { $0.dateISO == todayISO && daySequence.contains($0.dayCode) ? $0.dayCode : nil }
        // 周期化引擎 S4：从落库配置读 enabled + blockLengthWeeks 喂引擎（默认 false = 零行为回归）；
        // 与计划页周期条（loadCycleState）读同一份 mesocycle 配置 → 两页相位永不分叉（审查 MAJOR-1）。
        // 锚点仍由引擎从真历史现算（FR-PL1 诚实，不读存储 blockStartISO）。
        // 自动均衡（批次 E，owner 拍板「不要建议直接自动改」）：读 MLE 记忆里的
        // 「正在补足」名单喂引擎（assembler 真 decision 单一真源——已排除 detraining；
        // 今日页不复算 MLE）。已知滞后：名单在用户访问进度页后更新——弱肌群是周级
        // 慢变量，可接受。旧文件缺字段 = 空 = 零行为变化。双包同名枚举经 rawValue 翻译。
        let priorityRaws = MuscleLevelMemoryStore(fileURL: ProgressModel.muscleLevelMemoryFileURL())
            .load()?.priorityMuscles ?? []
        let priorityMuscles = Set(priorityRaws.compactMap {
            RedeTrainingDecision.MuscleGroupID(rawValue: $0)
        })
        let prescription = TodayPrescriptionEngine.plan(
            input: input, verdict: verdict,
            // 周期化是付费能力（FR-SUB1 修订）：没权益就当开关没开——用户的落库设置原样保留，
            // 订阅后立刻恢复，不需要用户再去设置里点一次。
            mesocycleEnabled: appData.mesocycle.enabled && paidCoach.allows(.periodization),
            blockLengthWeeks: appData.mesocycle.blockLengthWeeks,
            // FR-T5 永久换 + FR-TR6 今天的临时换（已合并；空表 = 零行为变化）
            substitutions: effectiveSubs,
            // FR-PL6/PL7：用户自定义计划覆盖（缺 = .empty = 逐字段等价于现状、零回归）
            customization: PlanCustomizationBridge.input(from: appData.planCustomization),
            // FR-TR12 今天换一天练：今日临时覆盖训练日 + 轮转偏移（默认 nil/0 = 现状、golden 零回归）
            dayCodeOverride: dayCodeOverride,
            rotationOffset: appData.rotationOffset,
            // 每周循环模式（2026-07-08）：默认 false = 顺延（现状零回归）
            weeklyCycleRestart: appData.weeklyCycleRestart,
            // 自动均衡是付费能力：没权益就传空表（= 引擎既有的「没有弱肌群」路径，零分叉）。
            priorityMuscles: paidCoach.allows(.autoBalance) ? priorityMuscles : []
        )

        // FR-T5 教练动作（切片6b）：摊平裁决信号 + 处方到顶 reason + 落库 dismiss/采纳态 → 引擎产卡。
        // FR-T5 收尾：算数据质量报告（与进展页同口径，DataQualityComposer）→ 可疑组条数喂修数据卡。
        // 可疑组数（"看起来不对劲、去核对"）才触发卡；静默净化的丢弃/忽略不算（无可核对项）。
        // 注：此处为取 count 算了全量报告（进展页加载时会再算一次，不共享缓存）——健身数据量级小、可接受。
        let dataFindingCount = DataQualityComposer.report(cleanView: cleanView).suspectSets.count
        // 周口径迁移（2026-07-15）：引擎信号已是日历周训练天数（周一始）——
        // 与下方 weekStartISO 抑制键、状态行分段条同口径（同卡不再两种周口径）。
        var trainedThisWeek = 0, planned = 0
        for signal in verdict.signals {
            if case .trainedDaysThisWeek(let n) = signal { trainedThisWeek = n }
            if case .plannedDaysPerWeek(let n) = signal { planned = n }
        }
        let stalledIds = (prescription?.exercises ?? [])
            .filter { $0.reason.isCeilingOrGraduationMilestone }
            .map(\.exerciseId)
        let weekStartISO = WeekAnchor.isoWeekStart(now)
        let coachActions = CoachActionEngine.actions(input: CoachActionInput(
            call: verdict.call,
            trainedDaysThisWeek: trainedThisWeek,
            plannedDaysPerWeek: planned,
            totalSessionCount: cleanView.sessions.count,
            stalledExerciseIds: stalledIds,
            dataFindingCount: dataFindingCount,
            weekStartISO: weekStartISO,
            dismissals: appData.coachDismissals,
            volumeBoostAdoptedThisWeek: appData.volumeBoostWeeks.contains(weekStartISO)
        ))
        // 教练卡分流（FR-SUB1 修订）：**修数据卡永久免费**（数据可信属永不收费类），
        // 换更难变体 / 补量这两类优化建议属 Rede Coach。免费态直接不产出卡——
        // 不显示灰卡、不弹提示（owner 对重复弹窗零容忍），只在 Coach 页能力清单里列出。
        let visibleCoachActions = paidCoach.allows(.coachOptimization)
            ? coachActions
            : coachActions.filter { $0.kind == .dataReview }
        return .ready(TodayModel(
            verdict: verdict, prescription: prescription, cleanView: cleanView, now: now,
            coachActions: visibleCoachActions, substitutions: appData.exerciseSubstitutions,
            oneTimeSubstitutions: oneTimeToday,
            equipmentScenario: input.profile.equipmentScenario,
            daySequence: daySequence,
            scheduledDayCode: scheduledDayCode,
            weeklyCycleRestart: appData.weeklyCycleRestart
        ))
    }
}
