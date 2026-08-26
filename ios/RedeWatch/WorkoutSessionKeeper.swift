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

    /// 最近一次心率（bpm）。nil = 还没读到（刚开始、模拟器、或用户没给读权限）。
    ///
    /// 数据一直都在采——`HKLiveWorkoutDataSource` 默认就收心率与能量，这一片从切片 6 起就在跑。
    /// 之前只是**一个数都没往外露**，于是用户仍然去开苹果的体能训练 app。这两个值就是把
    /// 已经在手腕上产生的东西显示出来，不新增任何采集、不新增权限（读权限早就在要）。
    @Published private(set) var heartRateBpm: Int?
    /// 这一场的开始时刻。已练时长由表自己按墙钟算——与休息倒计时同一纪律（传时刻不传秒数）：
    /// 不必每秒发布一次，`TimelineView` 自己刷新，app 被挂起再回来也是准的。
    @Published private(set) var startedAt: Date?

    /// 「健身记录」写入权限（v3.2，owner 拍板：**整个表 app 都以它为前提**）。
    /// nil = 系统还没问过；false = 用户拒绝过（系统不会再弹框，只能去设置里开）；true = 已允许。
    /// 只看 share 状态：HealthKit 对写入类型如实报告，读类型出于隐私永远报 notDetermined。
    /// 没有健康数据的设备（不会有，表上恒有）视为已允许——不能因为一个查不到的状态把表变砖。
    @Published private(set) var workoutWriteAuthorized: Bool? = nil

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    /// 期望态调和（审查 M1 的第二半）：start/end 都是 async，手机在一两秒内「结束 → 继续」时，
    /// 旧写法会在 end() 还没跑完（isRunning 仍 true）时把 sync(true) 当成「已在跑」吞掉，
    /// end() 一落地 isRunning=false、此后无人再拉起——整场剩下的训练手腕一放下就被挂起。
    /// 现在 sync 只记「想要的状态」，一个串行任务把实际状态追平到期望态为止。
    private var desiredActive = false
    private var desiredDiscard = false
    private var reconciling = false

    override init() {
        super.init()
        // 启动即知道权限状态：不然已授权用户每次冷启动都会先闪一帧权限门再 morph 走（审查 m1）。
        refreshAuthorization()
        // 截图钩子：模拟器没有心率传感器，不给固定值这两行在预览里永远是空的、验不了版式。
        // 生产路径不可达（-watchPreview 才为真）。
        if WatchPreview.isActive {
            heartRateBpm = 132
            startedAt = Date().addingTimeInterval(-24 * 60 - 10)
        }
    }

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
    /// - discardOnEnd: 结束时丢弃而不是写进健康——放弃的训练、以及手机停止推送后表侧
    ///   自己止损收掉的那段（审查 M3：那不是一场训练，不该出现在健康里）。
    func sync(trainingActive: Bool, discardOnEnd: Bool = false) {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        desiredActive = trainingActive
        if !trainingActive { desiredDiscard = discardOnEnd }
        guard !reconciling else { return }   // 正在追平，追平循环末尾会再看一眼期望态
        reconciling = true
        Task {
            while desiredActive != isRunning {
                if desiredActive { await start() } else { await end(discard: desiredDiscard) }
                // start 失败（权限 / 系统拒绝）isRunning 仍 false 而期望 true：不能死循环，跳出。
                if desiredActive, !isRunning { break }
            }
            reconciling = false
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
            builder.delegate = self   // 心率靠它推过来；不挂就永远读不到（数据照采、只是没人取）
            self.session = session
            self.builder = builder

            let now = Date()
            session.startActivity(with: now)
            try await builder.beginCollection(at: now)
            isRunning = true
            startedAt = now
            lastError = nil
        } catch {
            lastError = "训练会话启动失败：\(error.localizedDescription)"
            session = nil
            builder = nil
        }
    }

    private func end(discard: Bool) async {
        guard let session, let builder else { isRunning = false; return }
        let now = Date()
        session.end()
        do {
            try await builder.endCollection(at: now)
            if discard {
                // 放弃的训练 / 手机断联后的止损：不写健康。写了才是数据污染（一条 8 小时的假训练）。
                builder.discardWorkout()
            } else {
                // finishWorkout 才是真正写回健康的那一步。失败只记一行——
                // 训练数据的真源在手机的 canonical 存储里，健康只是**额外**的一份。
                _ = try await builder.finishWorkout()
            }
        } catch {
            lastError = "训练会话收尾失败：\(error.localizedDescription)"
        }
        self.session = nil
        self.builder = nil
        isRunning = false
        // 这一场结束，读数就不再属于任何一场。留着会在下一场开始前显示上一场的心率。
        heartRateBpm = nil
        startedAt = nil
    }
}

// MARK: - 实时读数

extension WorkoutSessionKeeper: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                                    didCollectDataOf collectedTypes: Set<HKSampleType>) {
        guard collectedTypes.contains(HKQuantityType(.heartRate)) else { return }
        // statistics 取最近一条而不是平均：屏上要回答的是「我现在多少」，不是「这一场平均多少」。
        // 平均值留给手机小结（那边从健康把整场读回来算）。
        let bpm = workoutBuilder.statistics(for: HKQuantityType(.heartRate))?
            .mostRecentQuantity()?
            .doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
        Task { @MainActor in
            guard let bpm, bpm > 0 else { return }
            self.heartRateBpm = Int(bpm.rounded())
        }
    }

    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
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
