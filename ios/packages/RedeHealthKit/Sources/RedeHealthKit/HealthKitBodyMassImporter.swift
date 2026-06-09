// HealthKitBodyMassImporter — HK-1 HealthKit Body-Weight Import V1.
//
// Orchestrates a READ-ONLY body-weight import: authorize → read latest → map to
// a canonical `HealthMetricSample`. Pure wiring over the injected
// `BodyMassSampleSource` seam + the pure `HealthKitBodyMassMapper` — NO HealthKit
// import here, so it is fully unit-testable with a fake source. The gated WRITE
// into canonical AppData is NOT done here: the app hands the returned sample to
// `RedePersistence.CanonicalSessionWriter.appendHealthMetricSample` (the
// iOS-17A DataHealth-gated, backup-before-overwrite, no-fake-success paradigm).

import Foundation
import RedeDomain

public struct HealthKitBodyMassImporter {
    private let source: BodyMassSampleSource

    public init(source: BodyMassSampleSource) {
        self.source = source
    }

    /// Request read authorization, read the latest body-mass reading, and map it
    /// into a canonical `HealthMetricSample`.
    ///
    /// - Returns: the mapped sample, or `nil` when there is nothing to import
    ///   (no reading recorded, or read access not granted) — an honest
    ///   "nothing imported", never a fabricated empty sample.
    /// - Throws: only if the source itself throws (e.g. the authorization request
    ///   could not be made). The caller surfaces that honestly.
    public func importLatestBodyMass(
        importedAt: Date,
        batchId: String? = nil
    ) async throws -> HealthMetricSample? {
        try await source.requestReadAuthorization()
        guard let reading = try await source.latestBodyMass() else { return nil }
        return HealthKitBodyMassMapper.sample(from: reading, importedAt: importedAt, batchId: batchId)
    }
}
