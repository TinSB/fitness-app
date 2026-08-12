import SwiftUI
import RedeL10n
import RedeTrainingDecision
import RedeWatchLink

// Rede watchOS。
//
// 切片 1：target 空壳 + 证明核心包真的能在表上链接运行。
// 切片 2：WatchConnectivity 双向通道 + ping/pong 实跑。
//
// 范围纪律（方案 2026-08-12）：**表是训练进行时的遥控器，不是第二个 app**。
// 计划 / 进展 / 设置 / 动作库 / 引导全部留在手机。表上最终只有三屏：
// 当前动作 → 记组 → 休息倒计时。多一屏都是负担——表上滚动是最贵的交互。
//
// 真源纪律：**手机是唯一决策方**。表不复算处方——仓库里已有教训
//（TodayPrescriptionEngine.rotationBase 注释：app 层复算轮转必漂移，2026-07-08 实拍抓获）。
// 表上引擎的用途只有校验与格式化（重量吸附器械梯子、单位换算），不做决策。
@main
struct RedeWatchApp: App {
    var body: some Scene {
        WindowGroup {
            WatchSmokeView()
        }
    }
}

struct WatchSmokeView: View {
    @StateObject private var link = WatchLink.shared

    /// 表跟随系统语言；手机的语言偏好后续由处方消息带过来（切片 3）。
    private var s: RedeStrings {
        RedeStrings(locale: RedeLocale.resolve(fromLanguageCode: Locale.current.language.languageCode?.identifier))
    }

    /// 引擎侧的一个真实只读值：默认日序的长度。选它是因为它不依赖任何用户数据，
    /// 空档案也能算，适合当冒烟信号。
    private var sequenceLength: Int {
        TodayPrescriptionEngine.resolvedDaySequence(splitType: "upper-lower", override: nil).count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("REDE")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.orange)
                // 这两行来自 RedeL10n 与 RedeTrainingDecision：证明核心包在表上真的执行了
                HStack(spacing: 6) {
                    Text(s.tabToday).font(.system(size: 17, weight: .bold))
                    Text(verbatim: "seq \(sequenceLength)")
                        .font(.system(size: 11)).foregroundStyle(.secondary).monospacedDigit()
                }

                Divider()

                // 切片 2：ping 走 message 通道——它正是「可丢的实时态」，
                // 手机不可达时跳过即可，不需要排队。记组绝不能用这个通道。
                Button {
                    link.send(WatchLinkEnvelope(kind: WatchLinkKind.ping,
                                                sentAtISO: ISO8601DateFormatter().string(from: Date()),
                                                body: ["from": "watch"]),
                              via: .message)
                } label: {
                    Text(verbatim: "Ping 手机")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(maxWidth: .infinity)
                }
                .tint(.orange)

                Text(verbatim: link.isReachable ? "手机可达" : "手机不可达")
                    .font(.system(size: 11))
                    .foregroundStyle(link.isReachable ? .green : .secondary)

                // 日志是切片 2 的可见性手段（调试脚手架，切片 4 之后收敛）
                ForEach(Array(link.log.suffix(8).enumerated()), id: \.offset) { _, line in
                    Text(verbatim: line)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            .padding(.horizontal, 6)
        }
        .task { link.activate() }
    }
}
