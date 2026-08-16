import SwiftUI
import WatchKit
import RedeL10n
import RedeTrainingDecision
import RedeWatchLink

// Rede watchOS。
//
// 切片 1：target 空壳 + 证明核心包真的能在表上链接运行。
// 切片 2：WatchConnectivity 双向通道 + ping/pong 实跑。
// 切片 3：手机推今日处方，表上只读显示。
// 切片 4-7：记组、休息倒计时、HKWorkoutSession 保活、排队可见。
// v2（2026-08-15）：记组屏重做——重量 / 次数 / RIR 三个量都能在表上改；休息屏 +30 / 下一组；
//   热身可跳过；文案跟随手机 app 语言。
// v3（2026-08-15）：视觉锻铁仪表化——去瓦片、去橙胶囊；读数 + 刻度轨指针、锻面主按钮、
//   ember 休息环、开放行清单（令牌与工艺件在 WatchTheme.swift）。
//
// 范围纪律（方案 2026-08-12）：**表是训练进行时的遥控器，不是第二个 app**。
// 计划 / 进展 / 设置 / 动作库 / 引导全部留在手机。表上最终只有三屏：
// 当前动作 → 记组 → 休息倒计时。多一屏都是负担——表上滚动是最贵的交互。
//
// 真源纪律：**手机是唯一决策方**。表不复算处方——仓库里已有教训
//（TodayPrescriptionEngine.rotationBase 注释：app 层复算轮转必漂移，2026-07-08 实拍抓获）。
// 切片 3 把这条推到底：连显示串都在手机侧渲染好再传，表上零业务逻辑。
// v2 的重量梯子也是手机渲染好推来的：表只在格子间选，不算数。
@main
struct RedeWatchApp: App {
    var body: some Scene {
        WindowGroup {
            TodayWatchView()
        }
    }
}

/// 收到的处方 + 它是什么时候的。分开存是因为**过期判断要在表上做**：
/// applicationContext 会一直留着，手机三天没开机，表上那份也还在。
@MainActor
@Observable
final class WatchPrescriptionStore {
    private(set) var prescription: WatchPrescription?
    /// 手机发出这份处方的时刻。进行中的训练是否「过期」看它，不看日历日：
    /// 跨午夜的一场训练不能在 00:00 被判成昨天的残影，而手机某天中途放弃、之后没再开过的
    /// 那份 context 会一直带着那天的第 N 组——手机在训练中每记一组、每段休息都会推，
    /// 8 小时没推过就是没人在练了。
    private(set) var sentAt: Date?

    /// 进行中的训练是否已过期（v3.2）：距手机最后一次推送超过 8 小时。
    var activeIsStale: Bool {
        guard prescription?.active != nil, let sentAt else { return false }
        return Date().timeIntervalSince(sentAt) > 8 * 3600
    }

    func apply(_ envelope: WatchLinkEnvelope) {
        guard envelope.kind == WatchLinkKind.prescription,
              let data = envelope.payload,
              let rx = WatchPrescription(decoding: data)
        else { return }   // 未知 kind / 载荷看不懂：安静丢弃，保留上一份（向前兼容）
        prescription = rx
        sentAt = ISO8601DateFormatter().date(from: envelope.sentAtISO) ?? Date()
    }

    /// 表自己那几个词的语言。**跟随手机 app**（载荷里的 localeCode）——动作名、目标串都是
    /// 手机按 app 语言渲染的，表侧几个词若按表的系统语言取，同一屏就会中英混排。
    /// 旧手机不带 localeCode 时退回系统语言。
    var strings: RedeStrings {
        let code = prescription?.localeCode.flatMap(RedeLocale.init(rawValue:))
            ?? RedeLocale.resolve(fromLanguageCode: Locale.current.language.languageCode?.identifier)
        return RedeStrings(locale: code)
    }

    /// 记一组回传手机（切片 4；v2 三个量都可改）。**走 userInfo**：排队 + 保证送达，
    /// 不要求手机此刻可达——练到一半手机锁屏是常态，用 sendMessage 会静默丢数据。
    func logSet(active: WatchPrescription.Active, weightKg: Double, reps: Int, rir: Double?) {
        let set = WatchLoggedSet(
            exerciseId: active.exerciseId,
            setNumber: active.setNumber,
            // 重量要么是手机给的目标原值，要么是手机推来的梯子上选中那一格的 kg 原值。
            // 表不重算——器械梯子吸附在手机侧做过了。
            weightKg: weightKg,
            reps: reps,
            rir: rir,
            loggedAtISO: ISO8601DateFormatter().string(from: Date()),
            // 必带：手机据此分流。漏了就会把热身当成一组正式组落库——
            // 用户还在空杆，记录里已经多出一组工作重量。
            isWarmup: active.isWarmup)
        guard let payload = set.encoded else { return }
        WatchLink.shared.send(
            WatchLinkEnvelope(kind: WatchLinkKind.loggedSet,
                              sentAtISO: ISO8601DateFormatter().string(from: Date()),
                              payload: payload),
            via: .userInfo)
    }

    /// 遥控命令（v2）：休息 +30 / 跳过休息 / 跳过热身。**走 message**：只在此刻有意义，
    /// 手机够不着就让它失败（按钮已按可达性置灰），不排队等一个过期的执行。
    /// 表永不自己推进——这里只是把用户的意图（或「倒计时走完了」这个事实）告诉手机，
    /// 下一步仍由手机的引擎决定后推回来。
    func send(_ action: WatchCommand.Action, active: WatchPrescription.Active, auto: Bool = false,
              reason: String? = nil, setNumber: Int? = nil) {
        let now = ISO8601DateFormatter().string(from: Date())
        let command = WatchCommand(action: action, exerciseId: active.exerciseId, auto: auto, sentAtISO: now,
                                   reason: reason, setNumber: setNumber)
        guard let payload = command.encoded else { return }
        WatchLink.shared.send(
            WatchLinkEnvelope(kind: WatchLinkKind.command, sentAtISO: now, payload: payload),
            via: .message)
    }

