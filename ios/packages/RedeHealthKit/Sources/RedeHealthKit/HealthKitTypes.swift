// FR-PR8 只读体重导入的纯类型 + 协议 seam（Foundation-only、host 可单测）。
// HealthKit 适配器在 HKBodyWeightReader.swift（#if os(iOS)、host 排除）实现本协议；
// app 只见此协议——HealthKit 类型不出本包（Master §220）。
import Foundation

/// 一条体重样本（只读展示派生）。绝不写 canonical、绝不进训练历史、不影响处方（Master §211/220）。
public struct BodyWeightSample: Equatable, Sendable {
    public let kg: Double
    public let dateISO: String   // yyyy-MM-dd（日粒度展示，不暴露精确时刻）
    public init(kg: Double, dateISO: String) {
        self.kg = kg
        self.dateISO = dateISO
    }
}

/// 体重读取 seam。HealthKit 适配器实现；app 持此协议、不直接碰 HealthKit。
public protocol BodyWeightReading: Sendable {
    /// 请求**只读**体重授权（值先行：用户主动「连接 Apple 健康」时才调，不在启动时）。
    /// 返回是否成功发起授权（注：HealthKit 隐私设计——发起后无法查询用户是否真授予了读权限，
    /// 实际能否读到由 latestBodyWeight 是否返回数据体现）。
    func requestReadAuthorization() async -> Bool
    /// 读最新一条体重（无授权 / 无数据 / 设备不支持 → nil）。
    func latestBodyWeight() async -> BodyWeightSample?
}
