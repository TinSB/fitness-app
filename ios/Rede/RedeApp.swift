// RedeApp — iOS-1 Xcode Project Bootstrap V1 entrypoint.
//
// iOS-1 ships an inert SwiftUI placeholder. The eight local Swift
// Packages are linked so the build proves the workspace + module graph
// resolves, but no business logic runs yet. See
// docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md.

import SwiftUI

import RedeDomain
import RedeDataHealth
import RedePersistence
import RedeHealthKit
import RedeBackup
import RedeL10n
import RedeUIKit

@main
struct RedeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// Exposed only for the iosBootstrap parity test — confirms every
/// package compiled and linked. Future iOS-N PRs replace this with
/// real call sites and remove the unused-import suppressions.
enum RedeLinkedPackages {
    static let versions: [String] = [
        RedeDomainVersion.value,
        RedeDataHealthVersion.value,
        RedePersistenceVersion.value,
        RedeHealthKitVersion.value,
        RedeBackupVersion.value,
        RedeL10nVersion.value,
        RedeUIKitVersion.value,
    ]
}
