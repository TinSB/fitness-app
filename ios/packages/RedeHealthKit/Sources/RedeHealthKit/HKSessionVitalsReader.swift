// HKSessionVitalsReader — 把表上那场 HKWorkout 读回来给手机显示。
//
// 为什么是「读回来」而不是让表实时同步过来：表上的 HKWorkoutSession 本来就会在结束时
// 把整场（含心率与能量）写进健康，手机的健康库随后拿到同一条。再造一条 WatchConnectivity
// 通道去实时推同样的数，只会多一个会漂移、会丢包的真源。断连练完的那一场也照样读得到。
//
// 代价是**有延迟**：表结束 → 写入 → 同步到手机，可能几秒也可能几分钟。所以这些值只出现在
// 事后看的单场记录页，不出现在刚练完立刻弹出的小结里（那时候多半还没到）。
//
// 只 import HealthKit 于本文件、#if os(iOS) 包裹 → host `swift test` 自动排除（同 HKBodyWeightReader）。

#if os(iOS)
import Foundation
import HealthKit

public struct HKSessionVitalsReader: SessionVitalsReading {
    public init() {}

    private var store: HKHealthStore { HKHealthStore() }
    private var heartRate: HKQuantityType { HKQuantityType(.heartRate) }
    private var activeEnergy: HKQuantityType { HKQuantityType(.activeEnergyBurned) }
    private var bpmUnit: HKUnit { HKUnit.count().unitDivided(by: .minute()) }

    public func requestReadAuthorization() async -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else { return false }
        do {
            // toShare 空 = 手机侧永不写健康。写是表干的，用表自己的权限。
            try await store.requestAuthorization(
                toShare: [],
                read: [HKObjectType.workoutType(), heartRate, activeEnergy]
            )
            return true
        } catch {
            return false
        }
    }

    public func vitals(start: Date, end: Date) async -> SessionVitals? {
        guard HKHealthStore.isHealthDataAvailable() else { return nil }
        guard let workout = await matchingWorkout(start: start, end: end) else { return nil }

        let hr = workout.statistics(for: heartRate)
        let energy = workout.statistics(for: activeEnergy)
        return SessionVitals(
            durationSeconds: Int(workout.duration.rounded()),
            averageHeartRate: hr?.averageQuantity()?.doubleValue(for: bpmUnit).roundedInt,
            peakHeartRate: hr?.maximumQuantity()?.doubleValue(for: bpmUnit).roundedInt,
            activeEnergyKcal: energy?.sumQuantity()?.doubleValue(for: .kilocalorie()).roundedInt,
            heartRateSeries: await series(in: workout)
        )
    }

    /// 找与这段时间窗重叠最多的那场力量训练。
    ///
    /// 为什么不按来源过滤：写入方是**表 app**（bundle id 与手机不同），
    /// 从手机这边 `HKSource.default()` 只会匹配到手机自己写的——而手机什么都不写，
    /// 那样永远是空。按活动类型 + 时间重叠匹配，既能拿到自己的那场，
    /// 也不会把同一时段的一次散步认成这一场。
    ///
    /// 为什么取「重叠最多」而不是第一条：同一天可能有多场；边界上（一场刚结束下一场刚开始）
    /// 时间窗会同时碰到两条，取重叠最大的那条才是这一场。
    private func matchingWorkout(start: Date, end: Date) async -> HKWorkout? {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        return await withCheckedContinuation { (cont: CheckedContinuation<HKWorkout?, Never>) in
            let query = HKSampleQuery(sampleType: .workoutType(), predicate: predicate,
                                      limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                let workouts = (samples as? [HKWorkout])?
                    .filter { $0.workoutActivityType == .traditionalStrengthTraining } ?? []
                let best = workouts.max { a, b in
                    Self.overlap(a, start, end) < Self.overlap(b, start, end)
                }
                cont.resume(returning: best)
            }
            store.execute(query)
        }
    }

    private static func overlap(_ workout: HKWorkout, _ start: Date, _ end: Date) -> TimeInterval {
        max(0, min(workout.endDate, end).timeIntervalSince(max(workout.startDate, start)))
    }

    /// 这一场关联的心率样本。`predicateForObjects(from:)` 只取属于这场训练的那些——
    /// 按时间窗查会把训练前后几分钟的静息心率也带进来，曲线两端就会出现莫名其妙的低谷。
    private func series(in workout: HKWorkout) async -> [HeartRatePoint] {
        let predicate = HKQuery.predicateForObjects(from: workout)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        return await withCheckedContinuation { (cont: CheckedContinuation<[HeartRatePoint], Never>) in
            let query = HKSampleQuery(sampleType: heartRate, predicate: predicate,
                                      limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, samples, _ in
                let points = (samples as? [HKQuantitySample])?.map { sample in
                    HeartRatePoint(
                        secondsFromStart: Int(sample.startDate.timeIntervalSince(workout.startDate).rounded()),
                        bpm: sample.quantity.doubleValue(for: bpmUnit).roundedInt
                    )
                } ?? []
                cont.resume(returning: points.filter { $0.secondsFromStart >= 0 && $0.bpm > 0 })
            }
            store.execute(query)
        }
    }
}

private extension Double {
    /// 心率与千卡都只显示整数：小数位在这里没有任何信息量，只会让数字变长。
    var roundedInt: Int { Int(rounded()) }
}
#endif
