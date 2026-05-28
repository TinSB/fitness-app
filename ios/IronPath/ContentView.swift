// ContentView — iOS-1 placeholder.
// Three labels; no logic, no state, no navigation.

import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text("IronPath")
                .font(.largeTitle)
                .fontWeight(.semibold)
            Text("Native iOS Bootstrap")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("iOS-1 skeleton only")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
