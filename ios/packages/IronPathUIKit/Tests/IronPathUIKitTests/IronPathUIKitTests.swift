import XCTest
@testable import IronPathUIKit

final class IronPathUIKitTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(IronPathUIKitVersion.value, "0.0.1-bootstrap")
    }
}
