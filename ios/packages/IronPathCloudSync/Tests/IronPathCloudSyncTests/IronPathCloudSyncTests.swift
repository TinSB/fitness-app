import XCTest
@testable import IronPathCloudSync

final class IronPathCloudSyncTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(IronPathCloudSyncVersion.value, "0.0.1-bootstrap")
    }
}
