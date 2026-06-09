import XCTest
@testable import RedePersistence

final class RedePersistenceTests: XCTestCase {
    func testVersionIsBootstrap() {
        XCTAssertEqual(RedePersistenceVersion.value, "0.0.1-bootstrap")
    }
}
