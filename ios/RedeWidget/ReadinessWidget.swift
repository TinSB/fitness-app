// ReadinessWidget — W-1 Readiness Widget V1.
//
// The home-screen widget: a TimelineProvider that READS the derived readiness
// snapshot from the shared App Group (via the RedeWidgetShared
// `WidgetSnapshotStore` seam → the `#if os(iOS)` `AppGroupWidgetSnapshotStore`),
// maps it to a view state with the PURE `ReadinessWidgetPresentation`, and renders
// it. READ-ONLY: it never writes the snapshot, never writes canonical AppData, and
// never touches the network — it only renders a derived presentation record (§12).
// An absent/unreadable snapshot shows the honest placeholder.

import SwiftUI
import WidgetKit
import RedeWidgetShared

/// One timeline entry = a rendered view state at an instant.
struct ReadinessWidgetEntry: TimelineEntry {
    let date: Date
    let viewState: ReadinessWidgetViewState
}

/// Reads the App Group snapshot and produces entries. The pure mapping lives in the
/// package; this provider is the thin WidgetKit integration.
struct ReadinessWidgetProvider: TimelineProvider {
    private let store: WidgetSnapshotStore

    init(store: WidgetSnapshotStore = AppGroupWidgetSnapshotStore()) {
        self.store = store
    }

    func placeholder(in context: Context) -> ReadinessWidgetEntry {
        let now = Date()
        return ReadinessWidgetEntry(date: now, viewState: ReadinessWidgetPresentation.viewState(from: nil, now: now))
    }

    func getSnapshot(in context: Context, completion: @escaping (ReadinessWidgetEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ReadinessWidgetEntry>) -> Void) {
        let entry = currentEntry()
        // Readiness is a daily-ish concept; refresh roughly hourly. The app ALSO
        // asks WidgetKit to reload when it writes a fresh snapshot, so this is just
        // the fallback cadence.
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: entry.date)
            ?? entry.date.addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func currentEntry() -> ReadinessWidgetEntry {
        let now = Date()
        return ReadinessWidgetEntry(
            date: now,
            viewState: ReadinessWidgetPresentation.viewState(from: store.read(), now: now)
        )
    }
}

/// The widget's SwiftUI view — renders the view state verbatim. No logic.
struct ReadinessWidgetEntryView: View {
    let entry: ReadinessWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.viewState.headline)
                .font(.headline)
                .lineLimit(1)
            Text(entry.viewState.advice)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            ForEach(Array(entry.viewState.rows.prefix(2)), id: \.label) { row in
                HStack {
                    Text(row.label)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(row.value)
                        .foregroundStyle(.primary)
                }
                .font(.caption2)
            }
            Spacer(minLength: 0)
            Text(entry.viewState.footnote)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(12)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct ReadinessWidget: Widget {
    let kind = "RedeReadinessWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ReadinessWidgetProvider()) { entry in
            ReadinessWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("今日准备度")
        .description("查看今日训练准备度与下一次训练概览（只读 · 本机）。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
