// 手机请求「把配对手表上的 companion app 拉起来并开练」的纯 seam（Foundation-only、host 可单测）。
// HealthKit 适配器在 HKWatchWorkoutLauncher.swift（#if os(iOS)、host 排除）实现本协议；
// app 只见此协议——HealthKit 类型不出本包（Master §9 / §5 Apple Watch rule 10）。
//
// 为什么需要这一片（v3.8，owner 2026-10-17 提出）：
// 表侧 WorkoutSessionKeeper 从切片 6 起就会跟着手机的 trainingInProgress 自动开/关
// HKWorkoutSession——但那是**表 app 已经在跑**的前提下。手机推给表的只有
// WatchConnectivity 的 applicationContext，而 Apple 文档对三条通道都只承诺
// 「对端醒来时能读到」，从不承诺能启动未运行的表 app（sendMessage 的文档更是明写
// 「Calling this method from your iOS app does not wake up the corresponding WatchKit
// extension」）。结果就是 owner 实际遇到的那件事：手机点了开始训练，手腕上什么都没发生，
// 他只好去开苹果自带的体能训练 app。
//
// Apple 对这件事只有一条官方路径：iOS 端 HKHealthStore.startWatchApp(toHandle:)
//（摘要原文 "Launches or wakes the companion watchOS app to create a new workout session"），
// 表端在 WKApplicationDelegate.handle(_:) 里自己建会话。这就是本片做的事。
//
// 边界（v3.8 修订的内容）：本包在 iPhone 上仍然**不写任何** HealthKit 数据，也不新读任何类型——
// startWatchApp 只是「请系统去叫醒表 app」。那一场训练仍然只由表侧写进 Apple 健康
//（§5 Apple Watch rule 10），手机这边连那条 HKWorkout 都不读。

import Foundation

/// 拉起手表 companion app 开练的结果。**只用于日志与诊断，不进 UI**——
/// 这条路失败时的正确行为是安静退回原状（用户仍可自己打开表 app），
/// 而不是在他刚点下「开始训练」的那一刻弹一个关于手表的框。
public enum WatchWorkoutLaunchResult: Equatable, Sendable {
    /// 已向系统发出拉起请求（不等于表上已经开始采集——那由表侧的会话决定）。
    case requested
    /// 这台设备上做不到：没有健康数据（iPad / 模拟器部分形态）。
    /// 「没有配对手表」不在这里判——那由调用方在推送层判（见 §5 rule 3 的同一道 guard）。
    case unavailable
    /// 系统拒绝了。常见真实原因：表上还没装 Rede（HealthKit 错误 550）、
    /// 表上已经有另一场训练在跑（Apple Watch 同一时刻只允许一场）。
    case failed(String)
}

/// 手表训练拉起 seam。HealthKit 适配器实现；app 持此协议、不直接碰 HealthKit。
public protocol WatchWorkoutLaunching: Sendable {
    /// 请求把配对手表上的 companion app 拉起来，并让它开一场**室内传统力量训练**。
    ///
    /// 幂等由表侧保证：表上的会话守护本身是幂等的（重复请求同一状态不做事），
    /// 所以这里不需要记「是不是已经拉起过」——那种状态一定会和真实情况对不上。
    func launchStrengthWorkout() async -> WatchWorkoutLaunchResult
}
