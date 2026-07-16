// RedeWidgetBundle — W-1 Readiness Widget V1 + K6 Rest Live Activity.
//
// The widget extension's @main entry. Hosts the read-only readiness widget and the
// rest-timer Live Activity (K6, 2026-07-16). Both render DERIVED data handed over by
// the app; they NEVER write canonical AppData and are NEVER a source of truth
// (master §12/§18).

import SwiftUI
import WidgetKit

@main
struct RedeWidgetBundle: WidgetBundle {
    var body: some Widget {
        ReadinessWidget()
        RestLiveActivity()
    }
}
