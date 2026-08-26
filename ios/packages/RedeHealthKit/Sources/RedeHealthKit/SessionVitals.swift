// 单场生命体征的纯类型 + 协议 seam（Foundation-only、host 可单测）。
// HealthKit 适配器在 HKSessionVitalsReader.swift（#if os(iOS)、host 排除）实现本协议；
// app 只见此协议——HealthKit 类型不出本包（Master §220），与 BodyWeightReading 同一范式。
//
// **数据流方向只有一个：健康 → 展示。** 这些值绝不写 canonical、不进训练历史、
// 不参与任何处方或进阶决策（那属于 C 档，owner 已明确留案）。
import Foundation

/// 心率曲线上的一个点。存**距开始的秒数**而不是绝对时刻：曲线的横轴本来就是相对的，
/// 而且这样这个类型不依赖时区，host 上直接可测。
public struct HeartRatePoint: Equatable, Sendable {
    public let secondsFromStart: Int
    public let bpm: Int

    public init(secondsFromStart: Int, bpm: Int) {
        self.secondsFromStart = secondsFromStart
        self.bpm = bpm
    }
}

/// 一场训练在「健康」里留下的那条记录的读值。
public struct SessionVitals: Equatable, Sendable {
    /// 以健康里那条体能训练为准，不是 finishedAt - startedAt：
    /// 表上的会话可能比手机的 flow 早结束或晚结束几秒，显示哪个都行但必须只显示一个真源。
    public let durationSeconds: Int
    /// 全部为可选：用户可能只给了「体能训练」权限没给心率，或那台表当时没读到。
    /// 拿不到就不显示那一项——不显示比显示 0 或「--」都好。
    public let averageHeartRate: Int?
    public let peakHeartRate: Int?
    public let activeEnergyKcal: Int?
    /// 升序、去重后的心率曲线。空数组 = 没有逐点数据（仍可能有均值/峰值）。
    public let heartRateSeries: [HeartRatePoint]

    public init(durationSeconds: Int, averageHeartRate: Int? = nil, peakHeartRate: Int? = nil,
                activeEnergyKcal: Int? = nil, heartRateSeries: [HeartRatePoint] = []) {
        self.durationSeconds = durationSeconds
        self.averageHeartRate = averageHeartRate
        self.peakHeartRate = peakHeartRate
        self.activeEnergyKcal = activeEnergyKcal
        self.heartRateSeries = heartRateSeries
    }

    /// 除了时长以外还有没有东西可显示。只有时长时不值得单起一块——
    /// 时长在小结里本来就有，重复显示只是噪音。
    public var hasHeartRateOrEnergy: Bool {
        averageHeartRate != nil || peakHeartRate != nil || activeEnergyKcal != nil
    }
}

/// 单场生命体征读取 seam。HealthKit 适配器实现；app 持此协议、不直接碰 HealthKit。
public protocol SessionVitalsReading: Sendable {
    /// 请求**只读**授权（体能训练 / 心率 / 活动能量）。toShare 恒为空：手机侧永不写健康。
    /// 与体重那条同理——HealthKit 隐私设计不告诉我们用户到底给没给读权限，
    /// 能不能读到只由 `vitals` 返不返回数据体现。
    func requestReadAuthorization() async -> Bool

    /// 读这一段时间窗里那场力量训练。没有匹配的场次 / 无授权 / 设备不支持 → nil。
    func vitals(start: Date, end: Date) async -> SessionVitals?
}
