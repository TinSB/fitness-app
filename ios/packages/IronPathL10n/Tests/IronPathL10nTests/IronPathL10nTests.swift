import XCTest
@testable import IronPathL10n

final class IronPathL10nTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(IronPathL10nVersion.value, "0.0.1-bootstrap")
    }
}
