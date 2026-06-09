import XCTest
@testable import RedeHealthKit

final class RedeHealthKitTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(RedeHealthKitVersion.value, "0.0.1-bootstrap")
    }
}
