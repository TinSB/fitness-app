import StoreKit
import StoreKitTest
import XCTest
@testable import Rede
import RedeDataHealth
import RedeEntitlements

/// StoreKitTest owns one process-global environment. Keep the full lifecycle in
/// one serial test so product, transaction, expiration, and refund state cannot
/// leak across independently scheduled cases.
@MainActor
final class StoreKitEntitlementsTests: XCTestCase {
    private let monthlyID = RedeSubscriptionRuntime.testMonthlyProductID
    private let annualID = RedeSubscriptionRuntime.testAnnualProductID

    func testProductionConfigurationFailsClosedWithoutApprovedProducts() {
        let configuration = RedeSubscriptionRuntime.configuration(
            bundle: .main,
            arguments: ["RedeTests"]
        )

        XCTAssertTrue(configuration.productIDs.isEmpty)
        XCTAssertFalse(configuration.paidCapabilityIsReady)
        let model = RedeSubscriptionRuntime.makeModel(configuration: configuration)
        XCTAssertEqual(model.launchDecision, .blocked(.paidCapabilityNotReady))
        let presentation = SubscriptionPagePolicy.presentation(for: model.launchDecision)
        XCTAssertEqual(presentation, .preparing)
        XCTAssertFalse(
            presentation.showsTransactionControls,
            "The production Settings and Rede Coach surfaces must expose no transaction controls"
        )
    }

    func testDebugPaidFixtureUnlocksFeatureWithoutOpeningPurchaseGate() async {
        #if DEBUG
        let configuration = RedeSubscriptionRuntime.configuration(
            bundle: .main,
            arguments: ["RedeTests"]
        )
        let model = RedeSubscriptionRuntime.makeModel(
            configuration: configuration,
            arguments: ["RedeTests", "-redePaidCoachActiveFixture"]
        )

        await model.start()

        XCTAssertTrue(FeatureAccessPolicy.allows(.paidCoach, entitlement: model.entitlement))
        XCTAssertEqual(model.launchDecision, .blocked(.paidCapabilityNotReady))
        let presentation = SubscriptionPagePolicy.presentation(for: model.launchDecision)
        XCTAssertEqual(presentation, .preparing)
        XCTAssertFalse(presentation.showsTransactionControls)
        #endif
    }

    func testRedeCoachPageContentCoversEntitlementAndLaunchGateMatrix() {
        let now = Date(timeIntervalSince1970: 10_000)
        let active = EntitlementState.paidCoach(
            expirationDate: Date(timeIntervalSince1970: 20_000),
            billingState: .active
        )
        let grace = EntitlementState.paidCoach(
            expirationDate: Date(timeIntervalSince1970: 20_000),
            billingState: .gracePeriod
        )
        let expired = EntitlementState.paidCoach(
            expirationDate: now,
            billingState: .active
        )

        XCTAssertEqual(
            RedeCoachPageContentPolicy.content(
                entitlement: active,
                launchDecision: .blocked(.catalogMismatch),
                now: now
            ),
            .weeklyReview,
            "Verified access must survive a product-catalog failure"
        )
        XCTAssertEqual(
            RedeCoachPageContentPolicy.content(
                entitlement: grace,
                launchDecision: .blocked(.missingPolicyLinks),
                now: now
            ),
            .weeklyReview,
            "Verified grace access must remain available"
        )

        let nonPaidCases: [(EntitlementState, SubscriptionLaunchDecision, RedeCoachPageContent)] = [
            (.checking, .blocked(.paidCapabilityNotReady), .subscription(.preparing)),
            (.freeCore, .ready, .subscription(.store)),
            (.unknown(.verificationFailed), .blocked(.catalogMismatch), .subscription(.unavailable)),
            (expired, .blocked(.paidCapabilityNotReady), .subscription(.preparing)),
            // Expiration/refund/revocation resolve to Free Core before this app policy runs.
            (.freeCore, .blocked(.catalogMismatch), .subscription(.unavailable)),
        ]
        for (entitlement, decision, expected) in nonPaidCases {
            XCTAssertEqual(
                RedeCoachPageContentPolicy.content(
                    entitlement: entitlement,
                    launchDecision: decision,
                    now: now
                ),
                expected
            )
        }

        let transition = [EntitlementState.checking, active, .freeCore].map {
            RedeCoachPageContentPolicy.content(
                entitlement: $0,
                launchDecision: .blocked(.paidCapabilityNotReady),
                now: now
            )
        }
        XCTAssertEqual(transition, [
            .subscription(.preparing),
            .weeklyReview,
            .subscription(.preparing),
        ])
    }

    func testWeeklyReviewFindingScopeCountsWeekDropsAndFailsClosedWhenDateIsUnknown() {
        let inWeekDrop = DataHealthIssue.setDropped(
            sessionId: "s1",
            dateISO: "2026-07-08",
            exerciseId: "squat",
            reason: .invalidWeight
        )
        let outOfWeekDrop = DataHealthIssue.exerciseDropped(
            sessionId: "s2",
            dateISO: "2026-07-15",
            reason: .missingExerciseId
        )
        XCTAssertEqual(
            WeeklyCoachReviewFindingScope.count(
                issues: [inWeekDrop, outOfWeekDrop, .profileFieldIgnored(field: "age")],
                suspectSetDatesISO: ["2026-07-09"],
                reviewWeekStartISO: "2026-07-06",
                reviewWeekEndExclusiveISO: "2026-07-13"
            ),
            2,
            "Only in-week dropped training facts and suspect sets belong to this review"
        )

        let unknownDateDrop = DataHealthIssue.sessionDropped(
            id: "s3",
            dateISO: nil,
            reason: .invalidDateFormat
        )
        XCTAssertNil(
            WeeklyCoachReviewFindingScope.count(
                issues: [unknownDateDrop],
                suspectSetDatesISO: [],
                reviewWeekStartISO: "2026-07-06",
                reviewWeekEndExclusiveISO: "2026-07-13"
            ),
            "A dropped training record with no trustworthy date must fail closed"
        )
    }

