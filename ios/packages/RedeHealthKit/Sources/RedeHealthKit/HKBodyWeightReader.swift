// HKBodyWeightReader — FR-PR8 平台适配器（范围 A，只读体重）。
//
// 唯一 import HealthKit 的文件，#if os(iOS) 包裹 → host `swift test` 自动排除
//（同 RedeNotifications 的 UNUserNotificationCenterScheduler / RedeWidgetShared 的 AppGroup 适配器范式）。
// 只读 bodyMass、只查最新一条；不写任何 HealthKit 数据（范围 A 不写 HKWorkout）。无存储可变状态 → Sendable。

#if os(iOS)
import Foundation
import HealthKit

public struct HKBodyWeightReader: BodyWeightReading {
    public init() {}
    private var store: HKHealthStore { HKHealthStore() }
    private var bodyMass: HKQuantityType { HKQuantityType(.bodyMass) }

    public func requestReadAuthorization() async -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        do {
            // toShare 空 = 不申请任何写权限（范围 A 只读）。read 仅 bodyMass。
            try await store.requestAuthorization(toShare: [], read: [bodyMass])
            return true
        } catch {
            return false
        }
    }

    public func latestBodyWeight() async -> BodyWeightSample? {
        guard HKHealthStore.isHealthDataAvailable() else { return nil }
        let mass = bodyMass
        return await withCheckedContinuation { (cont: CheckedContinuation<BodyWeightSample?, Never>) in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let query = HKSampleQuery(sampleType: mass, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
                guard let sample = samples?.first as? HKQuantitySample else {
                    cont.resume(returning: nil)
                    return
                }
                let kg = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
                let fmt = DateFormatter()
                fmt.locale = Locale(identifier: "en_US_POSIX")
                fmt.timeZone = .current
                fmt.dateFormat = "yyyy-MM-dd"
                cont.resume(returning: BodyWeightSample(kg: kg, dateISO: fmt.string(from: sample.endDate)))
            }
            store.execute(query)
        }
    }
}
#endif
