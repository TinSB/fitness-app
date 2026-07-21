#if canImport(StoreKit)
import XCTest
@testable import RedeEntitlements

final class StoreKitSubscriptionProviderTests: XCTestCase {
    func testExpiredStatusReadFailureCannotBeReducedToFreeCore() {
        XCTAssertThrowsError(
            try StoreKitSubscriptionProvider.resolveExpiredStatusEvidence(.unavailable)
        ) { error in
            XCTAssertEqual(error as? SubscriptionIssue, .storeUnavailable)
        }
    }

    func testExpiredUnverifiedStatusCannotBeReducedToFreeCore() {
        XCTAssertThrowsError(
            try StoreKitSubscriptionProvider.resolveExpiredStatusEvidence(.unverified)
        ) { error in
            XCTAssertEqual(error as? SubscriptionIssue, .verificationFailed)
        }
    }
}
#endif
