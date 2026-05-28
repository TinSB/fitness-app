import XCTest
@testable import IronPathDataHealth

final class IronPathDataHealthTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(IronPathDataHealthVersion.value, "0.0.1-bootstrap")
    }
}