    /// 今天的本地日历日。与手机侧、引擎同口径（en_US_POSIX + 当前时区）。
    static var todayISO: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}


struct TodayWatchView: View {
    @StateObject private var link = WatchLink.shared
    @State private var store = WatchPrescriptionStore()
    @StateObject private var workout = WorkoutSessionKeeper()

    private var s: RedeStrings { store.strings }

    private var isStale: Bool {
        guard let rx = store.prescription else { return false }
        return rx.dateISO != WatchPrescriptionStore.todayISO
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    /// 权限门（v3.2，owner 拍板：整个表 app 以「健身记录」写入权限为前提）。
    /// 没有它 HKWorkoutSession 起不来，手腕一放下 app 就被挂起——到点不震、自动推进不发，
    /// 而屏幕上什么都不会说。与其让功能静默失效，不如在门口把话说清楚。
    /// 截图钩子跳过这道门（-watchPreview gate 单独预览门本身）。
    private var needsHealthGate: Bool {
        if WatchPreview.isActive { return WatchPreview.previewsGate }
        return workout.workoutWriteAuthorized != true
    }

    /// 进行中的训练。**过期的不算**：手机某天中途放弃、之后没再开过，表上那份 context 里
    /// 还带着那天的第 N 组——不判就会一直冒充「进行中」（v3.2）。判据是手机最后一次推送
    /// 距今 8 小时（见 activeIsStale），不是日历日：跨午夜的训练不能在 00:00 被切回清单。
    private var liveActive: WatchPrescription.Active? {
        guard let active = store.prescription?.active, !store.activeIsStale else { return nil }
        return active
    }

    var body: some View {
        // NavigationStack 只为了给记组屏的角落钮（.toolbar）一个宿主；不设标题，不推页。
        NavigationStack {
        ZStack {
            if needsHealthGate {
                HealthGateView(denied: workout.workoutWriteAuthorized == false, strings: s) {
                    Task { await workout.requestAuthorization() }
                }
                .transition(WatchMotion.morphTransition(reduceMotion: reduceMotion))
            } else if let active = liveActive {
                // 训练进行时：这一屏只做一件事——记当前这一组。
                //
                // **故意不套 ScrollView**，两个理由：
                // · 数码表冠在 ScrollView 里会被滚动吃掉，调不了数值（真机实测）
                // · 「完成」按钮必须永远整颗可见。小号表上一滚动它就只剩半截，
                //   而这是这块屏上唯一重要的操作（owner 真机反馈）
                // 所以这一屏必须在最小表盘上一屏放下——放不下就是设计要减，不是加滚动。
                ActiveSetView(active: active, store: store)
                    .padding(.horizontal, 6)
                    .transition(WatchMotion.morphTransition(reduceMotion: reduceMotion))
            } else {
                idleList
                    .transition(WatchMotion.morphTransition(reduceMotion: reduceMotion))
            }
        }
        // 清单 ⇄ 训练 ⇄ 权限门：原地 morph（手机 hero 的 set ⇄ rest 同款 0.22s），不是硬切。
        .animation(WatchMotion.morph, value: "\(needsHealthGate)#\(liveActive != nil)")
        // 整面板：一块连续锻面，铺满到屏幕边（含圆角），数字直接蚀刻在上面。
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WatchPalette.base.ignoresSafeArea())
        }
        .task {
            workout.refreshAuthorization()
            // 截图钩子：-watchPreview list|set|warmup|rest|bodyweight|done|gate [-watchPreviewLocale en]
            // 不配对也能在各尺寸模拟器上看各种状态。**不激活通道**，免得配对机的真处方把预览冲掉。
            if let preview = WatchPreview.fromArguments() {
                store.apply(preview)
                return
            }
            // onReceive 必须在 activate 之前挂：激活完成后系统会立刻投递
            // 已存的 applicationContext，晚挂就会漏掉第一份。
            WatchLink.shared.onReceive = { [store] envelope, _ in store.apply(envelope) }
            link.activate()
        }
        // 用户可能刚去设置里开了权限再回来：回前台重读一次，门自己开。
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { workout.refreshAuthorization() }
        }
        // 切片 6：手机说在练 → 拉起 HKWorkoutSession（否则放下手腕几秒 app 就被挂起，
        // 倒计时死在半路）；手机说练完 → 收掉并写回健康。
        // 用 onChange 而不是在 body 里调：sync 虽然幂等，但每帧调一次是噪音。
        // 权限门没过时不拉（起不来）；门一开（authorized 翻 true）这条 onChange 的键也变，会立刻补拉。
        .onChange(of: "\(liveActive != nil)#\(workout.workoutWriteAuthorized == true)", initial: true) { _, _ in
            guard !WatchPreview.isActive, workout.workoutWriteAuthorized == true else { return }
            workout.sync(trainingActive: liveActive != nil)
        }
    }

    /// 空态诊断行开关：长按空态提示 1 秒切换。**默认藏起来**——上架版不能让新用户看到原始日志，
    /// 但真机卡在空态时它是唯一的线索（2026-08-15 实测：净室冷启动模拟器必过、真机必挂），所以不删。
    @State private var showDiagnostics = false

    /// 今天练完了（v3.2）：手机记录里今天已有 N 组、且没有进行中的训练。
    private var doneSetsToday: Int? {
        guard let rx = store.prescription, !isStale, liveActive == nil,
              let sets = rx.completedSetsToday, sets > 0 else { return nil }
        return sets
    }

    /// 没在训练：今天的清单。开放行 + 刻线（整面板公理 §12.3「动作列表 = 开放行，禁描边按钮堆」），
    /// 第一行带一条 ember 竖线——Emberline 指向今天要开始的地方，与手机今日页同一手势；
    /// 练完了就不画（没有「下一步」了）。
    private var idleList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                if let rx = store.prescription {
                    if isStale {
                        // 过期不隐藏内容——健身房里「看得见但标明是旧的」比空白有用得多。
                        notice(verbatim: s.watchStalePlan(dateISO: rx.dateISO))
                    }
                    if let sets = doneSetsToday {
                        doneHeader(sets: sets)
                    }
                    if rx.exercises.isEmpty {
                        notice(verbatim: s.watchRestDay)
                    } else {
                        ForEach(Array(rx.exercises.enumerated()), id: \.element.exerciseId) { index, item in
                            exerciseRow(item, isNext: index == 0 && !isStale && doneSetsToday == nil)
                        }
                    }
                } else {
                    notice(verbatim: link.isReachable ? s.watchFetchingPlan : s.watchOpenPhone)
                        .contentShape(Rectangle())
                        .onLongPressGesture(minimumDuration: 1) { showDiagnostics.toggle() }
                    // 空态诊断行。**只在没拿到计划、且长按提示语打开时出现**。
                    //
                    // 存在的理由：真机卡在空态时，模拟器复现不出来（2026-08-15 实测：
                    // 净室冷启动在模拟器上必过，真机必挂）。没有这一行，两端都只能猜。
                    // 三个值各自指向完全不同的原因：
                    //   激活 NO      → 表侧 WCSession 就没起来
                    //   手机端 NO    → 手机上装的那个 Rede 不含表支持（版本不对）
                    //   激活/手机端 YES 但没计划 → 手机侧确实没推出来
                    if showDiagnostics {
                        Text(verbatim: "激活 \(link.isActivated ? "YES" : "NO") · 手机端 \(link.hasCounterpart ? "YES" : "NO") · 可达 \(link.isReachable ? "YES" : "NO")")
                            .font(.system(size: 9, design: .monospaced))
                            .foregroundStyle(WatchPalette.t3)
                        ForEach(Array(link.log.suffix(6).enumerated()), id: \.offset) { _, line in
                            Text(verbatim: line)
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundStyle(WatchPalette.t3)
                                .lineLimit(2)
                        }
                    }
                }
            }
            .padding(.horizontal, 6)
        }
    }

    /// 练完态：一行结论 + 一行去处。不用橙色（橙色只表示下一步，练完了没有下一步）。
    private func doneHeader(sets: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: s.watchDoneToday(sets: sets))
                .font(.system(size: 15, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(WatchPalette.t1)
            Text(verbatim: s.watchDoneHint)
                .font(.system(size: 11))
                .foregroundStyle(WatchPalette.t3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
        .overlay(alignment: .bottom) { Rectangle().fill(WatchPalette.hair).frame(height: 1) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            // 词标走仪表小标签（钢色 + 字距），不用橙色：橙色只表示下一步。
            InstrumentCaption(text: "REDE")
            Text(verbatim: store.prescription?.dayTitle.isEmpty == false
                 ? store.prescription!.dayTitle
                 : s.tabToday)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(WatchPalette.t1)
        }
        .padding(.bottom, 8)
    }

    private func exerciseRow(_ item: WatchPrescription.Item, isNext: Bool) -> some View {
        HStack(alignment: .top, spacing: 8) {
            // 第一行的 Emberline：今天从这里开始。其余行留同宽空位，文字对齐。
            Rectangle()
                .fill(isNext ? WatchPalette.ember : Color.clear)
                .frame(width: 2)
                .padding(.vertical, 2)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: item.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(WatchPalette.t2)
                    .lineLimit(2)
                // 目标是这一屏唯一要在两米外看清的东西——练的时候手表离眼睛就那么远。
                Text(verbatim: item.targetText)
                    .font(.system(size: 17, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(WatchPalette.t1)
                    .lineLimit(1).minimumScaleFactor(0.8)
                Text(verbatim: item.setsText)
                    .font(.system(size: 11))
                    .foregroundStyle(WatchPalette.t3)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 7)
        .overlay(alignment: .bottom) { Rectangle().fill(WatchPalette.hair).frame(height: 1) }
    }

    private func notice(verbatim text: String) -> some View {
        Text(verbatim: text)
            .font(.system(size: 12))
            .foregroundStyle(WatchPalette.t3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 6)
    }
}

/// 健康写入权限门（v3.2）。整个表 app 以「健身记录」写入权限为前提（owner 拍板）：
/// 没有它 HKWorkoutSession 起不来，手腕一放下 app 就被挂起，到点不震、自动推进不发。
/// 一句为什么 + 一颗「允许」；被拒绝过的系统不会再弹框，只能去设置里开——把两条路都写出来。
struct HealthGateView: View {
    let denied: Bool
    let strings: RedeStrings
    let onAllow: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                InstrumentCaption(text: "REDE")
                Text(verbatim: strings.watchHealthGateTitle)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(WatchPalette.t1)
                    .padding(.top, 2)
                Text(verbatim: denied ? strings.watchHealthGateDeniedBody : strings.watchHealthGateBody)
                    .font(.system(size: 12))
                    .foregroundStyle(WatchPalette.t3)
                    .padding(.top, 6)
                EmbWatchButton(icon: denied ? "arrow.clockwise" : "checkmark",
                               title: denied ? strings.watchHealthGateRecheck : strings.watchHealthGateAllow,
                               action: onAllow)
                    .padding(.top, 12)
            }
            .padding(.horizontal, 6)
        }
    }
}

