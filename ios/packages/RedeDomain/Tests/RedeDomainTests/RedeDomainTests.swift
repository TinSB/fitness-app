import XCTest
@testable import RedeDomain

final class RedeDomainTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(RedeDomainVersion.value, "0.0.1-bootstrap")
    }
}
