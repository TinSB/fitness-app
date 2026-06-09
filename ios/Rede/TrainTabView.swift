import SwiftUI

struct TrainTabView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label("训练", systemImage: "figure.strengthtraining.traditional")
            } description: {
                Text("专注训练：当前组、休息计时和下一组建议")
            }
            .navigationTitle("训练")
        }
    }
}

#Preview {
    TrainTabView()
}
