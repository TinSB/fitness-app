import XCTest
@testable import IronPathBackup

final class IronPathBackupTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(IronPathBackupVersion.value, "0.0.1-bootstrap")
    }
}
