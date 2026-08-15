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
//
// 范围纪律（方案 2026-08-12）：**表是训练进行时的遥控器，不是第二个 app**。
// 计划 / 进展 / 设置 / 动作库 / 引导全部留在手机。表上最终只有三屏：
// 当前动作 → 记组 → 休息倒计时。多一屏都是负担——表上滚动是最贵的交互。
//
// 真源纪律：**手机是唯一决策方**。表不复算处方——仓库里已有教训
//（TodayPrescriptionEngine.rotationBase 注释：app 层复算轮转必漂移，2026-07-08 实拍抓获）。
// 切片 3 把这条推到底：连显示串都在手机侧渲染好再传，表上零业务逻辑。
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

    func apply(_ envelope: WatchLinkEnvelope) {
        guard envelope.kind == WatchLinkKind.prescription,
              let data = envelope.payload,
              let rx = WatchPrescription(decoding: data)
        else { return }   // 未知 kind / 载荷看不懂：安静丢弃，保留上一份（向前兼容）
        prescription = rx
    }

    /// 记一组回传手机（切片 4）。**走 userInfo**：排队 + 保证送达，
    /// 不要求手机此刻可达——练到一半手机锁屏是常态，用 sendMessage 会静默丢数据。
    func logSet(active: WatchPrescription.Active, reps: Int) {
        let set = WatchLoggedSet(
            exerciseId: active.exerciseId,
            setNumber: active.setNumber,
            // 重量与 RIR 原样回传手机给的值。表不重算——器械梯子吸附在手机侧做过了。
            weightKg: active.targetWeightKg,
            reps: reps,
            rir: active.targetRir,
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

    /// 表跟随系统语言。**动作名与目标串不用它**——那些是手机渲染好传过来的，
    /// 已经是手机上的语言。这里只管表自己那几个词（等待态、休息日）。
    private var s: RedeStrings {
        RedeStrings(locale: RedeLocale.resolve(fromLanguageCode: Locale.current.language.languageCode?.identifier))
    }

    private var isStale: Bool {
        guard let rx = store.prescription else { return false }
        return rx.dateISO != WatchPrescriptionStore.todayISO
    }

    var body: some View {
        Group {
            if let active = store.prescription?.active {
                // 训练进行时：这一屏只做一件事——记当前这一组。
                //
                // **故意不套 ScrollView**，两个理由：
                // · 数码表冠在 ScrollView 里会被滚动吃掉，调不了次数（真机实测）
                // · 「完成」按钮必须永远整颗可见。小号表上一滚动它就只剩半截，
                //   而这是这块屏上唯一重要的操作（owner 真机反馈）
                // 所以这一屏必须在最小表盘上一屏放下——放不下就是设计要减，不是加滚动。
                ActiveSetView(active: active, store: store)
                    .padding(.horizontal, 6)
            } else {
                idleList
            }
        }
        .task {
            // onReceive 必须在 activate 之前挂：激活完成后系统会立刻投递
            // 已存的 applicationContext，晚挂就会漏掉第一份。
            WatchLink.shared.onReceive = { [store] envelope, _ in store.apply(envelope) }
            link.activate()
        }
        // 切片 6：手机说在练 → 拉起 HKWorkoutSession（否则放下手腕几秒 app 就被挂起，
        // 倒计时死在半路）；手机说练完 → 收掉并写回健康。
        // 用 onChange 而不是在 body 里调：sync 虽然幂等，但每帧调一次是噪音。
        .onChange(of: store.prescription?.active != nil, initial: true) { _, active in
            workout.sync(trainingActive: active)
        }
    }

    private var idleList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                header
                if let rx = store.prescription {
                    if isStale {
                        // 过期不隐藏内容——健身房里「看得见但标明是旧的」比空白有用得多。
                        notice(verbatim: "\(rx.dateISO) 的计划")
                    }
                    if rx.exercises.isEmpty {
                        notice(verbatim: "今天休息")
                    } else {
                        ForEach(rx.exercises, id: \.exerciseId) { item in
                            exerciseRow(item)
                        }
                    }
                } else {
                    notice(verbatim: link.isReachable ? "正在取计划" : "在手机上打开 Rede")
                    // 空态诊断行。**只在没拿到计划时出现**，拿到就消失，不占正常使用的屏幕。
                    //
                    // 存在的理由：真机卡在空态时，模拟器复现不出来（2026-08-15 实测：
                    // 净室冷启动在模拟器上必过，真机必挂）。没有这一行，两端都只能猜。
                    // 三个值各自指向完全不同的原因：
                    //   激活 NO      → 表侧 WCSession 就没起来
                    //   手机端 NO    → 手机上装的那个 Rede 不含表支持（版本不对）
                    //   激活/手机端 YES 但没计划 → 手机侧确实没推出来
                    Text(verbatim: "激活 \(link.isActivated ? "YES" : "NO") · 手机端 \(link.hasCounterpart ? "YES" : "NO") · 可达 \(link.isReachable ? "YES" : "NO")")
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundStyle(.secondary)
                    ForEach(Array(link.log.suffix(6).enumerated()), id: \.offset) { _, line in
                        Text(verbatim: line)
                            .font(.system(size: 9, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
            }
            .padding(.horizontal, 6)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("REDE")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.orange)
            Text(verbatim: store.prescription?.dayTitle.isEmpty == false
                 ? store.prescription!.dayTitle
                 : s.tabToday)
                .font(.system(size: store.prescription?.active == nil ? 20 : 13,
                              weight: store.prescription?.active == nil ? .bold : .medium))
                .foregroundStyle(store.prescription?.active == nil ? .primary : .secondary)
        }
    }

    private func exerciseRow(_ item: WatchPrescription.Item) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: item.name)
                .font(.system(size: 15, weight: .semibold))
                .lineLimit(2)
            // 目标是这一屏唯一要在两米外看清的东西——练的时候手表离眼睛就那么远。
            Text(verbatim: item.targetText)
                .font(.system(size: 17, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(.orange)
            Text(verbatim: item.setsText)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 7)
        .padding(.horizontal, 9)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
    }

    private func notice(verbatim text: String) -> some View {
        Text(verbatim: text)
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
    }
}

