import Foundation
import HealthKit

// HKWorkoutSession 守护（切片 6，2026-08-15）。
//
// **这一片不是「顺便接入健康」，它是表 app 能不能用的前提。**
// watchOS 上没有运行中的 workout session，手腕一放下 app 几秒内就被挂起：
// 休息倒计时死在半路、抬腕看到的是上一次的画面、记组按钮按下去没反应。
// 有了它，抬腕即回到 Rede，倒计时是准的，整场训练里 app 一直活着。
//
// 顺带的好处才是写回健康——活动圆环计入这一场。那是用户真正会在意的东西，
// 也让这次权限询问有个说得通的理由。
//
// 真源纪律照旧：**开始与结束由手机的训练状态驱动**，表上没有「开始训练」按钮。
// 表只是看见手机说「在练」就把 session 拉起来，看见「不在练」就收掉。
@MainActor
final class WorkoutSessionKeeper: NSObject, ObservableObject {

    /// 只在真机上有意义：模拟器没有心率也没有圆环，但 session 生命周期是能跑的。
    @Published private(set) var isRunning = false
    /// 出错就记一行，不弹窗。表上练到一半弹权限失败的框，比没有 session 还糟。
    @Published private(set) var lastError: String?

    /// 「健身记录」写入权限（v3.2，owner 拍板：**整个表 app 都以它为前提**）。
    /// nil = 系统还没问过；false = 用户拒绝过（系统不会再弹框，只能去设置里开）；true = 已允许。
    /// 只看 share 状态：HealthKit 对写入类型如实报告，读类型出于隐私永远报 notDetermined。
    /// 没有健康数据的设备（不会有，表上恒有）视为已允许——不能因为一个查不到的状态把表变砖。
    @Published private(set) var workoutWriteAuthorized: Bool? = nil

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    /// 重读权限状态：启动时、回到前台时（用户可能刚去设置里开了）、请求授权之后。
    func refreshAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { workoutWriteAuthorized = true; return }
        switch store.authorizationStatus(for: HKObjectType.workoutType()) {
        case .sharingAuthorized: workoutWriteAuthorized = true
        case .sharingDenied: workoutWriteAuthorized = false
        case .notDetermined: workoutWriteAuthorized = nil
        @unknown default: workoutWriteAuthorized = nil
        }
    }

    /// 弹系统授权框（只在还没问过时会真的弹；拒绝过的直接返回，状态照旧 false）。
    /// 由权限门屏的「允许」按钮触发——用户已经读过一句为什么，这个询问才有上下文。
    func requestAuthorization() async {
        let read: Set<HKObjectType> = [HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned)]
        do {
            try await store.requestAuthorization(toShare: [HKObjectType.workoutType()], read: read)
        } catch {
            lastError = "健康授权失败：\(error.localizedDescription)"
        }
        refreshAuthorization()
    }

    /// 跟随手机的训练状态。**幂等**：重复调同一状态不做任何事——
    /// 处方每次推送都会调到这里（手机每记一组就推一次），不能每次都重启 session。
    func sync(trainingActive: Bool) {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        if trainingActive, !isRunning {
            Task { await start() }
        } else if !trainingActive, isRunning {
            Task { await end() }
        }
    }

    // MARK: - 生命周期

    private func start() async {
        // 授权在这里要、不在启动时要：此刻用户刚在手机上点了「开始训练」，
        // 这个询问才有上下文。启动即问是最惹人烦的那种问法。
        let workoutType = HKObjectType.workoutType()
        let read: Set<HKObjectType> = [
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned)
        ]
        do {
            try await store.requestAuthorization(toShare: [workoutType], read: read)
        } catch {
            // 用户拒绝也照样往下走：session 起不来最多是后台会被挂起，
            // 但记组、看处方这些仍然可用。**不能因为权限就把表 app 变砖**。
            lastError = "健康授权失败：\(error.localizedDescription)"
        }

        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining
        config.locationType = .indoor

        do {
            let session = try HKWorkoutSession(healthStore: store, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)
            session.delegate = self
            self.session = session
            self.builder = builder

            let now = Date()
            session.startActivity(with: now)
            try await builder.beginCollection(at: now)
            isRunning = true
            lastError = nil
        } catch {
            lastError = "训练会话启动失败：\(error.localizedDescription)"
            session = nil
            builder = nil
        }
    }

    private func end() async {
        guard let session, let builder else { isRunning = false; return }
        let now = Date()
        session.end()
        do {
            try await builder.endCollection(at: now)
            // finishWorkout 才是真正写回健康的那一步。失败只记一行——
            // 训练数据的真源在手机的 canonical 存储里，健康只是**额外**的一份。
            _ = try await builder.finishWorkout()
        } catch {
            lastError = "训练会话收尾失败：\(error.localizedDescription)"
        }
        self.session = nil
        self.builder = nil
        isRunning = false
    }
}

extension WorkoutSessionKeeper: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState,
                                    date: Date) {
        // 系统可能在我们不知情时把 session 结束掉（如用户在别处开了另一场训练）。
        // 不同步这个状态，isRunning 就会说谎，下一次 sync 也不会重新拉起。
        Task { @MainActor in
            if toState == .ended || toState == .stopped {
                self.isRunning = false
            }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in
            self.lastError = "训练会话中断：\(error.localizedDescription)"
            self.isRunning = false
        }
    }
}
