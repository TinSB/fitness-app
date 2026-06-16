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
            blockLengthWeeks: appData.mesocycle.blockLengthWeeks
        )
        return .ready(TodayModel(verdict: verdict, prescription: prescription, cleanView: cleanView, now: now))
    }
}
