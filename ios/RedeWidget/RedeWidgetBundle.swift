// RedeWidgetBundle — W-1 Readiness Widget V1.
//
// The widget extension's @main entry. Hosts the single read-only readiness widget.
// The extension reads a DERIVED snapshot from the shared App Group and renders it;
// it NEVER writes canonical AppData and is NEVER a source of truth (master §12/§18).

import SwiftUI
import WidgetKit

@main
struct RedeWidgetBundle: WidgetBundle {
    var body: some Widget {
        ReadinessWidget()
    }
}
