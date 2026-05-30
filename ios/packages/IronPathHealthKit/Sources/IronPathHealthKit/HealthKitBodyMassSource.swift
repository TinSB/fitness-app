// HealthKitBodyMassSource — HK-1 HealthKit Body-Weight Import V1.
//
// THE ONLY file in the iOS tree that imports HealthKit and touches HKHealthStore
// / HKQuantityType. It is the real, device-backed `BodyMassSampleSource`.
//
// Compiled `#if os(iOS)` ONLY: the host `swift test` toolchain (macOS) never
// builds this file, which is exactly why the mapping logic lives behind the
// `BodyMassReading` / `BodyMassSampleSource` seam (in `BodyMassReading.swift`)
// and is unit-tested there with injected samples. The iOS app/device build is
// where this file compiles and runs.
//
// READ-ONLY (master §17/§18 as amended by HK-1): it requests READ authorization
// for body mass (`toShare: []` — shares NOTHING) and reads the latest sample.
// There is NO write-back path — no `HKHealthStore.save`, no sample construction.
// Writing IronPath data into Apple Health is the deferred HK-3 slice.
//
// The static guard `tests/iosBootstrapForbiddenImports.test.ts` exempts THIS one
// file path from the HealthKit-token bans and additionally asserts it stays
// read-only; every other Swift file under ios/ stays HealthKit-free.

#if os(iOS)
import Foundation
import HealthKit

public struct HealthKitBodyMassSource: BodyMassSampleSource {
    private let store = HKHealthStore()
    private let bodyMassType = HKQuantityType(.bodyMass)

    public init() {}

    /// Request READ authorization for body mass. Shares nothing (`toShare: []`).
    /// A no-op (returns normally) when HealthKit is unavailable on the device.
    public func requestReadAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        try await store.requestAuthorization(toShare: [], read: [bodyMassType])
    }

    /// Read the single most-recent body-mass sample and lift it into a plain
    /// `BodyMassReading` (kg). Returns nil when HealthKit is unavailable, access
    /// was not granted, or no sample exists.
    public func latestBodyMass() async throws -> BodyMassReading? {
        guard HKHealthStore.isHealthDataAvailable() else { return nil }
        let newestFirst = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let sample: HKQuantitySample? = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: bodyMassType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [newestFirst]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: samples?.first as? HKQuantitySample)
            }
            store.execute(query)
        }
        guard let sample else { return nil }
        // HealthKit unit conversion → always kilograms (UnitSettings contract).
        let kilograms = sample.quantity.doubleValue(for: HKUnit.gramUnit(with: .kilo))
        return BodyMassReading(
            startDate: sample.startDate,
            kilograms: kilograms,
            sourceName: sample.sourceRevision.source.name,
            deviceSourceName: sample.device?.name
        )
    }
}
#endif
