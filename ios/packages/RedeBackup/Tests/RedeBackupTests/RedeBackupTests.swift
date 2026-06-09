import XCTest
@testable import RedeBackup

final class RedeBackupTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(RedeBackupVersion.value, "0.0.1-bootstrap")
    }
}
