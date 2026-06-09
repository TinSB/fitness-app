import SwiftUI

struct TodayTabView: View {
    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label("今日", systemImage: "sun.max")
            } description: {
                Text("今天练不练、练什么、为什么——判断会在这里给出")
            }
            .navigationTitle("今日")
        }
    }
}

#Preview {
    TodayTabView()
}
