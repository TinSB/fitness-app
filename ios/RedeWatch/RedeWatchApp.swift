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

    func apply(_ envelope: WatchLinkEnvelope) {
        guard envelope.kind == WatchLinkKind.prescription,
              let data = envelope.payload,
              let rx = WatchPrescription(decoding: data)
        else { return }   // 未知 kind / 载荷看不懂：安静丢弃，保留上一份（向前兼容）
        prescription = rx
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
    func send(_ action: WatchCommand.Action, active: WatchPrescription.Active, auto: Bool = false) {
        let now = ISO8601DateFormatter().string(from: Date())
        let command = WatchCommand(action: action, exerciseId: active.exerciseId, auto: auto, sentAtISO: now)
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

/// 表盘尺寸缩放。40mm（162pt 宽）是最小表盘，v2 的三值瓦片按它定基准字号；
/// 更大的表盘按宽度等比放大（46mm = 208pt → 1.28 倍），到 1.3 封顶。
/// 按宽度算而不是按机型枚举——新机型出来不用改；也不用 Dynamic Type：训练时这几个
/// 数字就该是「屏幕允许的最大」，不随系统字号缩小。
enum WatchMetrics {
    static let scale: CGFloat = min(1.3, max(1, WKInterfaceDevice.current().screenBounds.width / 162))
    /// 瓦片大数字
    static var tileValue: CGFloat { (22 * scale).rounded() }
    /// 瓦片高度
    static var tileHeight: CGFloat { (46 * scale).rounded() }
    /// 记组屏动作名
    static var title: CGFloat { min(17, (14 * scale).rounded()) }
    /// 休息倒计时
    static var clock: CGFloat { (36 * scale).rounded() }
    /// 主按钮内高
    static var buttonHeight: CGFloat { (24 * scale).rounded() }
    /// 进度行 / 休息标题 / 「下一组」预览这类辅助小字
    static var meta: CGFloat { min(13, (11 * scale).rounded()) }
    /// 瓦片下的说明小字
    static var caption: CGFloat { min(12, (10 * scale).rounded()) }
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

    var body: some View {
        Group {
            if let active = store.prescription?.active {
                // 训练进行时：这一屏只做一件事——记当前这一组。
                //
                // **故意不套 ScrollView**，两个理由：
                // · 数码表冠在 ScrollView 里会被滚动吃掉，调不了数值（真机实测）
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
            // 截图钩子：-watchPreview list|set|warmup|rest|bodyweight [-watchPreviewLocale en]
            // 不配对也能在各尺寸模拟器上看四种状态。**不激活通道**，免得配对机的真处方把预览冲掉。
            if let preview = WatchPreview.fromArguments() {
                store.apply(preview)
                return
            }
            // onReceive 必须在 activate 之前挂：激活完成后系统会立刻投递
            // 已存的 applicationContext，晚挂就会漏掉第一份。
            WatchLink.shared.onReceive = { [store] envelope, _ in store.apply(envelope) }
            link.activate()
        }
        // 切片 6：手机说在练 → 拉起 HKWorkoutSession（否则放下手腕几秒 app 就被挂起，
        // 倒计时死在半路）；手机说练完 → 收掉并写回健康。
        // 用 onChange 而不是在 body 里调：sync 虽然幂等，但每帧调一次是噪音。
        .onChange(of: store.prescription?.active != nil, initial: true) { _, active in
            guard !WatchPreview.isActive else { return }   // 截图钩子不拉起 HKWorkoutSession（会弹健康授权）
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
                        notice(verbatim: s.watchStalePlan(dateISO: rx.dateISO))
                    }
                    if rx.exercises.isEmpty {
                        notice(verbatim: s.watchRestDay)
                    } else {
                        ForEach(rx.exercises, id: \.exerciseId) { item in
                            exerciseRow(item)
                        }
                    }
                } else {
                    notice(verbatim: link.isReachable ? s.watchFetchingPlan : s.watchOpenPhone)
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
                .font(.system(size: 20, weight: .bold))
        }
    }

    private func exerciseRow(_ item: WatchPrescription.Item) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: item.name)
                .font(.system(size: 15, weight: .semibold))
                .lineLimit(2)
            // 目标是这一屏唯一要在两米外看清的东西——练的时候手表离眼睛就那么远。
            Text(verbatim: item.targetText)
                .font(.system(size: 17, weight: .bold, design: .rounded))
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

/// 记组屏（切片 4 → v2 重做）。表上唯一会改动落盘数据的界面。
///
/// v2 布局：三块**值瓦片**（重量 / 次数 / RIR）+ 一颗完成按钮，一屏放下、不滚动。
/// · 不操作时三块瓦片就是抬腕要看的东西——目标重量、次数、RIR 大字并排，两米外读得清。
/// · 要改：**点一块瓦片、转表冠**。这是 watchOS 自己的计时器 / 闹钟设置界面的手法
///   （点时、分字段再转表冠），用户不用学。选中的瓦片描橙边；改过的值变橙色——
///   练的时候一眼要能看出「这不是处方给的数」。次数默认选中：它是最常偏离目标的量。
/// · 重量在**手机推来的真实梯子**上选（器械 × 单位的格子，含目标那一格），表不算数。
/// · 自重 / 弹力带没有重量轴（梯子为空）→ 只有次数与 RIR 两块瓦片，与手机快改面同口径。
///
/// 布局纪律（2026-08-15 owner 真机反馈后确立，v2 沿用）：
/// · **一屏放下，不滚动**。小号表上一滚，「完成」就只剩半截——而它是这块屏上唯一重要的操作。
/// · 训练时不显示 REDE / 训练日名。那两行在手机上已经有了，练的时候每一像素都该给动作本身。
///
/// 表冠必须显式拿到焦点，否则会被外层滚动吃掉（真机实测：转表冠在滑页面）。
struct ActiveSetView: View {
    let active: WatchPrescription.Active
    let store: WatchPrescriptionStore

    /// 表冠此刻在调哪一块瓦片。
    enum Field: Hashable { case weight, reps, rir }
    @FocusState private var focus: Field?
    /// 焦点的**真值**。系统会自作主张重置焦点到第一块可聚焦视图（配对模拟器实测：
    /// 拉起 HKWorkoutSession 后焦点从次数跳回重量），所以「用户想调哪块」由这里持有，
    /// 系统动过就抢回来（见 onChange(of: focus)）。默认次数：它是最常偏离目标的量。
    @State private var chosenField: Field = .reps

    /// 三个表冠绑定值。用 Double 是因为 digitalCrownRotation 要连续量；显示时取整。
    /// weightIdx 是梯子下标；rirIdx 0 = 「—」不记，1…6 = RIR 0…5（与手机 RIR 直选带同序）。
    @State private var weightIdx: Double = 0
    @State private var repsDial: Double = 0
    @State private var rirIdx: Double = 3
    /// 本地乐观态：点完立刻变，不等手机把新一组推回来。
    @State private var justLogged = false
    /// 排队中的组数 + 可达性。手机够不着时「已记录」是半个真话——组确实记下了，但还没过去。
    @ObservedObject private var link = WatchLink.shared

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
                .foregroundStyle(.secondary)
        }
    }

    var body: some View {
        // 休息中整屏换成倒计时。**不是把按钮置灰了事**——休息是训练里最长的一段，
        // 也是最该抬腕就看到的东西；这一刻屏幕上该有的只有「还剩多久」。
        if active.isResting {
            RestCountdownView(active: active, store: store)
        } else if active.isWarmup {
            warmupBody
        } else {
            setBody
        }
    }

    // MARK: - 正式组：三值瓦片

    private var setBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: s.watchProgress(exercise: active.exerciseNumber, exerciseTotal: active.exerciseTotal,
                                           set: active.setNumber, setTotal: active.setTotal))
                .font(.system(size: WatchMetrics.meta))
                .foregroundStyle(.secondary)
            Text(verbatim: active.exerciseName)
                .font(.system(size: WatchMetrics.title, weight: .semibold))
                .lineLimit(1).minimumScaleFactor(0.7)
                .padding(.top, 1)

            // 瓦片行。重量占一半、次数与 RIR 各四分之一：重量是这一屏的主数字
            //（与手机 hero 同口径），三位数带小数的「137.5 lb」也放得下。
            HStack(spacing: 5) {
                if hasWeightAxis {
                    tile(.weight, value: rungs[weightIndex].text,
                         caption: active.adjust?.weightCaption ?? "", changed: weightChanged)
                }
                HStack(spacing: 5) {
                    tile(.reps, value: "\(reps)", caption: s.trainColReps, changed: repsChanged)
                    tile(.rir, value: rir.map(String.init) ?? s.adjustRirSkip, caption: s.trainColRir, changed: rirChanged)
                }
            }
            .padding(.top, 7 * WatchMetrics.scale)
            .allowsHitTesting(!justLogged)
            .opacity(justLogged ? 0.6 : 1)

            Spacer(minLength: 3)
            pendingHint

            Button {
                store.logSet(active: active, weightKg: chosenWeightKg, reps: reps, rir: rir.map(Double.init))
                justLogged = true
                WKInterfaceDevice.current().play(.success)
            } label: {
                Text(verbatim: buttonTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: WatchMetrics.buttonHeight)
            }
            .buttonStyle(.borderedProminent)
            .tint(.orange)
            .disabled(justLogged)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // 手机推来新一步 → 复位三个值、按钮与焦点。键里带 exerciseId 与 isWarmup：
        // 换动作时 setNumber 会回到 1，热身转正式组时也会——只看 setNumber 会漏。
        .onChange(of: "\(active.exerciseId)#\(active.isWarmup)#\(active.setNumber)", initial: true) {
            weightIdx = Double(targetRungIndex)
            repsDial = Double(active.targetReps)
            rirIdx = Double(min(max(targetRir, 0), 5) + 1)
            justLogged = false
            chosenField = .reps
            focus = .reps
        }
        // 焦点被系统动过（重置到第一块 / 收走）→ 抢回用户选的那块。
        // 这一屏上除了用户点瓦片没有别的合法焦点来源，所以凡是与真值不符的都是系统干的。
        .onChange(of: focus) { _, now in
            if now != chosenField { focus = chosenField }
        }
    }

    /// 一块值瓦片：大数字 + 小字说明。点它 = 表冠转它。
    private func tile(_ field: Field, value: String, caption: String, changed: Bool) -> some View {
        let focused = focus == field
        return VStack(spacing: 0) {
            Text(verbatim: value)
                .font(.system(size: WatchMetrics.tileValue, weight: .bold, design: .rounded))
                .monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.6)
                .foregroundStyle(changed ? Color.orange : Color.primary)
                .contentTransition(.numericText())
                .animation(.easeOut(duration: 0.12), value: value)
            Text(verbatim: caption)
                .font(.system(size: WatchMetrics.caption, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, minHeight: WatchMetrics.tileHeight)
        .padding(.horizontal, 3)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.white.opacity(focused ? 0.13 : 0.07)))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Color.orange.opacity(focused ? 1 : 0), lineWidth: 1.5))
        .contentShape(Rectangle())
        .onTapGesture {
            guard chosenField != field else { return }
            chosenField = field
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
                .foregroundStyle(.orange)
            Text(verbatim: active.exerciseName)
                .font(.system(size: WatchMetrics.title, weight: .semibold))
                .lineLimit(1).minimumScaleFactor(0.7)
                .padding(.top, 1)
            // 热身时这里是「空杆 ×8」，绝不会是工作重量。热身不记次数、不落库，所以没有瓦片。
            Text(verbatim: active.targetText)
                .font(.system(size: WatchMetrics.tileValue, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.orange)
                .lineLimit(1).minimumScaleFactor(0.6)
                .padding(.top, 8)

            Spacer(minLength: 3)
            pendingHint

            // 跳过热身走 message：手机不可达时不给按——按了没反应比按不了更糟。
            // 文字按钮而不是第二颗胶囊：热身屏只有一个主动作（完成），跳过是让路的次选，
            // 与手机热身态「完成 = 主按钮 / 跳过 = 一行小字」同一主次。
            Button {
                store.send(.skipWarmup, active: active)
                WKInterfaceDevice.current().play(.click)
            } label: {
                Text(verbatim: s.warmupSkip)
                    .font(.system(size: WatchMetrics.meta + 2))
                    .foregroundStyle(link.isReachable ? Color.secondary : Color.secondary.opacity(0.4))
                    .frame(maxWidth: .infinity, minHeight: 30)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!link.isReachable)

            Button {
                // 热身步：三个量原样回传（手机只看 exerciseId + 步序号 + isWarmup，不落库）。
                store.logSet(active: active, weightKg: active.targetWeightKg, reps: active.targetReps, rir: active.targetRir)
                justLogged = true
                WKInterfaceDevice.current().play(.click)
            } label: {
                Text(verbatim: buttonTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: WatchMetrics.buttonHeight)
            }
            .buttonStyle(.borderedProminent)
            .tint(.orange)
            .disabled(justLogged)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .onChange(of: "\(active.exerciseId)#\(active.isWarmup)#\(active.setNumber)", initial: true) {
            justLogged = false
        }
    }
}

