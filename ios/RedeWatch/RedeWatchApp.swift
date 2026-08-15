import SwiftUI
import RedeL10n
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
            loggedAtISO: ISO8601DateFormatter().string(from: Date()))
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
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                header
                if let active = store.prescription?.active {
                    // 训练进行时：这一屏只做一件事——记当前这一组。
                    // 动作清单此时**故意不显示**：练的时候没人要在手表上翻列表，
                    // 多一屏内容只会让唯一重要的那个按钮更难按到。
                    ActiveSetView(active: active, store: store)
                } else if let rx = store.prescription {
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
        .task {
            // onReceive 必须在 activate 之前挂：激活完成后系统会立刻投递
            // 已存的 applicationContext，晚挂就会漏掉第一份。
            WatchLink.shared.onReceive = { [store] envelope, _ in store.apply(envelope) }
            link.activate()
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

/// 记组屏（切片 4）。表上唯一会改动落盘数据的界面，所以刻意只有一个动作：完成这一组。
///
/// 次数是这里唯一可调的量，用数码表冠调——重量是练之前照处方配上器械的，
/// 次数才是练出来的结果。表冠是 watchOS 上调数字最省事的方式，不占屏幕。
struct ActiveSetView: View {
    let active: WatchPrescription.Active
    let store: WatchPrescriptionStore

    /// 表冠绑定值。用 Double 是因为 digitalCrownRotation 要连续量；显示时取整。
    @State private var repsDial: Double = 0
    /// 本地乐观态：点完立刻变，不等手机把新一组推回来。
    /// 手机推回来时 active.setNumber 会变，onChange 把它复位。
    @State private var justLogged = false

    private var reps: Int { max(1, Int(repsDial.rounded())) }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(verbatim: "\(active.exerciseNumber)/\(active.exerciseTotal) · 第 \(active.setNumber)/\(active.setTotal) 组")
                .font(.system(size: 11)).foregroundStyle(.secondary)
            Text(verbatim: active.exerciseName)
                .font(.system(size: 17, weight: .bold)).lineLimit(2)
            Text(verbatim: active.targetText)
                .font(.system(size: 15, weight: .semibold))
                .monospacedDigit().foregroundStyle(.orange)

            if active.isResting {
                // 休息中不给按钮：那一组还没开始做，此刻「完成」没有意义。
                Text(verbatim: "休息中")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 40)
            } else {
                repsDialView
                Button {
                    store.logSet(active: active, reps: reps)
                    justLogged = true
                } label: {
                    Text(verbatim: justLogged ? "已记录" : "完成这一组")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                }
                .tint(.orange)
                .disabled(justLogged)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // 手机推来新一组 → 复位表冠与按钮。用 setNumber+exerciseId 作键，
        // 因为换动作时 setNumber 会回到 1，只看它会漏掉换动作那一次。
        .onChange(of: "\(active.exerciseId)#\(active.setNumber)", initial: true) {
            repsDial = Double(active.targetReps)
            justLogged = false
        }
    }

    private var repsDialView: some View {
        HStack {
            Text(verbatim: "次数")
                .font(.system(size: 12)).foregroundStyle(.secondary)
            Spacer()
            Text(verbatim: "\(reps)")
                .font(.system(size: 26, weight: .bold))
                .monospacedDigit()
                // 改过就变色——练的时候一眼要能看出「这不是处方给的数」。
                .foregroundStyle(reps == active.targetReps ? Color.primary : Color.orange)
        }
        .focusable()
        .digitalCrownRotation($repsDial, from: 1, through: 50, by: 1,
                              sensitivity: .low, isContinuous: false)
    }
}
