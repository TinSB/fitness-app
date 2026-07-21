import XCTest
@testable import RedeEntitlements

final class AccessPolicyTests: XCTestCase {
    func testFreeCoreIsAvailableInEveryEntitlementState() {
        let states: [EntitlementState] = [
            .checking,
            .freeCore,
            .paidCoach(expirationDate: nil, billingState: .active),
            .paidCoach(expirationDate: Date(timeIntervalSince1970: 1), billingState: .gracePeriod),
            .unknown(.storeUnavailable),
            .unknown(.verificationFailed),
        ]

        for state in states {
            XCTAssertTrue(
                FeatureAccessPolicy.allows(.freeCore, entitlement: state),
                "Rede 1.8 Free Core must never be blocked by subscription state: \(state)"
            )
        }
    }

    func testPaidCoachRequiresVerifiedPaidEntitlement() {
        XCTAssertTrue(FeatureAccessPolicy.allows(
            .paidCoach,
            entitlement: .paidCoach(expirationDate: nil, billingState: .active)
        ))
        XCTAssertTrue(FeatureAccessPolicy.allows(
            .paidCoach,
            entitlement: .paidCoach(expirationDate: nil, billingState: .gracePeriod)
        ))

        for state in [
            EntitlementState.checking,
            .freeCore,
            .unknown(.storeUnavailable),
            .unknown(.verificationFailed),
        ] {
            XCTAssertFalse(FeatureAccessPolicy.allows(.paidCoach, entitlement: state))
        }
    }

    func testPaidCoachAccessFailsClosedAfterVerifiedExpiration() {
        let now = Date(timeIntervalSince1970: 1_000)

        XCTAssertTrue(FeatureAccessPolicy.allows(
            .paidCoach,
            entitlement: .paidCoach(
                expirationDate: Date(timeIntervalSince1970: 1_001),
                billingState: .active
            ),
            now: now
        ))
        XCTAssertFalse(FeatureAccessPolicy.allows(
            .paidCoach,
            entitlement: .paidCoach(
                expirationDate: now,
                billingState: .active
            ),
            now: now
        ))
        XCTAssertFalse(FeatureAccessPolicy.allows(
            .paidCoach,
            entitlement: .paidCoach(
                expirationDate: Date(timeIntervalSince1970: 999),
                billingState: .gracePeriod
            ),
            now: now
        ))
    }

    func testPurchaseLaunchGateRequiresCapabilityCatalogAndPolicies() {
        let products = [
            SubscriptionProduct(
                id: "rede.coach.monthly",
                displayName: "Rede Coach Monthly",
                displayPrice: "$4.99",
                period: .monthly,
                subscriptionGroupID: "coach"
            ),
            SubscriptionProduct(
                id: "rede.coach.annual",
                displayName: "Rede Coach Annual",
                displayPrice: "$39.99",
                period: .annual,
                subscriptionGroupID: "coach"
            ),
        ]
        let ready = SubscriptionConfiguration(
            productIDs: products.map(\.id),
            privacyPolicyURL: URL(string: "https://rede.fit/privacy")!,
            termsOfUseURL: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!,
            paidCapabilityIsReady: true
        )

        XCTAssertEqual(SubscriptionLaunchGate.evaluate(configuration: ready, products: products), .ready)
        XCTAssertEqual(
            SubscriptionLaunchGate.evaluate(
                configuration: SubscriptionConfiguration(
                    productIDs: ready.productIDs,
                    privacyPolicyURL: ready.privacyPolicyURL,
                    termsOfUseURL: ready.termsOfUseURL,
                    paidCapabilityIsReady: false
                ),
                products: products
            ),
            .blocked(.paidCapabilityNotReady)
        )
        XCTAssertEqual(
            SubscriptionLaunchGate.evaluate(
                configuration: SubscriptionConfiguration(
                    productIDs: ready.productIDs,
                    privacyPolicyURL: nil,
                    termsOfUseURL: ready.termsOfUseURL,
                    paidCapabilityIsReady: true
                ),
                products: products
            ),
            .blocked(.missingPolicyLinks)
        )
        XCTAssertEqual(
            SubscriptionLaunchGate.evaluate(configuration: ready, products: [products[0]]),
            .blocked(.catalogMismatch)
        )
    }

    func testPurchaseLaunchGateRejectsNonHTTPSAndMixedGroups() {
        let config = SubscriptionConfiguration(
            productIDs: ["monthly", "annual"],
            privacyPolicyURL: URL(string: "http://rede.fit/privacy")!,
            termsOfUseURL: URL(string: "https://rede.fit/terms")!,
            paidCapabilityIsReady: true
        )
        let mixedGroups = [
            SubscriptionProduct(
                id: "monthly", displayName: "Monthly", displayPrice: "$1",
                period: .monthly, subscriptionGroupID: "group-a"
            ),
            SubscriptionProduct(
                id: "annual", displayName: "Annual", displayPrice: "$10",
                period: .annual, subscriptionGroupID: "group-b"
            ),
        ]

        XCTAssertEqual(
            SubscriptionLaunchGate.evaluate(configuration: config, products: mixedGroups),
            .blocked(.invalidPolicyLinks)
        )

        let secureConfig = SubscriptionConfiguration(
            productIDs: config.productIDs,
            privacyPolicyURL: URL(string: "https://rede.fit/privacy")!,
            termsOfUseURL: config.termsOfUseURL,
            paidCapabilityIsReady: true
        )
        XCTAssertEqual(
            SubscriptionLaunchGate.evaluate(configuration: secureConfig, products: mixedGroups),
            .blocked(.catalogMismatch)
        )
    }

    func testSubscriptionPagePresentationSeparatesPreparationFromOperationalFailure() {
        XCTAssertEqual(
            SubscriptionPagePolicy.presentation(for: .blocked(.paidCapabilityNotReady)),
            .preparing
        )
        for blocker in [
            SubscriptionLaunchBlocker.missingPolicyLinks,
            .invalidPolicyLinks,
            .catalogMismatch,
        ] {
            XCTAssertEqual(
                SubscriptionPagePolicy.presentation(for: .blocked(blocker)),
                .unavailable
            )
        }
        XCTAssertEqual(
            SubscriptionPagePolicy.presentation(
                for: SubscriptionLaunchGate.evaluate(configuration: .disabled, products: [])
            ),
            .preparing,
            "The production-disabled configuration must render the page shell without StoreKit controls"
        )
        XCTAssertEqual(SubscriptionPagePolicy.presentation(for: .ready), .store)
    }

    func testBlockedPageNeverShowsTransactionControlsAcrossEntitlementStates() {
        let decisions: [SubscriptionLaunchDecision] = [
            .blocked(.paidCapabilityNotReady),
            .blocked(.missingPolicyLinks),
            .blocked(.invalidPolicyLinks),
            .blocked(.catalogMismatch),
        ]
        let entitlements: [EntitlementState] = [
            .checking,
            .freeCore,
            .paidCoach(expirationDate: nil, billingState: .active),
            .paidCoach(expirationDate: nil, billingState: .gracePeriod),
            .unknown(.storeUnavailable),
            .unknown(.verificationFailed),
        ]

        for decision in decisions {
            let presentation = SubscriptionPagePolicy.presentation(for: decision)
            XCTAssertFalse(presentation.showsTransactionControls)
            for entitlement in entitlements {
                XCTAssertTrue(FeatureAccessPolicy.allows(.freeCore, entitlement: entitlement))
            }
        }
        XCTAssertTrue(SubscriptionPagePolicy.presentation(for: .ready).showsTransactionControls)
    }
}