/// 记组屏（切片 4 → v2 三个量可改 → v3 锻铁仪表化）。表上唯一会改动落盘数据的界面。
///
/// 造型（v3，2026-08-15）：**一块连续锻面上的三个读数 + 一条刻度轨 + 一颗锻面主按钮**。
/// · 三个数字直接蚀刻在底上，没有框：重量是主读数（大一号），次数与 RIR 是副读数。
///   不操作时它们就是抬腕要看的东西——目标重量、次数、RIR 并排，两米外读得清。
/// · 三个读数下面横着一条刻线，就是手机快改面板的**刻度轨**；轨上的 ember 指针指着
///   表冠此刻在调的那个读数。要改：**点一个读数、转表冠**（watchOS 计时器设时分的手法）。
///   改过的读数变 ember——练的时候一眼要能看出「这不是处方给的数」。次数默认选中：
///   它是最常偏离目标的量。
/// · 主按钮是与手机同一件锻面主按钮（raised 底 + hair 轮廓 + 3pt ember 左缘），不是橙色胶囊。
/// · 重量在**手机推来的真实梯子**上选（器械 × 单位的格子，含目标那一格），表不算数。
/// · 自重 / 弹力带没有重量轴（梯子为空）→ 只有次数与 RIR 两个读数，与手机快改面同口径。
///
/// 布局纪律（2026-08-15 owner 真机反馈后确立）：
/// · **一屏放下，不滚动**。小号表上一滚，「完成」就只剩半截——而它是这块屏上唯一重要的操作。
/// · 训练时不显示词标 / 训练日名。那两行在手机上已经有了，练的时候每一像素都该给动作本身。
///
/// 表冠必须显式拿到焦点，否则会被外层滚动吃掉（真机实测：转表冠在滑页面）。
struct ActiveSetView: View {
    let active: WatchPrescription.Active
    let store: WatchPrescriptionStore

