import Foundation
import HealthKit
import os
import WatchKit
import RedeWatchLink

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
//
// 怎么收（Master v3.10，owner 2026-10-20）：**练过就写进健康，没练才丢**——手机说练完了写；说放弃丢；
// 没等到手机说（60 分钟没消息 / 拉起后没确认 / 系统把会话停了）记过组就写、结束在最后一组，一组没有才丢。
// 规则在 RedeWatchLink.WatchWorkoutEnding（纯函数、有单测），这里只照它执行。
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
    /// 收的时候手机怎么说这一场的结局（决定写不写、结束在哪）。
    private var desiredOutcome: WatchWorkoutEnding.Outcome = .completed
    private var reconciling = false
    /// 这一场最后一组的时刻（手机报来的与表上记的取晚的那个，由 sync 带进来）。没等到手机时据此决定写不写、写到哪。
    private var lastSetAt: Date?
    /// 系统把会话停了（多半是开了别的体能训练）：这一场剩下的时间不再自己拉起，免得跟那个 app 抢（v3.10）。
    /// 手机说这一场结束了、或手机为新的一场来拉起时清掉。
    private var yieldedThisTraining = false
    /// 系统通知过「训练中崩溃了，那一场还留着」（v3.10）：下一次起会话先把它接回来，不另起一场。
    private var recoverPending = false
    /// 收尾的结局与失败原因写进系统日志：写健康失败时表上不弹任何东西，真机上只有这里查得到原因。
    private let log = Logger(subsystem: "com.tinsab.rede", category: "WatchWorkout")

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
    /// - outcome: 收的时候按什么结局收（手机说练完了 / 放弃了 / 没等到手机说，见 WatchWorkoutEnding）。
    /// - lastSetAt: 这一场最后一组的时刻（v3.10）。
    /// - phoneSentAt: 这份处方在手机上发出的时刻（v3.8）。只在「被手机拉起、还没确认」期间用来
    ///   分辨新旧，见下方注释；其余时候不看。
    func sync(trainingActive: Bool, outcome: WatchWorkoutEnding.Outcome, lastSetAt: Date?, phoneSentAt: Date? = nil) {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        // 先记最后一组：拉起后还没确认时下面会提前返回，止损到点要用它。
        self.lastSetAt = lastSetAt
        if let launchedAt = phoneLaunchAt {
            // 被手机拉起之后、手机确认之前（v3.8）：
            // · 「在练」一律收下——它只会让会话继续跑，收错了也没有代价。
            // · 「不在练」只收**比拉起那一刻更新**的。系统替我们存着的最后一份
            //   applicationContext，在开新一场之前永远是**上一场**结束时那份，冷启动时它一定先到。
            //   照它收会话，会把手机刚请求开的这一场当场掐掉，还会往健康里写一条几秒钟的训练。
            //   比拉起更新的「不在练」，才是这一场真的结束了（含：表 app 直到练完才被看到的情况——
            //   那时 applicationContext 只剩最后那份「练完了」，必须认它，否则整场被止损丢弃）。
            // 两台配对设备的时钟差在秒级以内。会判错的情形是「拉起后几秒内就放弃」，或者拉起请求
            // 晚到、放弃先被处理：那一场没人确认，走 60 分钟止损；表上一组都没记，照规则 10 丢弃、不写健康。
            // 例外：如果这 60 分钟里用户又开了一场真训练，新处方会去确认这个还在跑的会话，
            // 健康里那一条的开始时间就被提前到误触的那一刻。要触发它，得在几秒内完成放弃，
            // 而放弃要先开菜单再确认，几秒内很难做完，所以不为它重写调和循环
            // （独立审查 2026-10-17 定级 MINOR，见系统逻辑 §7.2 边界情况）。
            guard trainingActive || (phoneSentAt.map { $0 > launchedAt } ?? false) else { return }
            phoneLaunchAt = nil
            cancelLaunchStopLoss()
        }
        desiredActive = trainingActive
        if !trainingActive {
            desiredOutcome = outcome
            yieldedThisTraining = false   // 这一场结束了：下一场照常拉起
        }
        reconcile()
    }

    /// 手机用 `HKHealthStore.startWatchApp` 把表 app 拉起来时走这里（v3.8）；训练中崩溃后被系统重新拉起
    /// 也走这里（v3.10，见 recoverAfterCrash）。
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
        // 例外：上一场被系统停掉、让出来了（v3.10）。那一场的「练完了」表上可能没收到（applicationContext
        // 只留最新一份，被这一场的「在练」盖掉），期望态还停在「在练」；手机拉起只会发生在新的一场开始时，
        // 这时照常接手，不然新的一场整场没有会话（审查 2026-10-20）。
        guard !desiredActive || yieldedThisTraining else { return }
        guard workoutWriteAuthorized == true else {
            lastError = "手机请求开练，但表上还没给「健身记录」写入权限"
            return
        }
        phoneLaunchAt = Date()
        desiredActive = true
        desiredOutcome = .completed
        yieldedThisTraining = false   // 手机为新的一场来拉起
        armLaunchStopLoss()
        reconcile()
    }

    /// 训练中崩溃后被系统重新拉起（v3.10）：当作一次「手机拉起」——下一次起会话先把系统留着的那一场接回来
    /// （start），再等手机下一份处方确认；60 分钟没确认按规则 10 收（记过组写到最后一组，没练才丢）。
    /// 崩溃重启时「系统叫我们接回」和「手机说在练」谁先到说不准，两条都走同一条串行起会话的路，只会接回同一场。
    func recoverAfterCrash() {
        recoverPending = true
        phoneRequestedWorkout()
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
                // 系统停过这一场的会话（v3.10）：已经让出来了，这一场不再自己拉起。
                if desiredActive, yieldedThisTraining { break }
                if desiredActive { await start() } else { await end(outcome: desiredOutcome) }
                // start 失败（权限 / 系统拒绝）isRunning 仍 false 而期望 true：不能死循环，跳出。
                if desiredActive, !isRunning { break }
            }
            reconciling = false
        }
    }

    // MARK: - 被手机拉起之后的止损

    /// 「被手机拉起却一直等不到手机」的止损（v3.8；v3.10 起按规则 10 收：记过组写到最后一组，没练才丢）。
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
            self.desiredOutcome = .unknown   // 没等到手机说结局：记过组写到最后一组，没练才丢
            self.lastError = "手机一直没确认这一场，表上已自己收尾"
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

        // 训练中崩溃后的这次启动，系统还替我们留着那一场（v3.10）：接回来接着记，不另起一场。
        // 只在系统通知过时才去接：这个查询在健康库状态不对时会一直不返回（模拟器实测 2026-10-20），
        // 平时每次开练都问一句，就可能把开练整个卡住。
        if recoverPending {
            recoverPending = false
            do {
                if let recovered = try await store.recoverActiveWorkoutSession() {
                    adopt(recovered)
                    return
                }
            } catch {
                lastError = "接回训练会话失败：\(error.localizedDescription)"
                log.error("recover failed: \(error.localizedDescription, privacy: .public)")
            }
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
            // 起到一半被系统停掉了（多半是别的体能训练正在跑，systemStopped 已经收尾）：不把放手了的会话标成在跑。
            guard self.session === session else { return }
            isRunning = true
            startedAt = now
            lastError = nil
        } catch {
            lastError = "训练会话启动失败：\(error.localizedDescription)"
            // startActivity 之后才失败的：系统那边的会话已经开了，收掉，不留一个没人管的（审查 2026-10-20）。
            self.session?.end()
            session = nil
            builder = nil
        }
    }

    /// 接上系统替我们留着的那一场（崩溃后）：换上新的数据源与代理，按它自己的开始时刻接着记（v3.10）。
    private func adopt(_ recovered: HKWorkoutSession) {
        let builder = recovered.associatedWorkoutBuilder()
        // 数据源随崩溃的进程一起没了才补一个；还在的不换，免得重复采样。
        if builder.dataSource == nil {
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store,
                                                         workoutConfiguration: recovered.workoutConfiguration)
        }
        recovered.delegate = self
        builder.delegate = self
        session = recovered
        self.builder = builder
        let began = builder.startDate ?? recovered.startDate ?? Date()
        startedAt = began
        isRunning = true
        lastError = nil
        // 正等手机确认（崩溃重启走的是「手机拉起」那条路）：拉起时刻改用这一场自己的开始——
        // 这一场开始之后手机发的「不在练」都算数，不能因为表 app 中途重启过就当成旧的。
        if phoneLaunchAt != nil { phoneLaunchAt = began }
        // 已经收到的处方按这个时刻重判一次：崩溃到重启之间手机可能已经练完，那份「练完了」
        // 在接回之前到的时候没有会话可收，不重判就要白等 60 分钟（审查 2026-10-20）。
        WatchPrescriptionStore.shared.followWorkout()
    }

    private func end(outcome: WatchWorkoutEnding.Outcome) async {
        guard let session, let builder else { isRunning = false; return }
        session.end()
        await close(session, builder,
                    ending: WatchWorkoutEnding.decide(outcome, lastSetAt: lastSetAt, sessionStart: startedAt))
    }

    /// 收掉这一场：写进健康（结束在给定时刻或此刻）或丢弃，然后清空这一场的状态。
    private func close(_ session: HKWorkoutSession, _ builder: HKLiveWorkoutBuilder,
                       ending: WatchWorkoutEnding) async {
        // 收尾要等健康库。这期间系统报来的「这一场已结束」（我们自己 end() 引起的，或一次停止同时报了
        // 「出错」和「已结束」两声）看到 builder 已经放手，就不再收第二次。
        // 会话本身要留到写完：它一释放，健康那边收不到这一场最后的数据，写入一直挂在「保存中」
        // （模拟器实测，2026-10-20）。
        self.builder = nil
        log.info("closing session: \(String(describing: ending), privacy: .public)")
        do {
            switch ending {
            case .save(let endAt):
                // 结束在最后一组（没等到手机时）或此刻。finishWorkout 才是真正写回健康的那一步；失败只记一行——
                // 训练数据的真源在手机的 canonical 存储里，健康只是**额外**的一份。
                try await builder.endCollection(at: endAt ?? Date())
                _ = try await builder.finishWorkout()
            case .discard:
                // 放弃的训练 / 一组都没练：不写健康。写了才是数据污染。
                try await builder.endCollection(at: Date())
                builder.discardWorkout()
            }
        } catch {
            lastError = "训练会话收尾失败：\(error.localizedDescription)"
            log.error("close failed: \(error.localizedDescription, privacy: .public)")
        }
        // 收尾期间手机已经开了新的一场（系统停的那条路不在调和循环里）：新的那场不动。
        guard self.session === session else { return }
        self.session = nil
        isRunning = false
        // 这一场结束，读数就不再属于任何一场。留着会在下一场开始前显示上一场的心率。
        heartRateBpm = nil
        startedAt = nil
    }

    /// 系统把会话停了、不是我们要停的（v3.10）：多半是开了别的体能训练（另一个 app 起了会话），或会话出错。
    /// 这一场记过组就把已经采到的写进健康、结束在停的那一刻；没练就丢。之后这一场不再自己拉起——
    /// 以前 builder 一直没收、采到的全丢，手机下一次推送又重起一场，跟那个 app 抢来抢去。
    /// stopped：报来停止的那个会话；只认当前这一场的——我们自己收尾引起的「已结束」、刚收完一场马上开了
    /// 新的一场时旧那场迟到的「已结束」，都不能把当前这一场收掉（收尾一开始 builder 就放手了，见 close）。
    private func systemStopped(_ stopped: HKWorkoutSession, at date: Date) async {
        guard let session, session === stopped, let builder else { return }
        yieldedThisTraining = true
        // 报的是「出错」或「已停止」时会话未必已经结束：补一刀，不留一个没人管的会话在后台跑。已结束的再 end 无事。
        session.end()
        await close(session, builder, ending: WatchWorkoutEnding.decide(.unknown, lastSetAt: lastSetAt,
                                                                         sessionStart: startedAt, stoppedAt: date))
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
        // 系统可能在我们不知情时把 session 结束掉（如用户在别处开了另一场训练）：
        // 已经采到的照规则 10 写进健康（记过组的话），这一场不再抢回来（v3.10）。
        // 我们自己收尾时也会走到这里：那时 builder 已放手，systemStopped 不做事。
        Task { @MainActor in
            if toState == .ended || toState == .stopped {
                await self.systemStopped(workoutSession, at: date)
            }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor in
            self.lastError = "训练会话中断：\(message)"
            await self.systemStopped(workoutSession, at: Date())
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

    /// App 一启动就连上手机、开始跟随它的训练状态（v3.10）——不等界面出现。被手机从后台拉起时界面多半
    /// 还没渲染；以前连接挂在视图上，表一直收不到手机的消息，60 分钟后把整场丢了。截图钩子下不连。
    func applicationDidFinishLaunching() {
        guard !WatchPreview.isActive else { return }
        Task { @MainActor in WatchPrescriptionStore.shared.startFollowingPhone() }
    }

    /// 训练中崩溃后被系统重新拉起（v3.10）：把系统留着的那一场接回来，见 WorkoutSessionKeeper.recoverAfterCrash。
    func handleActiveWorkoutRecovery() {
        Task { @MainActor in WorkoutSessionKeeper.shared.recoverAfterCrash() }
    }
}
