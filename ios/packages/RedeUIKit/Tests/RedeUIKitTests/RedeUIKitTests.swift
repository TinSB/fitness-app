import XCTest
@testable import RedeUIKit

final class RedeUIKitTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(RedeUIKitVersion.value, "0.0.1-bootstrap")
    }
}
