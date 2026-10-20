import Foundation

// 表上「点完成即休息」（Master v3.9 §5 第 6 条修订，owner 2026-10-19 拍板）。
//
// 为什么要有它：表把组交给手机走的是排队通道，手机锁屏后 app 被挂起，组要等手机醒来才送到——
// 而休息倒计时一直是手机推回来的，于是表上点了完成，倒计时要等用户掏出手机才开始（owner 真机反馈）。
//
// 边界（与「表永远不自己推进」并存）：
// · 时长是手机给的（Active.restAfterSetSeconds，含本场调整），表不猜、不解析清单文案；
// · 只是**显示**一段倒计时——下一组练什么、什么时候进下一组，仍由手机决定后推回来；
// · 不落任何存储，只活在内存里；手机推来接手的那一份就把它换掉。
public struct ProvisionalRest: Equatable, Sendable {
    /// 刚记完的那一组（手机还在等它时的 exerciseId + setNumber）。
    public let exerciseId: String
    public let setNumber: Int
    public let endsAt: Date
    public let totalSeconds: Int
    public let preview: WatchPrescription.RestPreview?

    public init(exerciseId: String, setNumber: Int, endsAt: Date, totalSeconds: Int,
                preview: WatchPrescription.RestPreview?) {
        self.exerciseId = exerciseId
        self.setNumber = setNumber
        self.endsAt = endsAt
        self.totalSeconds = totalSeconds
        self.preview = preview
    }

    /// 记完一组的那一刻：这一组之后手机会休息，才起一段。
    /// 热身步、正在休息、全场最后一组（手机给 nil）、旧手机（不带这一位）都不起——照旧等手机。
    public static func begin(after active: WatchPrescription.Active, loggedAt: Date) -> ProvisionalRest? {
        guard !active.isWarmup, !active.isResting,
              let seconds = active.restAfterSetSeconds, seconds > 0 else { return nil }
        return ProvisionalRest(exerciseId: active.exerciseId, setNumber: active.setNumber,
                               endsAt: loggedAt.addingTimeInterval(TimeInterval(seconds)),
                               totalSeconds: seconds, preview: active.restAfterSetPreview)
    }

    /// 手机推来一份新处方后，这段预休息还留不留。
    ///
    /// 只有手机**还在等同一组**（同动作、同组号、正式组、没在休息）时留——那说明手机还没收到这一组
    ///（还在口袋里睡着），这份推送是别的原因发的。其余情况都说明手机已经接手：开始了休息、
    /// 换了组、换了动作、进了小结（active 为 nil），一律交还给手机那份。
    public func survives(_ incoming: WatchPrescription.Active?) -> Bool {
        guard let incoming else { return false }
        return incoming.exerciseId == exerciseId && incoming.setNumber == setNumber
            && !incoming.isWarmup && !incoming.isResting
    }

    /// 休息屏要的那份 Active：在手机「还在等这一组」的处方上叠出休息态。
    /// 命令（+30 / 暂停 / 下一组）照旧带这一组的 exerciseId 发给手机，由手机按自己的状态判。
    public func overlay(on active: WatchPrescription.Active) -> WatchPrescription.Active {
        WatchPrescription.Active(
            exerciseId: active.exerciseId, exerciseName: active.exerciseName,
            setNumber: active.setNumber, setTotal: active.setTotal,
            exerciseNumber: active.exerciseNumber, exerciseTotal: active.exerciseTotal,
            targetText: active.targetText, targetWeightKg: active.targetWeightKg,
            targetReps: active.targetReps, targetRir: active.targetRir,
            isResting: true, isWarmup: false,
            restEndsAt: endsAt, restTotalSeconds: totalSeconds, restPausedRemaining: nil,
            adjust: active.adjust,
            restPreviewText: preview?.spoken, restPreview: preview,
            restAfterSetSeconds: nil, restAfterSetPreview: nil)
    }
}
