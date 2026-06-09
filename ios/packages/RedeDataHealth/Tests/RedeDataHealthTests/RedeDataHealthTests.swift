import XCTest
@testable import RedeDataHealth

final class RedeDataHealthTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(RedeDataHealthVersion.value, "0.0.1-bootstrap")
    }
}