    /// 表冠此刻在调哪个读数。
    enum Field: Hashable { case weight, reps, rir }
    @FocusState private var focus: Field?
    /// 焦点的**真值**。系统会自作主张重置焦点到第一块可聚焦视图（配对模拟器实测：
    /// 拉起 HKWorkoutSession 后焦点从次数跳回重量），所以「用户想调哪个」由这里持有，
    /// 系统动过就抢回来（见 onChange(of: focus)）。默认次数：它是最常偏离目标的量。
    @State private var chosenField: Field = .reps

    /// 三个表冠绑定值。用 Double 是因为 digitalCrownRotation 要连续量；显示时取整。
    /// weightIdx 是梯子下标；rirIdx 0 = 「—」不记，1…6 = RIR 0…5（与手机 RIR 直选带同序）。
    @State private var weightIdx: Double = 0
    @State private var repsDial: Double = 0
    @State private var rirIdx: Double = 3
    /// 本地乐观态：点完立刻变，不等手机把新一组推回来。
    @State private var justLogged = false
    /// 「更多」页（v3.2）：跳过本组的理由。从记组屏左上角的角落钮进。
    @State private var showMore = false
    /// 排队中的组数 + 可达性。手机够不着时「已记录」是半个真话——组确实记下了，但还没过去。
    @ObservedObject private var link = WatchLink.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var s: RedeStrings { store.strings }
    private var rungs: [WatchPrescription.WeightRung] { active.adjust?.weightRungs ?? [] }
    private var hasWeightAxis: Bool { !rungs.isEmpty }
    /// 梯子上离目标最近的那一格（手机把目标吸附后放进了梯子，通常就是正中那格）。
    private var targetRungIndex: Int {
        rungs.indices.min { abs(rungs[$0].kg - active.targetWeightKg) < abs(rungs[$1].kg - active.targetWeightKg) } ?? 0
    }
    private var weightIndex: Int { min(max(Int(weightIdx.rounded()), 0), max(rungs.count - 1, 0)) }
    private var reps: Int { max(1, Int(repsDial.rounded())) }
    private var rir: Int? {
        let i = Int(rirIdx.rounded())
        return i <= 0 ? nil : min(i, 6) - 1
    }
    private var targetRir: Int { Int(active.targetRir) }

    private var weightChanged: Bool { hasWeightAxis && weightIndex != targetRungIndex }
    private var repsChanged: Bool { reps != active.targetReps }
    private var rirChanged: Bool { rir != targetRir }

    /// 回传的重量：没动过就是手机给的原值（与手机自己不调整时落库的值逐位一致），
    /// 动过就是选中那一格的 kg。
    private var chosenWeightKg: Double { weightChanged ? rungs[weightIndex].kg : active.targetWeightKg }

    private var buttonTitle: String {
        if justLogged { return s.watchLogged }
        return active.isWarmup ? s.warmupDone : s.trainLogSet
    }

    /// 只在真有东西排队时出现。**不能只说「已记录」**——手机够不着时那是半个真话，
    /// 组确实记下了，但还没过去。说清楚「排队中」，用户才知道不用重按、也没丢。
    @ViewBuilder private var pendingHint: some View {
        if link.pendingTransfers > 0 {
            Text(verbatim: s.watchPendingSets(link.pendingTransfers))
                .font(.system(size: 10))
                .foregroundStyle(WatchPalette.t3)
        }
    }

    /// 三屏（记组 / 热身 / 休息）之间的 morph 键。
    private var screenKey: String { active.isResting ? "rest" : (active.isWarmup ? "warmup" : "set") }

    var body: some View {
        // 休息中整屏换成倒计时。**不是把按钮置灰了事**——休息是训练里最长的一段，
        // 也是最该抬腕就看到的东西；这一刻屏幕上该有的只有「还剩多久」。
        // 三屏之间原地 morph（透明度 + 0.98 缩放，0.22s）——与手机 hero 的 set ⇄ rest 同一口径，
        // 记完一组按钮变「已记录」、手机推回休息、环淡入，是一个连贯的手势而不是三次硬切。
        ZStack {
            if active.isResting {
                RestCountdownView(active: active, store: store)
                    .transition(WatchMotion.morphTransition(reduceMotion: reduceMotion))
            } else if active.isWarmup {
                warmupBody
                    .transition(WatchMotion.morphTransition(reduceMotion: reduceMotion))
            } else {
                setBody
                    .transition(WatchMotion.morphTransition(reduceMotion: reduceMotion))
            }
        }
        .animation(WatchMotion.morph, value: screenKey)
    }

    // MARK: - 正式组：三个读数 + 刻度轨

    /// 进度行：左「3/6 · 第 2/4 组」，右本动作的组刻标。
    private var progressLine: some View {
        HStack(alignment: .center) {
            Text(verbatim: s.watchProgress(exercise: active.exerciseNumber, exerciseTotal: active.exerciseTotal,
                                           set: active.setNumber, setTotal: active.setTotal))
                .font(.system(size: WatchMetrics.meta))
                .monospacedDigit()
                .foregroundStyle(WatchPalette.t3)
            Spacer(minLength: 4)
            if active.setTotal <= 8 {   // 组数多到刻标放不下就只留文字
                SetMarks(total: active.setTotal, current: active.setNumber)
            }
        }
    }

