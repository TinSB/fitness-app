// IronPathHealthKit — iOS-1 placeholder.
//
// This package will own the HealthKit live-read adapter, the
// Apple-Health type map, and the staleness guard in iOS-8. iOS-1 does
// NOT import HealthKit — the bare framework reference is gated by
// Info.plist usage descriptions which will land alongside the iOS-8
// implementation. Stop Condition #9 forbids HealthKit write
// permission unless a feature actually writes back.

public enum IronPathHealthKitVersion {
    public static let value = "0.0.1-bootstrap"
}
