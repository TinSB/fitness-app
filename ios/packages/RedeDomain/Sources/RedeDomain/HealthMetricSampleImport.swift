// HealthMetricSampleImport — HK-1 HealthKit Body-Weight Import V1.
//
// Pure, IO-free open-bag transform that appends ONE externally-imported
// `HealthMetricSample` to canonical `AppData.healthMetricSamples` — the home
// the AppData model already reserves for Apple-Health-origin samples (see
// `HealthMetricSample.swift`: "iOS-8 HealthKit can read the payload"). This is
// the "candidate construction" half of HK-1; the gated IO half (load → gate →
// backup → atomic save) reuses the iOS-17A paradigm in
// `RedePersistence.CanonicalSessionWriter.appendHealthMetricSample`, and the
// DataHealth gate is supplied by the caller.
//
// WHY `healthMetricSamples` and NOT `userProfile.weightKg`:
//   The legacy web implementation source of truth this model mirrors imports Apple-Health body
//   weight as a `HealthMetricSample { metricType: "body_weight", unit: "kg" }`
//   (`retired web reference` / `appleHealthTypeMap.ts`). The
//   "current body weight" is then DERIVED at read time as the latest such
//   sample (`retired web reference` → `latestBodyWeightKg`). The
//   import NEVER writes `userProfile.weightKg` — that is the user's self-entered
//   profile field. HK-1 stays faithful to that contract: imported readings land
//   in the time-series, and the latest is derived, not overwritten into profile.
//
// 100% pure value logic — NO FileManager, NO disk, NO network, NO cloud, NO
// clock. Weight stays kilograms end-to-end (the WeightUnit / UnitSettings
// contract: "Storage is always kilograms").

import Foundation

extension AppData {
    /// A new `AppData` with `sample` appended to `healthMetricSamples`. Pure value
    /// transform (Swift value semantics — the receiver is untouched). ONLY the
    /// `healthMetricSamples` key is rewritten, in place; every other top-level key
    /// and all unknown/open-bag fields are preserved verbatim (§9 open-bag
    /// invariant), and `schemaVersion` is unchanged (an append is not a schema
    /// change). The canonical emitter sorts keys, so in-place vs append position
    /// never affects `canonicalJSONData()`.
    ///
    /// Idempotent by content id: when `sample.id` is non-nil and a sample with the
    /// same `id` is already present, the receiver is returned UNCHANGED — so
    /// re-importing the same "latest" reading never creates a duplicate. (Mirrors
    /// the legacy web schema importer's dedup-by-content-key in `retired web reference`,
    /// where the sample id is content-addressed.)
    public func appendingHealthMetricSample(_ sample: HealthMetricSample) -> AppData {
        let existing = root["healthMetricSamples"]?.arrayValue ?? []
        // Dedup by content id: a non-nil id already present → no-op (idempotent).
        if let id = sample.id,
           existing.contains(where: { $0.objectValue?["id"]?.stringValue == id }) {
            return self
        }
        let nextSamples = JSONValue.array(existing + [sample.encoded()])
        var entries = root.entries
        if let idx = entries.firstIndex(where: { $0.key == "healthMetricSamples" }) {
            entries[idx] = OrderedJSONObject.Entry(key: "healthMetricSamples", value: nextSamples)
        } else {
            entries.append(OrderedJSONObject.Entry(key: "healthMetricSamples", value: nextSamples))
        }
        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }
}
