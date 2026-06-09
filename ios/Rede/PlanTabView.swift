import SwiftUI

struct PlanTabView: View {
    let onGoToToday: () -> Void

    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label("计划即将上线", systemImage: "calendar")
            } description: {
                Text("未来几周的训练结构、调整建议和回滚控制会在这里")
            } actions: {
                Button("回到今日") {
                    onGoToToday()
                }
            }
            .navigationTitle("计划")
        }
    }
}

#Preview {
    PlanTabView(onGoToToday: {})
}