    func testLocalCatalogPurchasePendingRestoreRenewalExpirationAndRefund() async throws {
        let configurationURL = try XCTUnwrap(
            Bundle(for: StoreKitEntitlementsTests.self)
                .url(forResource: "Rede", withExtension: "storekit")
        )
        let session = try SKTestSession(contentsOf: configurationURL)
        session.disableDialogs = true
        session.resetToDefaultState()
        session.clearTransactions()

        let configuration = RedeSubscriptionRuntime.configuration(
            bundle: .main,
            arguments: ["RedeTests", "-redeStoreKitTest"]
        )
        let model = RedeSubscriptionRuntime.makeModel(configuration: configuration)
        await model.start()

        guard case .available(let catalog) = model.catalog else {
            return XCTFail("The local StoreKit catalog must load")
        }
        let expectedProductIDs = Set([monthlyID, annualID])
        guard Set(catalog.map(\.id)) == expectedProductIDs else {
            return XCTFail(
                "The local StoreKit catalog must contain both test products; got \(catalog.map(\.id))"
            )
        }
        XCTAssertEqual(Set(catalog.map(\.period)), Set([.monthly, .annual]))
        XCTAssertEqual(Set(catalog.map(\.subscriptionGroupID)).count, 1)
        XCTAssertEqual(model.launchDecision, .ready)
        XCTAssertEqual(model.entitlement, .freeCore)

        try await session.setSimulatedError(
            .generic(.userCancelled),
            forAPI: StoreKitPurchaseAPI()
        )
        await model.purchase(productID: monthlyID)
        XCTAssertEqual(model.operation, .idle)
        XCTAssertEqual(model.entitlement, .freeCore)
        try await session.setSimulatedError(nil, forAPI: StoreKitPurchaseAPI())

        try await session.setSimulatedError(
            .verification(.invalidSignature),
            forAPI: StoreKitVerificationAPI()
        )
        await model.purchase(productID: monthlyID)
        XCTAssertEqual(model.operation, .failed(.verificationFailed))
        XCTAssertFalse(FeatureAccessPolicy.allows(.paidCoach, entitlement: model.entitlement))
        try await session.setSimulatedError(nil, forAPI: StoreKitVerificationAPI())

        await model.purchase(productID: monthlyID)
        guard case .paidCoach = model.entitlement else {
            return XCTFail("A verified local purchase must grant Paid Coach")
        }
        XCTAssertEqual(model.operation, .succeeded(.purchase))

        try session.expireSubscription(productIdentifier: monthlyID)
        await model.refresh()
        XCTAssertEqual(model.entitlement, .freeCore)

        session.askToBuyEnabled = true
        await model.purchase(productID: annualID)
        XCTAssertEqual(model.operation, .pending)
        XCTAssertEqual(model.entitlement, .freeCore)
        let pending = try XCTUnwrap(
            session.allTransactions().first(where: { $0.pendingAskToBuyConfirmation })
        )
        try session.declineAskToBuyTransaction(identifier: pending.identifier)
        session.askToBuyEnabled = false
        session.clearTransactions()

        let restoredPurchase = try await session.buyProduct(identifier: annualID)
        await model.restore()
        guard case .paidCoach = model.entitlement else {
            return XCTFail("Explicit restore must rebuild a verified paid entitlement")
        }
        XCTAssertEqual(model.operation, .succeeded(.restore))

        session.shouldEnterBillingRetryOnRenewal = true
        session.billingGracePeriodIsEnabled = true
        try session.forceRenewalOfSubscription(productIdentifier: annualID)
        await model.refresh()
        guard case .paidCoach(let graceExpiration, let billingState) = model.entitlement else {
            return XCTFail("A verified billing grace period must preserve Paid Coach")
        }
        XCTAssertEqual(billingState, .gracePeriod)
        XCTAssertNotNil(graceExpiration)
        let billingIssue = try XCTUnwrap(
            session.allTransactions().first(where: { $0.hasPurchaseIssue })
        )
        try session.resolveIssueForTransaction(identifier: billingIssue.identifier)
        session.shouldEnterBillingRetryOnRenewal = false
        session.billingGracePeriodIsEnabled = false
        await model.refresh()

        try session.forceRenewalOfSubscription(productIdentifier: annualID)
        await model.refresh()
        guard case .paidCoach = model.entitlement else {
            return XCTFail("A verified renewal must preserve Paid Coach")
        }

        let latestAnnual = try XCTUnwrap(
            session.allTransactions()
                .filter { $0.productIdentifier == annualID && !$0.pendingAskToBuyConfirmation }
                .max(by: { $0.purchaseDate < $1.purchaseDate })
        )
        try session.refundTransaction(identifier: latestAnnual.identifier)
        await model.refresh()
        XCTAssertEqual(model.entitlement, .freeCore)

        _ = restoredPurchase // Receipt anchor: proves restore used a real StoreKitTest transaction.
    }
}
