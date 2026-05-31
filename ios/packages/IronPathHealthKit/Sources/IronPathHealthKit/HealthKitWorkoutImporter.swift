// HealthKitWorkoutImporter — HK-2 HealthKit Workout-History Import V1.
//
// Orchestrates a READ-ONLY workout-history import: authorize → read recent
// workouts → map each to a canonical `ImportedWorkoutSample`. Pure wiring over the
// injected `WorkoutSampleSource` seam + the pure `HealthKitWorkoutMapper` — NO
// HealthKit import here, so it is fully unit-testable with a fake source. The gated
// WRITE into canonical AppData is NOT done here: the app hands each returned sample
// to `IronPathPersistence.CanonicalSessionWriter.appendImportedWorkoutSample` (the
// iOS-17A / HK-1 DataHealth-gated, backup-before-overwrite, no-fake-success path).
// Imported workouts land in `AppData.importedWorkoutSamples` (DERIVED, display-only)
// and never become canonical sessions / engine input.

import Foundation
import IronPathDomain

public struct HealthKitWorkoutImporter {
    private let source: WorkoutSampleSource

    public init(source: WorkoutSampleSource) {
        self.source = source
    }

    /// Request read authorization, read the most recent workouts (newest first, at
    /// most `limit`), and map each into a canonical `ImportedWorkoutSample`.
    ///
    /// - Returns: the mapped samples in read order, or an empty array when there is
    ///   nothing to import (no workouts recorded, or read access not granted) — an
    ///   honest "nothing imported", never a fabricated sample.
    /// - Throws: only if the source itself throws (e.g. the authorization request
    ///   could not be made). The caller surfaces that honestly.
    public func importRecentWorkouts(
        importedAt: Date,
        limit: Int = 50,
        batchId: String? = nil
    ) async throws -> [ImportedWorkoutSample] {
        try await source.requestReadAuthorization()
        let readings = try await source.recentWorkouts(limit: limit)
        return readings.map {
            HealthKitWorkoutMapper.sample(from: $0, importedAt: importedAt, batchId: batchId)
        }
    }
}