    private var setBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            progressLine
            Text(verbatim: active.exerciseName)
                .font(.system(size: WatchMetrics.title, weight: .semibold))
                .foregroundStyle(WatchPalette.t2)
                .lineLimit(1).minimumScaleFactor(0.7)
                .padding(.top, 1)

            // 读数簇。重量占一半、次数与 RIR 各四分之一：重量是这一屏的主读数
            //（与手机 hero 同口径），三位数带小数的「137.5 lb」也放得下。
            HStack(alignment: .bottom, spacing: 0) {
                if hasWeightAxis {
                    reading(.weight, value: rungs[weightIndex].text, size: WatchMetrics.hero,
                            caption: active.adjust?.weightCaption ?? "", uppercase: false, changed: weightChanged)
                }
                HStack(alignment: .bottom, spacing: 0) {
                    reading(.reps, value: "\(reps)", size: WatchMetrics.secondary,
                            caption: s.trainColReps, changed: repsChanged)
                    reading(.rir, value: rir.map(String.init) ?? s.adjustRirSkip, size: WatchMetrics.secondary,
                            caption: s.trainColRir, changed: rirChanged)
                }
            }
            // 刻度轨：一条通长刻线 + 一枚 ember 指针，压在读数簇脚下。指针只有一枚，
            // 位置按选中列的中心算、用 offset 滑过去（手机刻度轨 caretX 同一做法）——
            // 不用 matchedGeometryEffect：焦点 / 条件插入那条路在表上不出中间帧（逐帧实测）。
            .overlay(alignment: .bottom) {
                GeometryReader { geo in
                    let x = caretX(width: geo.size.width)
                    ZStack(alignment: .topLeading) {
                        Rectangle().fill(WatchPalette.etch).frame(height: 1)
                        RailCaret()
                            .offset(x: x - 3.5)
                            .animation(reduceMotion ? nil : WatchMotion.caret, value: x)
                    }
                }
                .frame(height: 11)
            }
            .padding(.top, 8 * WatchMetrics.scale)
            .allowsHitTesting(!justLogged)
            .opacity(justLogged ? 0.6 : 1)

            Spacer(minLength: 3)
            pendingHint

