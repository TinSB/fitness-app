import Foundation
import HealthKit
import WatchKit

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

    /// **全 app 唯一一个会话守护**（v3.8）。
    ///
    /// 原来它是 TodayWatchView 的 @StateObject——视图在，它才在。那在手机用
    /// startWatchApp 把表 app 从后台拉起的场景下不成立：那一刻界面还没渲染，
    /// 没有任何视图去持有它。会话的拥有权因此必须提到 app 级别，由
    /// WatchAppDelegate（本文件末）和视图共用同一个实例。
    static let shared = WorkoutSessionKeeper()

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
    /// - phoneSentAt: 这份处方在手机上发出的时刻（v3.8）。只在「被手机拉起、还没确认」期间用来
    ///   分辨新旧，见下方注释；其余时候不看。
    func sync(trainingActive: Bool, discardOnEnd: Bool = false, phoneSentAt: Date? = nil) {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        if let launchedAt = phoneLaunchAt {
            // 被手机拉起之后、手机确认之前（v3.8）：
            // · 「在练」一律收下——它只会让会话继续跑，收错了也没有代价。
            // · 「不在练」只收**比拉起那一刻更新**的。系统替我们存着的最后一份
            //   applicationContext，在开新一场之前永远是**上一场**结束时那份，冷启动时它一定先到。
            //   照它收会话，会把手机刚请求开的这一场当场掐掉，还会往健康里写一条几秒钟的训练。
            //   比拉起更新的「不在练」，才是这一场真的结束了（含：表 app 直到练完才被看到的情况——
            //   那时 applicationContext 只剩最后那份「练完了」，必须认它，否则整场被止损丢弃）。
            // 两台配对设备的时钟差在秒级以内；判错的唯一情形是「拉起后几秒内就放弃」，
            // 结局是走 60 分钟止损并丢弃——不写任何东西进健康，可接受。
            guard trainingActive || (phoneSentAt.map { $0 > launchedAt } ?? false) else { return }
            phoneLaunchAt = nil
            cancelLaunchStopLoss()
        }
        desiredActive = trainingActive
        if !trainingActive { desiredDiscard = discardOnEnd }
        reconcile()
    }

    /// 手机用 `HKHealthStore.startWatchApp` 把表 app 拉起来时走这里（v3.8）。
    ///
    /// 与 sync 的区别：此刻**这一场的处方可能一份都还没到**，表上也可能还没有任何视图——
    /// 期望态只能由「手机刚刚亲口说要开练」这件事本身建立。这一场的处方随后会到，
    /// 到了就由 sync 确认并接管（见 sync 里的新旧判断），这条路就退场。
    ///
    /// 没授权时什么都不做：后台被拉起的 app 没有界面，系统不会替它弹授权框，
    /// 硬起只会得到一个失败的会话。用户下次自己打开表 app 时会看到权限门。
    func phoneRequestedWorkout() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        // 已经在按手机的话开练（表 app 本来就开着、处方比拉起先到）：这次拉起是多余的，
        // 不再加任何状态——尤其不能重设 phoneLaunchAt，否则这一场的「练完了」会被误判成旧的。
        guard !desiredActive else { return }
        guard workoutWriteAuthorized == true else {
            lastError = "手机请求开练，但表上还没给「健身记录」写入权限"
            return
        }
        phoneLaunchAt = Date()
        desiredActive = true
        desiredDiscard = false
        armLaunchStopLoss()
        reconcile()
    }

    /// 被手机拉起的时刻（表的时钟）；手机用一份「在练」或一份比它新的「不在练」确认后清空。
    /// nil = 不在「等手机确认」状态，sync 按原样工作。
    private var phoneLaunchAt: Date?

    /// 期望态 → 实际态的串行调和。**全 app 只有这一条 start 路径**：
    /// sync 与 phoneRequestedWorkout 都只改期望态再调它，各自不起会话——
    /// 两条 start 路径抢 `reconciling` 会让会话起起停停，整场剩下的时间手腕一放下就被挂起
    /// （审查 M1 修过的正是这个）。
    private func reconcile() {
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

    // MARK: - 被手机拉起之后的止损

    /// 「被手机拉起却一直等不到手机」的止损（v3.8）。
    ///
    /// 真实事故形态：手机点开始训练 → 系统拉起表 app 并起会话 → 手机 app 随即被用户划掉
    /// 或崩了，处方一次都没送到。没有这条，表上这一场会无上限地跑，最后把一段几小时的
    /// 幽灵训练写进健康——审查 M3 修过同一类事故（那次的触发条件是手机中途断联）。
    /// 口径与那条刻意一致：复用 `WatchPrescriptionStore.staleLimit`（60 分钟），单一真源。
    private var launchStopLoss: Task<Void, Never>?

    private func armLaunchStopLoss() {
        launchStopLoss?.cancel()
        launchStopLoss = Task { [weak self] in
            try? await Task.sleep(for: .seconds(WatchPrescriptionStore.staleLimit))
            guard !Task.isCancelled, let self else { return }
            guard self.phoneLaunchAt != nil else { return }   // 期间手机已确认，归 sync 管
            self.phoneLaunchAt = nil
            self.desiredActive = false
            self.desiredDiscard = true   // 不确定到底有没有真练 → 一个字都不写健康
            self.lastError = "手机一直没发来处方，这一场已收掉且未写入健康"
            self.reconcile()
        }
    }

    private func cancelLaunchStopLoss() {
        launchStopLoss?.cancel()
        launchStopLoss = nil
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

// MARK: - 手机拉起（v3.8）

/// watchOS 侧接住 iPhone 的 `HKHealthStore.startWatchApp`。
///
/// 为什么住在本文件而不是 RedeWatchApp.swift：`handle(_:)` 的参数类型是
/// `HKWorkoutConfiguration`，谁声明它谁就得 import HealthKit——而 Master §5 Apple Watch
/// 规则 10 把表侧的 HealthKit 限定在「唯一的会话拥有者文件」里。放在这里，
/// RedeWatchApp.swift 只需要认识 `WatchAppDelegate` 这个名字，一行 HealthKit 都不用碰。
final class WatchAppDelegate: NSObject, WKApplicationDelegate, ObservableObject {
    /// 手机那边点了「开始训练」，系统把我们拉起来了（多半在后台，界面还没渲染）。
    ///
    /// **不信任传进来的 configuration**：开发者论坛 662634（iOS 14 / watchOS 7 起，至今无
    /// Apple 回复）报告过这里收到的是默认配置而不是手机发的那份。所以只取「手机要开练」
    /// 这一个事实，运动类型由 WorkoutSessionKeeper.start() 固定写死（室内传统力量训练）。
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        Task { @MainActor in WorkoutSessionKeeper.shared.phoneRequestedWorkout() }
    }
}
