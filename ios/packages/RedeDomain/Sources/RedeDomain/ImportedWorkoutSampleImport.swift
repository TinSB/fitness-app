// ImportedWorkoutSampleImport — HK-2 HealthKit Workout-History Import V1.
//
// Pure, IO-free open-bag transform that appends ONE externally-imported
// `ImportedWorkoutSample` to canonical `AppData.importedWorkoutSamples` — the home
// the AppData model already reserves for Apple-Health-origin workout summaries
// (legacy web schema `retired web reference`). This is the "candidate construction"
// half of HK-2; the gated IO half (load → gate → backup → atomic save) reuses the
// iOS-17A / HK-1 paradigm in
// `RedePersistence.CanonicalSessionWriter.appendImportedWorkoutSample`, and the
// DataHealth gate is supplied by the caller.
//
// WHY `importedWorkoutSamples` and NOT `history`:
//   An imported Apple-Health workout is DERIVED / EXTERNAL data, not a native
//   canonical `TrainingSession`. It must NEVER become a source-of-truth training
//   record and NEVER feed the `RedeTrainingDecision` engine (readiness / e1RM).
//   `history[]` is the canonical native-session bag that the engine consumes;
//   `importedWorkoutSamples[]` is a separate display-only bag. Keeping the two
//   apart is exactly what makes the import non-canonical (§8). The legacy web schema source of
//   truth models the same split (`AppData.importedWorkoutSamples` is distinct from
//   `AppData.history`).
//
// 100% pure value logic — NO FileManager, NO disk, NO network, NO cloud, NO
// clock. Energy/distance/duration stay SI/metric (kcal / meters / minutes);
// weight elsewhere stays kilograms (the UnitSettings contract).

import Foundation

extension AppData {
    /// Typed imported-workout summaries. Malformed entries are silently skipped.
    /// Empty when the slot is missing. Read-only projection over `root` — it never
    /// mutates `root` and never affects `canonicalJSONData()`.
    public var importedWorkoutSamples: [ImportedWorkoutSample] {
        guard let arr = root["importedWorkoutSamples"]?.arrayValue else { return [] }
        return arr.compactMap { try? ImportedWorkoutSample(decoding: $0) }
    }

    /// A new `AppData` with `sample` appended to `importedWorkoutSamples`. Pure
    /// value transform (Swift value semantics — the receiver is untouched). ONLY
    /// the `importedWorkoutSamples` key is rewritten, in place; every other
    /// top-level key and all unknown/open-bag fields are preserved verbatim (§9
    /// open-bag invariant), and `schemaVersion` is unchanged (an append is not a
    /// schema change). The canonical emitter sorts keys, so in-place vs append
    /// position never affects `canonicalJSONData()`.
    ///
    /// Idempotent by content id: when `sample.id` is non-nil and a sample with the
    /// same `id` is already present, the receiver is returned UNCHANGED — so
    /// re-importing the same workout never creates a duplicate. (Mirrors the legacy web schema
    /// importer's dedup-by-content-key in `retired web reference`,
    /// where the workout id is content-addressed.)
    public func appendingImportedWorkoutSample(_ sample: ImportedWorkoutSample) -> AppData {
        let existing = root["importedWorkoutSamples"]?.arrayValue ?? []
        // Dedup by content id: a non-nil id already present → no-op (idempotent).
        if let id = sample.id,
           existing.contains(where: { $0.objectValue?["id"]?.stringValue == id }) {
            return self
        }
        let nextSamples = JSONValue.array(existing + [sample.encoded()])
        var entries = root.entries
        if let idx = entries.firstIndex(where: { $0.key == "importedWorkoutSamples" }) {
            entries[idx] = OrderedJSONObject.Entry(key: "importedWorkoutSamples", value: nextSamples)
        } else {
            entries.append(OrderedJSONObject.Entry(key: "importedWorkoutSamples", value: nextSamples))
        }
        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }
}