            EmbWatchButton(icon: "checkmark", title: buttonTitle, enabled: !justLogged) {
                store.logSet(active: active, weightKg: chosenWeightKg, reps: reps, rir: rir.map(Double.init))
                justLogged = true
                WKInterfaceDevice.current().play(.success)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // 手机推来新一步 → 复位三个值、按钮与焦点。键里带 exerciseId 与 isWarmup：
        // 换动作时 setNumber 会回到 1，热身转正式组时也会——只看 setNumber 会漏。
        .onChange(of: "\(active.exerciseId)#\(active.isWarmup)#\(active.setNumber)", initial: true) {
            weightIdx = Double(targetRungIndex)
            repsDial = Double(active.targetReps)
            rirIdx = Double(min(max(targetRir, 0), 5) + 1)
            justLogged = false
            withAnimation(reduceMotion ? nil : WatchMotion.caret) { chosenField = .reps }
            focus = .reps
        }
        // 焦点被系统动过（重置到第一块 / 收走）→ 抢回用户选的那个。
        // 这一屏上除了用户点读数没有别的合法焦点来源，所以凡是与真值不符的都是系统干的。
        .onChange(of: focus) { _, now in
            if now != chosenField { focus = chosenField }
        }
        // 「已记录」等手机推回来的这几百毫秒：读数簇退到 0.6，与按钮一起表示「已提交、别再动」。
        .animation(WatchMotion.tint, value: justLogged)
        // 「更多」：watchOS 10 的角落钮（时间对面那一角），不占记组屏一像素竖向空间。
        // 里面只有一件事：跳过本组（带手机同一套理由码）。手机不可达时不给按。
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    showMore = true
                } label: {
                    Image(systemName: "ellipsis")
                }
                .disabled((!link.isReachable && !WatchPreview.isActive) || justLogged)
                .accessibilityLabel(Text(verbatim: s.moreActions))
            }
        }
        .sheet(isPresented: $showMore) {
            SkipSetSheet(strings: s) { reason in
                showMore = false
                store.send(.skipSet, active: active, reason: reason, setNumber: active.setNumber)
                WKInterfaceDevice.current().play(.click)
            }
        }
    }

    /// 指针在刻度轨上的 x：选中列的中心。列宽与读数簇布局同一口径——有重量轴时
    /// 重量占一半、次数与 RIR 各四分之一；没有重量轴时两列各一半。
    private func caretX(width: CGFloat) -> CGFloat {
        if hasWeightAxis {
            switch chosenField {
            case .weight: return width * 0.25
            case .reps: return width * 0.625
            case .rir: return width * 0.875
            }
        }
        return chosenField == .rir ? width * 0.75 : width * 0.25
    }

    /// 一个读数：数字 + 仪表小标签。点它 = 表冠转它，脚下的指针沿刻度轨滑过去。
    private func reading(_ field: Field, value: String, size: CGFloat, caption: String,
                         uppercase: Bool = true, changed: Bool) -> some View {
        // 指针跟 chosenField（真值）走，不跟 @FocusState 走：焦点系统的更新不在 withAnimation
        // 的事务里落地，指针会「跳」过去而不是「滑」过去（模拟器逐帧实测）。焦点自己随后跟上。
        let focused = chosenField == field
        return VStack(spacing: 0) {
            Text(verbatim: value)
                .font(.system(size: size, weight: .semibold))
                .monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.55)
                .foregroundStyle(changed ? WatchPalette.ember : WatchPalette.t1)
                .contentTransition(.numericText())
                .animation(.easeOut(duration: 0.12), value: value)
                // 回到处方值 / 离开处方值：颜色渐变，不是跳变。
                .animation(WatchMotion.tint, value: changed)
                .frame(maxWidth: .infinity)
            InstrumentCaption(text: caption, uppercase: uppercase)
                .padding(.top, 1)
            // 脚下给刻度轨留位（轨与指针由读数簇的 overlay 统一画）。
            Color.clear.frame(height: 11).padding(.top, 5)
        }
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle())
        .onTapGesture {
            guard chosenField != field else { return }
            withAnimation(reduceMotion ? nil : WatchMotion.caret) { chosenField = field }
            focus = field
            WKInterfaceDevice.current().play(.click)
        }
        .focusable(true)
        .focused($focus, equals: field)
        .modifier(CrownBinding(field: field, weightIdx: $weightIdx, repsDial: $repsDial, rirIdx: $rirIdx,
                               rungCount: rungs.count))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "\(caption) \(value)"))
        .accessibilityAddTraits(focused ? .isSelected : [])
    }

    // MARK: - 热身：只显示这一步做什么 + 完成 / 跳过

    private var warmupBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: s.warmupProgress(index: active.setNumber, total: active.setTotal))
                .font(.system(size: WatchMetrics.meta))
                .monospacedDigit()
                .foregroundStyle(WatchPalette.ember2)   // 与手机热身态 overline 同色
            Text(verbatim: active.exerciseName)
                .font(.system(size: WatchMetrics.title, weight: .semibold))
                .foregroundStyle(WatchPalette.t2)
                .lineLimit(1).minimumScaleFactor(0.7)
                .padding(.top, 1)
            // 热身时这里是「空杆 ×8」，绝不会是工作重量。热身不记次数、不落库，所以没有读数簇。
            Text(verbatim: active.targetText)
                .font(.system(size: WatchMetrics.hero, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(WatchPalette.t1)
                .lineLimit(1).minimumScaleFactor(0.6)
                .padding(.top, 8 * WatchMetrics.scale)

            Spacer(minLength: 3)
            pendingHint

            // 跳过热身走 message：手机不可达时不给按——按了没反应比按不了更糟。
            // 文字级操作而不是第二颗按钮：热身屏只有一个主动作（完成），跳过是让路的次选，
            // 与手机热身态「完成 = 主按钮 / 跳过 = 一行小字」同一主次。
            Button {
                store.send(.skipWarmup, active: active)
                WKInterfaceDevice.current().play(.click)
            } label: {
                Text(verbatim: s.warmupSkip)
                    .font(.system(size: WatchMetrics.meta + 1))
                    .foregroundStyle(link.isReachable ? WatchPalette.t4 : WatchPalette.t4.opacity(0.4))
                    .frame(maxWidth: .infinity, minHeight: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.watchPressableText)
            .disabled(!link.isReachable)

            EmbWatchButton(icon: "checkmark", title: buttonTitle, enabled: !justLogged) {
                // 热身步：三个量原样回传（手机只看 exerciseId + 步序号 + isWarmup，不落库）。
                store.logSet(active: active, weightKg: active.targetWeightKg, reps: active.targetReps, rir: active.targetRir)
                justLogged = true
                WKInterfaceDevice.current().play(.click)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .onChange(of: "\(active.exerciseId)#\(active.isWarmup)#\(active.setNumber)", initial: true) {
            justLogged = false
        }
    }
}

/// 把「哪个读数被选中」翻译成对应的表冠绑定。三个读数的范围各不相同：
/// 重量 = 梯子下标；次数 1…50；RIR 0…6（0 是「—」）。
/// 拆成 modifier 是因为 digitalCrownRotation 的绑定必须在编译期定下，
/// 三个读数各挂各的，只有拿到焦点的那个会收到表冠事件。
private struct CrownBinding: ViewModifier {
    let field: ActiveSetView.Field
    @Binding var weightIdx: Double
    @Binding var repsDial: Double
    @Binding var rirIdx: Double
    let rungCount: Int

    func body(content: Content) -> some View {
        switch field {
        case .weight:
            content.digitalCrownRotation($weightIdx, from: 0, through: Double(max(rungCount - 1, 0)), by: 1,
                                         sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
        case .reps:
            content.digitalCrownRotation($repsDial, from: 1, through: 50, by: 1,
                                         sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
        case .rir:
            content.digitalCrownRotation($rirIdx, from: 0, through: 6, by: 1,
                                         sensitivity: .low, isContinuous: false, isHapticFeedbackEnabled: true)
        }
    }
}

/// 「更多 → 跳过本组」（v3.2）。与手机「更多」面同一份理由码与文案；开放行 + 刻线（§12.3）。
/// 只放跳过本组：换动作、跳过整个动作、登记不适仍留手机（owner 拍板）。
struct SkipSetSheet: View {
    let strings: RedeStrings
    let onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    private let reasons = ["equipmentBusy", "painDiscomfort", "fatigue", "timeShort"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                InstrumentCaption(text: strings.skipSetAction)
                    .padding(.bottom, 4)
                ForEach(reasons, id: \.self) { code in
                    Button {
                        onPick(code)
                    } label: {
                        Text(verbatim: strings.skipReasonLabel(code))
                            .font(.system(size: 15))
                            .foregroundStyle(WatchPalette.t1)
                            .frame(maxWidth: .infinity, minHeight: 38, alignment: .leading)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.watchPressableText)
                    .overlay(alignment: .bottom) { Rectangle().fill(WatchPalette.hair).frame(height: 1) }
                }
            }
            .padding(.horizontal, 6)
        }
        .background(WatchPalette.base.ignoresSafeArea())
    }
}

/// 休息倒计时（切片 5 → v2 加 +30 / 下一组 → v3 环形）。
///
/// 造型：**一枚 ember 进度环，倒计时蚀刻在环心**，与灵动岛胶囊「左环右数」、锁屏卡同一家族
///（设计语言 §7.1：ember 单焦点 = 倒计时数字 + 其图形化身）。环下一行「下一组 60 kg × 8」，
/// 再下两颗机加工圆钮：+30（钢色轮廓）、下一组（ember 轮廓 = 主动作）。
/// **陈旧态全灰化**：走到 0:00 还没等来手机的下一组时，数字与环退 T3——不许橙色假活。
///
/// **数字算自手机给的绝对结束时刻，不是手机每秒发过来的剩余秒数。**
/// 后者的话，消息延迟多久倒计时就差多久，还得每秒收一条消息；
/// 前者只需要一份状态，之后表自己按墙钟走——延迟、丢包、app 被挂起后重开都不影响。
/// remaining/fraction 直接用引擎里的 RestCountdown，两端同一份实现，不会漂。
///
/// 归零那一下必须**震**：健身房里没人盯着表看完 90 秒。
/// 这也是切片 6 的 HKWorkoutSession 存在的理由——没有它，手腕放下后 app 被挂起，
/// 这一震就不会发生。
///
/// v2：归零同时**告诉手机**「休息走完了」（WatchCommand.restSkip, auto）。手机在口袋里
/// 时它自己不会推进（休息计时器活在手机训练页上，后台不跑）——不发这条，表就停在 0:00
/// 等用户去掏手机，那正是表最该有用的时候。手机收到后照它自己的规则推进、把下一组推回来；
/// 表上永远不自己决定下一组是什么。手机 app 被划掉时这条送不到，表就停在 0:00（有意为之）。
struct RestCountdownView: View {
    let active: WatchPrescription.Active
    let store: WatchPrescriptionStore
    @ObservedObject private var link = WatchLink.shared
    /// 常亮显示（手腕放下、屏幕变暗）时为 true。这时屏上只该剩「还剩多久」：
    /// 两颗圆钮收起（暗屏下也按不着，抬腕点亮再出现），环与数字留着，
    /// HKWorkoutSession 在跑所以 TimelineView 仍每秒刷新——这正是抬腕即读的那一眼。
    @Environment(\.isLuminanceReduced) private var luminanceReduced

    private var s: RedeStrings { store.strings }

    private var countdown: RestCountdown {
        RestCountdown(endDate: active.restEndsAt,
                      pausedRemaining: active.restPausedRemaining,
                      totalSeconds: active.restTotalSeconds)
    }

    private var isPaused: Bool { active.restPausedRemaining != nil }

    var body: some View {
        VStack(spacing: 0) {
            // TimelineView 而不是自己跑 Timer：系统按需重绘，表被抬起时才刷，省电。
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let remaining = countdown.remaining(now: context.date)
                let stale = remaining == 0            // 走完了、还在等手机 → 全灰，不许橙色假活
                let accent = stale ? WatchPalette.t3 : WatchPalette.ember
                ZStack {
                    Circle()
                        .stroke(WatchPalette.etch, lineWidth: WatchMetrics.ringStroke)   // 轨道 = 刻线色，暗但看得见
                    Circle()
                        .trim(from: 0, to: max(0.002, countdown.fraction(now: context.date)))
                        .stroke(accent, style: StrokeStyle(lineWidth: WatchMetrics.ringStroke, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: remaining)
                    VStack(spacing: 1) {
                        InstrumentCaption(text: isPaused ? s.watchRestPaused : s.restLabel)
                        Text(verbatim: Self.clock(remaining))
                            .font(.system(size: WatchMetrics.clock, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(accent)
                            .lineLimit(1).minimumScaleFactor(0.6)
                            .contentTransition(.numericText(countsDown: true))
                    }
                    .padding(.horizontal, WatchMetrics.ringStroke + 4)
                }
                .frame(width: WatchMetrics.ring, height: WatchMetrics.ring)
                // 走到 0:00 → 数字与环一起退灰（渐变，不闪）；手机推回下一组时整屏 morph 走人。
                .animation(WatchMotion.tint, value: stale)
            }

            // 环下一行：优先说清楚状态（排队 / 不可达），否则说下一组是什么——
            // 休息时最想知道的第二件事，省得倒计时结束还要再翻一屏。
            Group {
                if link.pendingTransfers > 0 {
                    Text(verbatim: s.watchPendingSets(link.pendingTransfers))
                } else if !link.isReachable {
                    Text(verbatim: s.watchPhoneUnreachable)
                } else {
                    // 手机渲染的「下一组 · 第 3 组 · 60 kg × 6」/「接下来 · 高位下拉」；
                    // 旧手机不带这一位时退回「下一组 + 目标串」。
                    Text(verbatim: active.restPreviewText ?? s.watchNextUp(active.targetText))
                }
            }
            .font(.system(size: WatchMetrics.meta))
            .monospacedDigit()
            .foregroundStyle(WatchPalette.t3)
            .lineLimit(1).minimumScaleFactor(0.7)
            .padding(.top, 5)

            Spacer(minLength: 4)

            // 两颗圆钮走 message，只在手机够得着时能按。+30 是次级，下一组是主动作
            //（ember 轮廓）——与手机休息屏「+30s 钢钮 / 下一组 锻面主钮」的主次一致。
            HStack(spacing: 10) {
                MachinedRoundButton(enabled: link.isReachable && !luminanceReduced, action: {
                    store.send(.restAdd30, active: active)
                    WKInterfaceDevice.current().play(.click)
                }) {
                    Text(verbatim: s.restAdd30)
                        .font(.system(size: 13, weight: .semibold))
                        .monospacedDigit()
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                .accessibilityLabel(Text(verbatim: s.restAdd30))
                // 暂停 / 继续（v3.2）：暂停时环与数字冻结、标题变「休息 · 已暂停」，钮变 ▶。
                MachinedRoundButton(enabled: link.isReachable && !luminanceReduced, action: {
                    store.send(.restPauseToggle, active: active)
                    WKInterfaceDevice.current().play(.click)
                }) {
                    Image(systemName: isPaused ? "play.fill" : "pause.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .contentTransition(.symbolEffect(.replace))
                }
                .accessibilityLabel(Text(verbatim: isPaused ? s.restResume : s.restPause))
                MachinedRoundButton(primary: true, enabled: link.isReachable && !luminanceReduced, action: {
                    store.send(.restSkip, active: active)
                    WKInterfaceDevice.current().play(.click)
                }) {
                    Image(systemName: "forward.fill")
                        .font(.system(size: 14, weight: .semibold))
                }
                .accessibilityLabel(Text(verbatim: s.restNextSet))
            }
            // 常亮暗屏：圆钮整排淡出（0.18s），抬腕点亮再淡回来。
            .opacity(luminanceReduced ? 0 : 1)
            .animation(WatchMotion.tint, value: luminanceReduced)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        // 精确在结束时刻震一下 + 告诉手机，不轮询。
        // task(id:) 绑 endDate：手机上「+30 秒」会换一个结束时刻 → 任务重启，重新定时。
        .task(id: active.restEndsAt) {
            guard let end = active.restEndsAt else { return }
            let delay = end.timeIntervalSinceNow
            if delay > 0 {
                try? await Task.sleep(for: .seconds(delay))
                guard !Task.isCancelled else { return }
                WKInterfaceDevice.current().play(.notification)
            }
            // 已经结束了就别补震——那只会莫名其妙；但仍要告诉手机（它可能还在等）。
            // 手机侧只在它自己的钟也走完时才接受 auto，所以这条发多了无害。
            store.send(.restSkip, active: active, auto: true)
        }
    }

    /// mm:ss。超过 1 小时不特殊处理——组间休息不会有那么长，真出现了显示 99:59 也无妨。
    private static func clock(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

/// 截图钩子的假处方。只在带 -watchPreview 启动时用到；生产路径不碰它。
@MainActor
enum WatchPreview {
    static let isActive = CommandLine.arguments.contains("-watchPreview")
    /// -watchPreview gate：预览权限门本身。
    static let previewsGate: Bool = {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: "-watchPreview"), args.indices.contains(i + 1) else { return false }
        return args[i + 1] == "gate"
    }()

    static func fromArguments(_ args: [String] = CommandLine.arguments) -> WatchLinkEnvelope? {
        guard let i = args.firstIndex(of: "-watchPreview"), args.indices.contains(i + 1) else { return nil }
        let localeCode = args.firstIndex(of: "-watchPreviewLocale").flatMap { args.indices.contains($0 + 1) ? args[$0 + 1] : nil } ?? "zh"
        let zh = localeCode == "zh"
        let today = WatchPrescriptionStore.todayISO
        let items: [WatchPrescription.Item] = [
            .init(exerciseId: "bench-press", name: zh ? "杠铃卧推" : "Barbell bench press",
                  setsText: zh ? "4 组 · 休息 2 分" : "4 sets · rest 2 min", targetText: "60 kg · ×8"),
            .init(exerciseId: "row", name: zh ? "杠铃划船" : "Barbell row",
                  setsText: zh ? "3 组 · 休息 90 秒" : "3 sets · rest 90 s", targetText: "50 kg · ×10"),
            .init(exerciseId: "pull-up", name: zh ? "引体向上" : "Pull-up",
                  setsText: zh ? "3 组" : "3 sets", targetText: zh ? "自重 · ×8" : "Bodyweight · ×8"),
            .init(exerciseId: "lateral-raise", name: zh ? "哑铃侧平举" : "Lateral raise",
                  setsText: zh ? "3 组" : "3 sets", targetText: "10 kg · ×12"),
        ]
        let ladder: [WatchPrescription.WeightRung] = stride(from: 30.0, through: 90.0, by: 2.5).map {
            .init(kg: $0, text: $0 == $0.rounded() ? String(Int($0)) : String($0))
        }
        let base = WatchPrescription.Active(
            exerciseId: "bench-press", exerciseName: zh ? "杠铃卧推" : "Barbell bench press",
            setNumber: 2, setTotal: 4, exerciseNumber: 3, exerciseTotal: 6,
            targetText: "60 kg × 8", targetWeightKg: 60, targetReps: 8, targetRir: 2,
            isResting: false, adjust: .init(weightRungs: ladder, weightCaption: "kg"))
        let active: WatchPrescription.Active?
        switch args[i + 1] {
        case "set": active = base
        case "bodyweight":
            active = .init(exerciseId: "pull-up", exerciseName: zh ? "引体向上" : "Pull-up",
                           setNumber: 1, setTotal: 3, exerciseNumber: 4, exerciseTotal: 6,
                           targetText: zh ? "自重 × 8" : "Bodyweight × 8", targetWeightKg: 0, targetReps: 8, targetRir: 2,
                           isResting: false, adjust: .init(weightRungs: [], weightCaption: ""))
        case "warmup":
            active = .init(exerciseId: "bench-press", exerciseName: zh ? "杠铃卧推" : "Barbell bench press",
                           setNumber: 1, setTotal: 3, exerciseNumber: 3, exerciseTotal: 6,
                           targetText: zh ? "空杆 ×8" : "Empty bar ×8", targetWeightKg: 20, targetReps: 8, targetRir: 0,
                           isResting: false, isWarmup: true)
        case "rest":
            active = .init(exerciseId: "bench-press", exerciseName: zh ? "杠铃卧推" : "Barbell bench press",
                           setNumber: 3, setTotal: 4, exerciseNumber: 3, exerciseTotal: 6,
                           targetText: "60 kg × 8", targetWeightKg: 60, targetReps: 8, targetRir: 2,
                           isResting: true, restEndsAt: Date().addingTimeInterval(75), restTotalSeconds: 120,
                           adjust: .init(weightRungs: ladder, weightCaption: "kg"),
                           restPreviewText: zh ? "下一组 · 第 3 组 · 60 kg × 8" : "Next · Set 3 · 60 kg × 8")
        default: active = nil
        }
        let rx = WatchPrescription(dateISO: today, dayTitle: zh ? "上肢" : "Upper", exercises: items,
                                   active: active, localeCode: localeCode,
                                   completedSetsToday: args[i + 1] == "done" ? 22 : nil)
        guard let payload = rx.encoded else { return nil }
        return WatchLinkEnvelope(kind: WatchLinkKind.prescription, sentAtISO: today, payload: payload)
    }
}
