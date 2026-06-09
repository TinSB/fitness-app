import XCTest
@testable import RedeL10n

final class RedeL10nTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(RedeL10nVersion.value, "0.0.1-bootstrap")
    }
}
