import XCTest
@testable import IronPathPersistence

final class IronPathPersistenceTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(IronPathPersistenceVersion.value, "0.0.1-bootstrap")
    }
}
