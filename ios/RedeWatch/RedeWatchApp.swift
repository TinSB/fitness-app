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
