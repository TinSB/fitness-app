import XCTest
@testable import IronPathHealthKit

final class IronPathHealthKitTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(IronPathHealthKitVersion.value, "0.0.1-bootstrap")
    }
}