/// 把「哪块瓦片被选中」翻译成对应的表冠绑定。三块瓦片的范围各不相同：
/// 重量 = 梯子下标；次数 1…50；RIR 0…6（0 是「—」）。
/// 拆成 modifier 是因为 digitalCrownRotation 的绑定必须在编译期定下，
/// 三块瓦片各挂各的，只有拿到焦点的那块会收到表冠事件。
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

/// 休息倒计时（切片 5 → v2 加 +30 / 下一组）。
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

    private var s: RedeStrings { store.strings }

    private var countdown: RestCountdown {
        RestCountdown(endDate: active.restEndsAt,
                      pausedRemaining: active.restPausedRemaining,
                      totalSeconds: active.restTotalSeconds)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(verbatim: active.restPausedRemaining != nil ? s.watchRestPaused : s.restLabel)
                .font(.system(size: WatchMetrics.meta))
                .foregroundStyle(.secondary)

            // TimelineView 而不是自己跑 Timer：系统按需重绘，表被抬起时才刷，省电。
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let remaining = countdown.remaining(now: context.date)
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: Self.clock(remaining))
                        .font(.system(size: WatchMetrics.clock, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(remaining == 0 ? Color.green : Color.primary)
                        .lineLimit(1).minimumScaleFactor(0.6)
                    ProgressView(value: countdown.fraction(now: context.date))
                        .tint(remaining == 0 ? .green : .orange)
                }
            }

            Spacer(minLength: 2)

            // 休息时最想知道的第二件事：等下要做什么。省得倒计时结束还要再翻一屏。
            Text(verbatim: s.watchNextUp(active.targetText))
                .font(.system(size: WatchMetrics.meta + 1))
                .foregroundStyle(.secondary)
                .lineLimit(1).minimumScaleFactor(0.7)
            if link.pendingTransfers > 0 {
                Text(verbatim: s.watchPendingSets(link.pendingTransfers))
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            } else if !link.isReachable {
                Text(verbatim: s.watchPhoneUnreachable)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }

            // 两颗按钮走 message，只在手机够得着时能按。+30 是次级（bordered），
            // 下一组是主动作（prominent）——与手机休息屏的主次一致。
            HStack(spacing: 5) {
                Button {
                    store.send(.restAdd30, active: active)
                    WKInterfaceDevice.current().play(.click)
                } label: {
                    Text(verbatim: s.restAdd30)
                        .font(.system(size: 14, weight: .semibold))
                        .monospacedDigit()
                        .frame(maxWidth: .infinity, minHeight: WatchMetrics.buttonHeight)
                }
                .buttonStyle(.bordered)
                .tint(.orange)
                Button {
                    store.send(.restSkip, active: active)
                    WKInterfaceDevice.current().play(.click)
                } label: {
                    Text(verbatim: s.restNextSet)
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: WatchMetrics.buttonHeight)
                }
                .buttonStyle(.borderedProminent)
                .tint(.orange)
            }
            .disabled(!link.isReachable)
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
                           adjust: .init(weightRungs: ladder, weightCaption: "kg"))
        default: active = nil
        }
        let rx = WatchPrescription(dateISO: today, dayTitle: zh ? "上肢" : "Upper", exercises: items,
                                   active: active, localeCode: localeCode)
        guard let payload = rx.encoded else { return nil }
        return WatchLinkEnvelope(kind: WatchLinkKind.prescription, sentAtISO: today, payload: payload)
    }
}
