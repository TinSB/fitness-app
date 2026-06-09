// HealthKitBodyWeightImportModel — HK-1 HealthKit Body-Weight Import V1.
//
// Thin app-layer view-model that wires the HK-1 read-only import, mirroring the
// iOS-17A `FocusModeMvpState` pattern: it holds in-RAM UI state, opts INTO the
// real Apple-Health source + the sanctioned canonical store on first real use
// (so SwiftUI previews never touch HealthKit or the on-disk document), and
// delegates ALL logic to packages — the pure `RedeHealthKit` importer and
// the iOS-17A `RedePersistence.CanonicalSessionWriter` gated write path.
//
// Honest status (master §15.4 — no fake success):
//   • .imported(kg) only after a real DataHealth-gated, backed-up, atomic write
//   • .noData when HealthKit returns nothing (also covers a denied read — Apple
//     Health intentionally hides read denial, so "no reading" is the honest line)
//   • .failed(_) on any thrown error (the canonical document stays intact)
//   • .unavailable in previews/tests (never opted in)
//
// This file never touches FileManager directly (the store does) and never
// imports HealthKit (it uses the package's `BodyMassSampleSource` seam); the
// real `HealthKitBodyMassSource` is constructed only `#if os(iOS)`.

import Foundation
import RedeDomain
import RedeDataHealth
import RedePersistence
import RedeHealthKit

enum HealthKitImportStatus: Equatable {
    case idle
    case importing
    case imported(kilograms: Double)
    case noData
    case unavailable
    case failed(String)
}

@MainActor
final class HealthKitBodyWeightImportModel: ObservableObject {
    @Published private(set) var status: HealthKitImportStatus = .idle

    /// The Apple-Health read source. Injectable for previews/tests (nil → not
    /// opted in). The running app opts into the real `HealthKitBodyMassSource`
    /// on the first import tap.
    private var source: BodyMassSampleSource?

    /// The sanctioned canonical AppData store (source of truth, §8). Injectable;
    /// nil until opted in.
    private var appDataStore: AppDataStore?

    /// Injectable import-time clock. Only invoked on the live import path.
    private let now: () -> Date

    init(
        source: BodyMassSampleSource? = nil,
        appDataStore: AppDataStore? = nil,
        now: @escaping () -> Date = { Date() }
    ) {
        self.source = source
        self.appDataStore = appDataStore
        self.now = now
    }

    /// Opt the RUNNING app into the real Apple-Health source + the Application
    /// Support canonical store. Idempotent; called lazily from the first import
    /// tap so previews/tests (which never tap) stay free of HealthKit + disk.
    private func optInToLiveSourcesIfNeeded() {
        #if os(iOS)
        if source == nil { source = HealthKitBodyMassSource() }
        #endif
        if appDataStore == nil { appDataStore = JSONFileAppDataStore.applicationSupport() }
    }

    /// User-gated import: request read authorization, read the latest body weight,
    /// and append it to canonical `AppData.healthMetricSamples` through the
    /// iOS-17A DataHealth-gated write path. Body weight stays kilograms.
    func importLatestBodyWeight() async {
        optInToLiveSourcesIfNeeded()
        guard let source, let appDataStore else {
            status = .unavailable   // previews/tests never opt in
            return
        }
        status = .importing
        let importer = HealthKitBodyMassImporter(source: source)
        do {
            guard let sample = try await importer.importLatestBodyMass(importedAt: now()) else {
                // No reading (none recorded, or read access not granted — Apple
                // Health hides denial). Honest "nothing to import".
                status = .noData
                return
            }
            let writer = CanonicalSessionWriter(store: appDataStore)
            try writer.appendHealthMetricSample(sample) { candidate in
                // DataHealth gate (§10): route the candidate through the read-only
                // clean-view ingress (no mutation, no auto-repair) and accept ONLY
                // when the imported body-weight sample survives the clean view's
                // read intact (decodes back as a kg body_weight sample). No fake
                // success — a rejected candidate is never written.
                guard let result = try? processIncomingAppData(
                    appData: candidate,
                    source: .importRestore,
                    options: AppDataIngressOptions(allowMutation: false, allowAutoRepair: false)
                ) else { return false }
                return result.cleanView.raw.healthMetricSamples.contains {
                    $0.id == sample.id && $0.metricType == "body_weight" && $0.unit == "kg"
                }
            }
            status = .imported(kilograms: sample.value?.doubleValue ?? 0)
        } catch {
            // No fake success: the on-disk canonical document is left intact
            // (backup-before-overwrite / atomic save guarantee no partial state).
            status = .failed(error.localizedDescription)
        }
    }
}
