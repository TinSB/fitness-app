// IronPathLocalSnapshot — package version marker.
//
// Per the iOS-1 local-package convention, every package's `<Package>.swift`
// file is version-constant-only; the real model/validation/migration/stats/
// store/restore logic lives in the sibling source files of this package.

public enum IronPathLocalSnapshotVersion {
    public static let value = "0.0.1-bootstrap"
}
