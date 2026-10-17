// HKWatchWorkoutLauncher — v3.8 平台适配器：手机请求拉起手表 app 开练。
//
// #if os(iOS) 包裹 → host `swift test` 自动排除（同 HKBodyWeightReader 范式）。
// 本文件是本包第二个 import HealthKit 的文件，但**不读不写任何健康数据**：
// 只调 startWatchApp，把「去叫醒表 app 开练」这件事交给系统。

#if os(iOS)
import Foundation
import HealthKit

public struct HKWatchWorkoutLauncher: WatchWorkoutLaunching {
    public init() {}

    public func launchStrengthWorkout() async -> WatchWorkoutLaunchResult {
        guard HKHealthStore.isHealthDataAvailable() else { return .unavailable }

        // 配置与表侧 WorkoutSessionKeeper.start() 里那份**逐字一致**（室内传统力量训练）。
        // 两处都写一遍是故意的：论坛 662634（iOS 14/watchOS 7 起，无 Apple 回复）报告过
        // 表侧 handle(_:) 收到的 configuration 是默认值而不是这一份。所以表侧不信任
        // 传来的配置、自己固定类型；这一份只用来告诉系统「这是一场训练，不是随便拉起 app」。
        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining
        config.locationType = .indoor

        do {
            try await HKHealthStore().startWatchApp(toHandle: config)
            return .requested
        } catch {
            return .failed(error.localizedDescription)
        }
    }
}
#endif
