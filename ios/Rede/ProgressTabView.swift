import SwiftUI

struct ProgressTabView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label("进展", systemImage: "chart.line.uptrend.xyaxis")
            } description: {
                Text("训练历史、力量趋势和数据可信度")
            }
            .navigationTitle("进展")
        }
    }
}

#Preview {
    ProgressTabView()
}
