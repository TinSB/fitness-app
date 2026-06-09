// HealthKitBodyWeightImportSection — HK-1 HealthKit Body-Weight Import V1.
//
// Thin presentation for the user-gated Apple-Health body-weight import, mounted
// as one Section in the 我的 (Profile) tab. The button is the authorization gate:
// tapping it opts the app into the real HealthKit source (triggering the system
// permission prompt on first use) and reads the latest body weight via the
// `HealthKitBodyWeightImportModel`. Status is rendered honestly — no fake success
// (master §15.4). Pure rendering + a Task hand-off to the view-model; no logic.

import SwiftUI

struct HealthKitBodyWeightImportSection: View {
    // Mirrors FocusModeShellView's `@StateObject private var state = FocusModeMvpState()`
    // property-initializer pattern (the MainActor-safe way to own a @MainActor
    // view-model in a SwiftUI View — a custom init's default argument is evaluated
    // in a nonisolated context and would not compile).
    @StateObject private var model = HealthKitBodyWeightImportModel()

    var body: some View {
        Section {
            Button {
                Task { await model.importLatestBodyWeight() }
            } label: {
                HStack {
                    Label("从 Apple 健康导入最新体重", systemImage: "heart.text.square")
                    Spacer()
                    if isImporting { ProgressView() }
                }
            }
            .disabled(isImporting)

            if let line = statusLine {
                Text(line)
                    .font(.footnote)
                    .foregroundStyle(statusIsError ? .red : .secondary)
            }
        } header: {
            Text("健康数据")
        } footer: {
            Text("仅在你授权后，从 Apple 健康只读读取最新体重并存入本机（千克）。数据不出本设备，绝不写回 Apple 健康。")
        }
    }

    private var isImporting: Bool {
        if case .importing = model.status { return true }
        return false
    }

    private var statusIsError: Bool {
        if case .failed = model.status { return true }
        return false
    }

    private var statusLine: String? {
        switch model.status {
        case .idle, .importing:
            return nil
        case .imported(let kilograms):
            return "已导入最新体重 \(String(format: "%.1f", kilograms)) kg"
        case .noData:
            return "Apple 健康中没有可导入的体重，或未授权读取。"
        case .unavailable:
            return "当前环境不读取健康数据。"
        case .failed(let message):
            return "导入失败：\(message)"
        }
    }
}

#Preview {
    List {
        HealthKitBodyWeightImportSection()
    }
}
