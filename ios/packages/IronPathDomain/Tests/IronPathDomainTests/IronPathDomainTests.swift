import XCTest
@testable import IronPathDomain

final class IronPathDomainTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(IronPathDomainVersion.value, "0.0.1-bootstrap")
    }
}