/// 记组屏（切片 4）。表上唯一会改动落盘数据的界面，所以刻意只有一个动作：完成这一步。
///
/// 布局纪律（2026-08-15 owner 真机反馈后重做）：
/// · **一屏放下，不滚动**。小号表上一滚，「完成」就只剩半截——而它是这块屏上
///   唯一重要的操作。用 Spacer 把按钮钉在底边，永远整颗可见。
/// · 训练时不显示 REDE / 训练日名。那两行在手机上已经有了，练的时候每一像素
///   都该给动作本身。
///
/// 次数用数码表冠调——重量是练之前照处方配上器械的，次数才是练出来的结果。
/// 表冠必须显式拿到焦点，否则会被外层滚动吃掉（真机实测：转表冠在滑页面）。
struct ActiveSetView: View {
    let active: WatchPrescription.Active
    let store: WatchPrescriptionStore

    /// 表冠绑定值。用 Double 是因为 digitalCrownRotation 要连续量；显示时取整。
    @State private var repsDial: Double = 0
    /// 本地乐观态：点完立刻变，不等手机把新一组推回来。
    @State private var justLogged = false
    /// 表冠焦点。**必须显式置位**——不置的话表冠去驱动滚动，次数一动不动。
    @FocusState private var crownFocused: Bool
    /// 排队中的组数。手机够不着时「已记录」是半个真话——组确实记下了，但还没过去。
    @ObservedObject private var link = WatchLink.shared

    private var reps: Int { max(1, Int(repsDial.rounded())) }
    private var adjusted: Bool { reps != active.targetReps }

    /// 进度行。热身与正式组口径不同：热身数的是热身步，不是工作组。
    private var progressLine: String {
        active.isWarmup
            ? "热身 \(active.setNumber)/\(active.setTotal)"
            : "\(active.exerciseNumber)/\(active.exerciseTotal) · 第 \(active.setNumber)/\(active.setTotal) 组"
    }

    private var buttonTitle: String {
        if justLogged { return "已记录" }
        return active.isWarmup ? "完成热身组" : "完成这一组"
    }

    /// 只在真有东西排队时出现。**不能只说「已记录」**——手机够不着时那是半个真话，
    /// 组确实记下了，但还没过去。说清楚「排队中」，用户才知道不用重按、也没丢。
    @ViewBuilder private var pendingHint: some View {
        if link.pendingTransfers > 0 {
            Text(verbatim: "\(link.pendingTransfers) 组待同步")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
        }
    }

    var body: some View {
        // 休息中整屏换成倒计时。**不是把按钮置灰了事**——休息是训练里最长的一段，
        // 也是最该抬腕就看到的东西；这一刻屏幕上该有的只有「还剩多久」。
        if active.isResting {
            RestCountdownView(active: active)
        } else {
            setBody
        }
    }

