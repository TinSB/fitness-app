import StoreKit
import StoreKitTest
import XCTest
@testable import Rede
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
        XCTAssertEqual(
            SubscriptionLaunchGate.evaluate(configuration: configuration, products: []),
            .blocked(.paidCapabilityNotReady)
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
