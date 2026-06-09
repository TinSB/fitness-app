// WidgetSnapshotWriterModel — W-1 Readiness Widget V1.
//
// Thin app-layer view-model that publishes a small DERIVED read-only readiness
// snapshot to the shared App Group container for the home-screen widget, mirroring
// the HK-1 / N-1 seam pattern: it holds no state, opts INTO the real App Group store
// + the WidgetKit reloader on first activation (so SwiftUI previews/tests touch
// neither FileManager nor WidgetKit), and delegates everything to the
// `RedeWidgetShared` seams.
//
// HARD BOUNDARY (master §8/§12 as amended by W-1): this writes a DERIVED presentation
// snapshot ONLY. It NEVER writes canonical AppData, the snapshot is NEVER read back
// as a source of truth, and there is no network/cloud. A write failure is swallowed
// (the widget keeps its prior snapshot / shows the placeholder) — never a fake
// success, and the canonical document is untouched (only a derived share was written).
//
// This file NEVER imports WidgetKit (it uses the `WidgetReloading` seam) and NEVER
// touches FileManager (it uses the `WidgetSnapshotStore` seam); the real
// `AppGroupWidgetSnapshotStore` / `WidgetTimelineReloader` are constructed only
// `#if os(iOS)`.

import Foundation
import SwiftUI
import RedeWidgetShared

@MainActor
final class WidgetSnapshotWriterModel: ObservableObject {
    /// The App Group snapshot store. Injectable for previews/tests (nil → not opted
    /// in → publish is a no-op). The running app opts into the real store on launch.
    private var store: WidgetSnapshotStore?
    /// The WidgetKit reloader. Injectable; nil until opted in.
    private var reloader: WidgetReloading?
    /// Injectable clock; only invoked on the live publish path.
    private let now: () -> Date

    init(
        store: WidgetSnapshotStore? = nil,
        reloader: WidgetReloading? = nil,
        now: @escaping () -> Date = { Date() }
    ) {
        self.store = store
        self.reloader = reloader
        self.now = now
    }

    /// Opt the RUNNING app into the real App Group store + WidgetKit reloader
    /// (idempotent). Called once from the Today surface's `.task`; previews/tests
    /// leave them unset so they never touch FileManager / WidgetKit.
    func activateLiveSinksIfNeeded() {
        #if os(iOS)
        if store == nil { store = AppGroupWidgetSnapshotStore() }
        if reloader == nil { reloader = WidgetTimelineReloader() }
        #endif
    }

    /// Publish a derived readiness snapshot for the widget. No-op when no live store
    /// is opted in. A write failure is swallowed honestly (no fake success); the
    /// canonical AppData document is never touched.
    func publish(headline: String, advice: String, rows: [(String, String)]) {
        guard let store else { return }
        let snapshot = ReadinessWidgetSnapshot(
            generatedAtIso: iso8601(now()),
            headline: headline,
            advice: advice,
            rows: rows.map { ReadinessWidgetRow(label: $0.0, value: $0.1) }
        )
        do {
            try store.write(snapshot)
            reloader?.reloadWidgets()
        } catch {
            // No fake success: the widget keeps whatever snapshot it had. Nothing
            // canonical was written — this only ever wrote a derived share file.
        }
    }

    private func iso8601(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.string(from: date)
    }
}