    private var setBody: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(verbatim: progressLine)
                .font(.system(size: 11))
                .foregroundStyle(active.isWarmup ? Color.orange : Color.secondary)
            Text(verbatim: active.exerciseName)
                .font(.system(size: 15, weight: .semibold))
                .lineLimit(1).minimumScaleFactor(0.7)
            // 目标是两米外要看清的东西。热身时这里是「空杆 ×8」，绝不会是工作重量。
            Text(verbatim: active.targetText)
                .font(.system(size: 19, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(.orange)
                .lineLimit(1).minimumScaleFactor(0.6)

            // 热身不记次数（热身根本不落库），所以不给表冠——少一行，按钮更靠上。
            if !active.isWarmup { repsDial_view }

            Spacer(minLength: 2)
            pendingHint

            Button {
                store.logSet(active: active, reps: reps)
                justLogged = true
            } label: {
                Text(verbatim: buttonTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 30)
            }
            .tint(.orange)
            .disabled(justLogged)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        // 手机推来新一步 → 复位表冠与按钮。键里带 exerciseId 与 isWarmup：
        // 换动作时 setNumber 会回到 1，热身转正式组时也会——只看 setNumber 会漏。
        .onChange(of: "\(active.exerciseId)#\(active.isWarmup)#\(active.setNumber)", initial: true) {
            repsDial = Double(active.targetReps)
            justLogged = false
            crownFocused = true
        }
    }

    private var repsDial_view: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(verbatim: "次数")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            Spacer()
            Text(verbatim: "\(reps)")
                .font(.system(size: 28, weight: .bold))
                .monospacedDigit()
                // 改过就变色——练的时候一眼要能看出「这不是处方给的数」。
                .foregroundStyle(adjusted ? Color.orange : Color.primary)
        }
        .contentShape(Rectangle())
        .focusable(true)
        .focused($crownFocused)
        .digitalCrownRotation($repsDial, from: 1, through: 50, by: 1,
                              sensitivity: .low, isContinuous: false,
                              isHapticFeedbackEnabled: true)
    }
}

/// 休息倒计时（切片 5）。
///
/// **数字算自手机给的绝对结束时刻，不是手机每秒发过来的剩余秒数。**
/// 后者的话，消息延迟多久倒计时就差多久，还得每秒收一条消息；
/// 前者只需要一份状态，之后表自己按墙钟走——延迟、丢包、app 被挂起后重开都不影响。
/// remaining/fraction 直接用引擎里的 RestCountdown，两端同一份实现，不会漂。
///
/// 归零那一下必须**震**：健身房里没人盯着表看完 90 秒。
/// 这也是切片 6 的 HKWorkoutSession 存在的理由——没有它，手腕放下后 app 被挂起，
/// 这一震就不会发生。
struct RestCountdownView: View {
    let active: WatchPrescription.Active

    private var countdown: RestCountdown {
        RestCountdown(endDate: active.restEndsAt,
                      pausedRemaining: active.restPausedRemaining,
                      totalSeconds: active.restTotalSeconds)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(verbatim: active.restPausedRemaining != nil ? "休息（已暂停）" : "休息")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)

            // TimelineView 而不是自己跑 Timer：系统按需重绘，表被抬起时才刷，省电。
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let remaining = countdown.remaining(now: context.date)
                VStack(alignment: .leading, spacing: 5) {
                    Text(verbatim: Self.clock(remaining))
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(remaining == 0 ? Color.green : Color.primary)
                        .lineLimit(1).minimumScaleFactor(0.6)
                    ProgressView(value: countdown.fraction(now: context.date))
                        .tint(remaining == 0 ? .green : .orange)
                }
            }

            Spacer(minLength: 2)

            // 休息时最想知道的第二件事：等下要做什么。省得倒计时结束还要再翻一屏。
            Text(verbatim: "下一组 \(active.targetText)")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineLimit(1).minimumScaleFactor(0.7)
            if WatchLink.shared.pendingTransfers > 0 {
                Text(verbatim: "\(WatchLink.shared.pendingTransfers) 组待同步")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        // 精确在结束时刻震一下，不轮询。
        // task(id:) 绑 endDate：手机上「+30 秒」会换一个结束时刻 → 任务重启，重新定时。
        .task(id: active.restEndsAt) {
            guard let end = active.restEndsAt else { return }
            let delay = end.timeIntervalSinceNow
            guard delay > 0 else { return }   // 已经结束了就别补震——那只会莫名其妙
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            WKInterfaceDevice.current().play(.notification)
        }
    }

    /// mm:ss。超过 1 小时不特殊处理——组间休息不会有那么长，真出现了显示 99:59 也无妨。
    private static func clock(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}
