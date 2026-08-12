import SwiftUI
import RedeL10n
import RedeTrainingDecision

// Rede watchOS — 切片 1：target 空壳 + 证明核心包真的能在表上链接运行。
//
// 范围纪律（方案 2026-08-12）：**表是训练进行时的遥控器，不是第二个 app**。
// 计划 / 进展 / 设置 / 动作库 / 引导全部留在手机。表上最终只有三屏：
// 当前动作 → 记组 → 休息倒计时。多一屏都是负担——表上滚动是最贵的交互。
//
// 真源纪律：**手机是唯一决策方**。表不复算处方——仓库里已有教训
//（TodayPrescriptionEngine.rotationBase 注释：app 层复算轮转必漂移，2026-07-08 实拍抓获）。
// 表上引擎的用途只有校验与格式化（重量吸附器械梯子、单位换算），不做决策。
//
// 这一片刻意不只放一个 Text("Rede")：那只能证明「app 能起」。
// 屏上这两个值分别来自 RedeL10n 与 RedeTrainingDecision，跑起来能读到，
// 才算证明了**核心包在真机 watchOS 上链接与执行都成立**。
@main
struct RedeWatchApp: App {
    var body: some Scene {
        WindowGroup {
            WatchSmokeView()
        }
    }
}

struct WatchSmokeView: View {
    /// 表跟随系统语言；手机的语言偏好后续由 WatchConnectivity 带过来（切片 2）。
    private var s: RedeStrings {
        RedeStrings(locale: RedeLocale.resolve(fromLanguageCode: Locale.current.language.languageCode?.identifier))
    }

    /// 引擎侧的一个真实只读值：默认日序的长度。选它是因为它不依赖任何用户数据，
    /// 空档案也能算，适合当冒烟信号。
    private var sequenceLength: Int {
        TodayPrescriptionEngine.resolvedDaySequence(splitType: "upper-lower", override: nil).count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("REDE")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.orange)
            // 来自 RedeL10n：证明文案包可用且 locale 解析正常
            Text(s.tabToday)
                .font(.system(size: 20, weight: .bold))
            // 来自 RedeTrainingDecision：证明引擎包在表上真的执行了
            Text(verbatim: "engine ok · seq \(sequenceLength)")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 8)
    }
}
