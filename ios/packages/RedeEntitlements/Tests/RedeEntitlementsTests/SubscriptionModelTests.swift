import XCTest
@testable import RedeEntitlements

@MainActor
final class SubscriptionModelTests: XCTestCase {
    private let monthly = SubscriptionProduct(
        id: "rede.coach.monthly",
        displayName: "Rede Coach Monthly",
        displayPrice: "$4.99",
        period: .monthly,
        subscriptionGroupID: "coach"
    )
    private let annual = SubscriptionProduct(
        id: "rede.coach.annual",
        displayName: "Rede Coach Annual",
        displayPrice: "$39.99",
        period: .annual,
        subscriptionGroupID: "coach"
    )

    private var readyProducts: [SubscriptionProduct] { [monthly, annual] }

    private var readyConfiguration: SubscriptionConfiguration {
        SubscriptionConfiguration(
            productIDs: readyProducts.map(\.id),
            privacyPolicyURL: URL(string: "https://rede.fit/privacy")!,
            termsOfUseURL: URL(string: "https://rede.fit/terms")!,
            paidCapabilityIsReady: true
        )
    }

    func testDisabledProductionConfigShowsPreparingBeforeCatalogLoadsOrFails() async {
        let provider = FakeSubscriptionProvider()
        provider.productsResult = .failure(.productsUnavailable)
        let model = SubscriptionModel(provider: provider, configuration: .disabled)

        XCTAssertEqual(model.launchDecision, .blocked(.paidCapabilityNotReady))
        await model.start()
        XCTAssertEqual(model.catalog, .unavailable(.productsUnavailable))
        XCTAssertEqual(
            model.launchDecision,
            .blocked(.paidCapabilityNotReady),
            "An intentionally disabled product must stay in preparation, not look operationally broken"
        )
    }

    func testStartLoadsEntitlementAndCatalogIndependently() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.paidCoach(
            expirationDate: Date(timeIntervalSince1970: 2_000_000_000),
            billingState: .active
        ))
        provider.productsResult = .failure(.productsUnavailable)
        let model = SubscriptionModel(provider: provider)

        await model.start()

        XCTAssertEqual(
            model.entitlement,
            .paidCoach(expirationDate: Date(timeIntervalSince1970: 2_000_000_000), billingState: .active),
            "A catalog outage must not revoke a separately verified entitlement"
        )
        XCTAssertEqual(model.catalog, .unavailable(.productsUnavailable))
    }

    func testEntitlementFailureIsHonestButFreeCoreRemainsAvailable() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .failure(.storeUnavailable)
        provider.productsResult = .success([monthly])
        let model = SubscriptionModel(provider: provider)

        await model.start()

        XCTAssertEqual(model.entitlement, .unknown(.storeUnavailable))
        XCTAssertTrue(FeatureAccessPolicy.allows(.freeCore, entitlement: model.entitlement))
        XCTAssertEqual(model.catalog, .available([monthly]))
    }

    func testSuccessfulPurchaseRefreshesEntitlement() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.freeCore)
        provider.productsResult = .success(readyProducts)
        provider.purchaseResult = .success(.purchased(VerifiedSubscriptionTransaction(
            transactionID: 7,
            finish: { [weak provider] in provider?.deliveryEvents.append("finish:7") }
        )))
        let model = SubscriptionModel(provider: provider, configuration: readyConfiguration)
        await model.start()
        provider.trackDeliveryEvents = true

        provider.entitlementResult = .success(.paidCoach(expirationDate: nil, billingState: .active))
        await model.purchase(productID: monthly.id)

        XCTAssertEqual(model.entitlement, .paidCoach(expirationDate: nil, billingState: .active))
        XCTAssertEqual(model.operation, .succeeded(.purchase))
        XCTAssertEqual(provider.purchasedProductIDs, [monthly.id])
        XCTAssertEqual(provider.deliveryEvents, ["refresh", "finish:7"])
    }

    func testPendingAndCancellationAreNotReportedAsFailures() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.freeCore)
        provider.productsResult = .success(readyProducts)
        let model = SubscriptionModel(provider: provider, configuration: readyConfiguration)
        await model.start()

        provider.purchaseResult = .success(.pending)
        await model.purchase(productID: monthly.id)
        XCTAssertEqual(model.operation, .pending)
        XCTAssertEqual(model.entitlement, .freeCore)

        provider.purchaseResult = .success(.userCancelled)
        await model.purchase(productID: monthly.id)
        XCTAssertEqual(model.operation, .idle)
        XCTAssertEqual(model.entitlement, .freeCore)
    }

    func testPurchaseEntryPointFailsClosedWhenLaunchGateIsBlocked() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.freeCore)
        provider.productsResult = .success(readyProducts)
        provider.purchaseResult = .success(.purchased(provider.transaction(id: 6)))
        let model = SubscriptionModel(provider: provider)
        await model.start()

        await model.purchase(productID: monthly.id)

        XCTAssertEqual(model.operation, .failed(.configurationInvalid))
        XCTAssertEqual(provider.purchasedProductIDs, [])
        XCTAssertEqual(model.entitlement, .freeCore)
    }

    func testPurchaseVerificationFailureImmediatelyRemovesPreviouslyPaidAccess() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.paidCoach(expirationDate: nil, billingState: .active))
        provider.productsResult = .success(readyProducts)
        provider.purchaseResult = .failure(.verificationFailed)
        let model = SubscriptionModel(provider: provider, configuration: readyConfiguration)
        await model.start()

        await model.purchase(productID: monthly.id)

        XCTAssertEqual(model.operation, .failed(.verificationFailed))
        XCTAssertEqual(model.entitlement, .unknown(.verificationFailed))
        XCTAssertFalse(FeatureAccessPolicy.allows(.paidCoach, entitlement: model.entitlement))
    }

    func testRestoreFailureDoesNotDowngradeKnownPaidEntitlement() async {
        let provider = FakeSubscriptionProvider()
        let paid = ResolvedEntitlement.paidCoach(expirationDate: nil, billingState: .gracePeriod)
        provider.entitlementResult = .success(paid)
        provider.productsResult = .success([monthly])
        provider.restoreResult = .failure(.storeUnavailable)
        let model = SubscriptionModel(provider: provider)
        await model.start()

        await model.restore()

        XCTAssertEqual(model.entitlement, paid.state)
        XCTAssertEqual(model.operation, .failed(.storeUnavailable))
        XCTAssertEqual(provider.restoreCallCount, 1)
    }

    func testRestoreDoesNotReportSuccessWhenEntitlementRefreshFails() async {
        let provider = FakeSubscriptionProvider()
        let paid = ResolvedEntitlement.paidCoach(expirationDate: nil, billingState: .active)
        provider.entitlementResult = .success(paid)
        provider.productsResult = .success([monthly])
        let model = SubscriptionModel(provider: provider)
        await model.start()

        provider.entitlementResult = .failure(.storeUnavailable)
        await model.restore()

        XCTAssertEqual(model.entitlement, .unknown(.storeUnavailable),
                       "A failed re-verification must fail closed without relabeling the user Free")
        XCTAssertEqual(model.operation, .failed(.storeUnavailable),
                       "Restore must not claim success until access has been re-verified")
        XCTAssertEqual(provider.restoreCallCount, 1)
    }

    func testTransactionUpdateRefreshesEntitlement() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.freeCore)
        provider.productsResult = .success([monthly])
        let model = SubscriptionModel(provider: provider)
        await model.start()

        provider.entitlementResult = .success(.paidCoach(expirationDate: nil, billingState: .active))
        provider.sendVerifiedTransactionUpdate(id: 42)

        for _ in 0..<50 where provider.updateEvents != ["refresh", "finish:42"] {
            await Task.yield()
        }
        XCTAssertEqual(model.entitlement, .paidCoach(expirationDate: nil, billingState: .active))
        XCTAssertEqual(provider.updateEvents, ["refresh", "finish:42"],
                       "Verified access must be projected before StoreKit transaction.finish()")
    }

    func testUnverifiedTransactionUpdateNeverFinishesOrUnlocksPaidCoach() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.freeCore)
        provider.productsResult = .success([monthly])
        let model = SubscriptionModel(provider: provider)
        await model.start()
        provider.updateEvents = []

        provider.sendUnverifiedTransactionUpdate()

        for _ in 0..<20 where model.entitlement != .unknown(.verificationFailed) {
            await Task.yield()
        }
        XCTAssertEqual(model.entitlement, .unknown(.verificationFailed))
        XCTAssertFalse(FeatureAccessPolicy.allows(.paidCoach, entitlement: model.entitlement))
        XCTAssertTrue(provider.updateEvents.isEmpty, "Unverified transactions must never be finished")
    }

    func testUnverifiedUpdateImmediatelyRemovesPreviouslyPaidAccess() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.paidCoach(expirationDate: nil, billingState: .active))
        provider.productsResult = .success(readyProducts)
        let model = SubscriptionModel(provider: provider, configuration: readyConfiguration)
        await model.start()

        provider.sendUnverifiedTransactionUpdate()

        for _ in 0..<20 where model.entitlement != .unknown(.verificationFailed) {
            await Task.yield()
        }
        XCTAssertEqual(model.entitlement, .unknown(.verificationFailed))
        XCTAssertFalse(FeatureAccessPolicy.allows(.paidCoach, entitlement: model.entitlement))
    }

    func testSameTransactionFromPurchaseAndUpdatesIsFinishedOnce() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.freeCore)
        provider.productsResult = .success(readyProducts)
        provider.purchaseResult = .success(.purchased(provider.transaction(id: 77)))
        let model = SubscriptionModel(provider: provider, configuration: readyConfiguration)
        await model.start()

        provider.entitlementResult = .success(.paidCoach(expirationDate: nil, billingState: .active))
        await model.purchase(productID: monthly.id)
        provider.sendVerifiedTransactionUpdate(id: 77)

        for _ in 0..<50 where provider.updateEvents.first == "update" {
            await Task.yield()
        }
        XCTAssertEqual(provider.finishedTransactionIDs, [77],
                       "PurchaseResult and Transaction.updates may carry the same transaction")
    }

    func testSameTransactionUpdateStillRebuildsEntitlementAfterRevocation() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.freeCore)
        provider.productsResult = .success(readyProducts)
        provider.purchaseResult = .success(.purchased(provider.transaction(id: 88)))
        let model = SubscriptionModel(provider: provider, configuration: readyConfiguration)
        await model.start()

        provider.entitlementResult = .success(.paidCoach(expirationDate: nil, billingState: .active))
        await model.purchase(productID: monthly.id)
        XCTAssertTrue(model.entitlement.isVerifiedPaid)

        // StoreKit can publish a new signed view of the same transaction ID
        // after refund/revocation. Delivery acknowledgement is idempotent, but
        // entitlement projection must still be rebuilt for every update.
        provider.entitlementResult = .success(.freeCore)
        provider.sendVerifiedTransactionUpdate(id: 88)

        for _ in 0..<50 where model.entitlement != .freeCore {
            await Task.yield()
        }
        XCTAssertEqual(model.entitlement, .freeCore)
        XCTAssertEqual(provider.finishedTransactionIDs, [88],
                       "A revoked transaction must refresh access without being finished twice")
    }

    func testOlderEntitlementQueryCannotOverwriteNewerRevocationResult() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.freeCore)
        provider.productsResult = .success(readyProducts)
        let model = SubscriptionModel(provider: provider, configuration: readyConfiguration)
        await model.start()

        let race = EntitlementRaceController()
        provider.entitlementHandler = { try await race.nextResult() }
        let olderRefresh = Task { await model.refresh() }
        await race.waitUntilFirstQueryStarts()

        await model.refresh()
        await race.completeFirstQueryWithPaid()
        await olderRefresh.value

        XCTAssertEqual(model.entitlement, .freeCore,
                       "A stale paid query must never overwrite a newer revocation result")
    }

    func testStaleSuccessfulDeliveryDoesNotFinishAfterNewerRefreshFails() async {
        let provider = FakeSubscriptionProvider()
        provider.entitlementResult = .success(.freeCore)
        provider.productsResult = .success(readyProducts)
        provider.purchaseResult = .success(.purchased(provider.transaction(id: 99)))
        let model = SubscriptionModel(provider: provider, configuration: readyConfiguration)
        await model.start()

        let race = EntitlementRaceController(secondResult: .failure(.storeUnavailable))
        provider.entitlementHandler = { try await race.nextResult() }
        let purchase = Task { await model.purchase(productID: monthly.id) }
        await race.waitUntilFirstQueryStarts()

        await model.refresh()
        await race.completeFirstQueryWithPaid()
        await purchase.value

        XCTAssertEqual(model.entitlement, .unknown(.storeUnavailable))
        XCTAssertEqual(model.operation, .failed(.storeUnavailable))
        XCTAssertEqual(provider.finishedTransactionIDs, [],
                       "A transaction must not finish when its own refresh result was discarded as stale")
    }

    func testMixedVerifiedAndUnverifiedCurrentEntitlementsFailClosed() throws {
        let paid = ResolvedEntitlement.paidCoach(
            expirationDate: Date(timeIntervalSince1970: 2_000_000_000),
            billingState: .active
        )

        XCTAssertThrowsError(try StoreKitSubscriptionProvider.finalizeCurrentEntitlement(
            newest: paid,
            sawUnverified: true
        )) { error in
            XCTAssertEqual(error as? SubscriptionIssue, .verificationFailed)
        }
    }

    func testVerifiedExpirationSchedulesAutomaticReverification() async {
        let provider = FakeSubscriptionProvider()
        let expiration = Date(timeIntervalSince1970: 2_000)
        provider.entitlementResult = .success(.paidCoach(
            expirationDate: expiration,
            billingState: .active
        ))
        provider.productsResult = .success(readyProducts)
        let wake = ExpirationWake()
        let model = SubscriptionModel(
            provider: provider,
            configuration: readyConfiguration,
            now: { Date(timeIntervalSince1970: 1_000) },
            sleepUntil: { date in try await wake.sleep(until: date) }
        )
        await model.start()
        await wake.waitUntilSleeping()
        provider.entitlementResult = .success(.freeCore)

        await wake.fire()
        for _ in 0..<50 where model.entitlement != .freeCore {
            await Task.yield()
        }

        let requestedDate = await wake.requestedDate()
        XCTAssertEqual(requestedDate, expiration)
        XCTAssertEqual(model.entitlement, .freeCore)
    }
}

private final class FakeSubscriptionProvider: SubscriptionProviding, @unchecked Sendable {
    var productsResult: Result<[SubscriptionProduct], SubscriptionIssue> = .success([])
    var entitlementResult: Result<ResolvedEntitlement, SubscriptionIssue> = .success(.freeCore)
    var purchaseResult: Result<PurchaseOutcome, SubscriptionIssue> = .success(.userCancelled)
    var restoreResult: Result<Void, SubscriptionIssue> = .success(())
    private(set) var purchasedProductIDs: [String] = []
    private(set) var restoreCallCount = 0
    var updateEvents: [String] = []
    var deliveryEvents: [String] = []
    var trackDeliveryEvents = false
    var finishedTransactionIDs: [UInt64] = []
    var entitlementHandler: (@Sendable () async throws -> ResolvedEntitlement)?

    private let stream: AsyncStream<SubscriptionUpdate>
    private let continuation: AsyncStream<SubscriptionUpdate>.Continuation

    init() {
        var captured: AsyncStream<SubscriptionUpdate>.Continuation!
        stream = AsyncStream { captured = $0 }
        continuation = captured
    }

    var transactionUpdates: AsyncStream<SubscriptionUpdate> { stream }

    func products() async throws -> [SubscriptionProduct] {
        try productsResult.get()
    }

    func currentEntitlement() async throws -> ResolvedEntitlement {
        if trackDeliveryEvents {
            deliveryEvents.append("refresh")
        }
        if !updateEvents.isEmpty || purchasedProductIDs.count > 0 {
            updateEvents.append("refresh")
        }
        if let entitlementHandler { return try await entitlementHandler() }
        return try entitlementResult.get()
    }

    func purchase(productID: String) async throws -> PurchaseOutcome {
        purchasedProductIDs.append(productID)
        return try purchaseResult.get()
    }

    func restore() async throws {
        restoreCallCount += 1
        try restoreResult.get()
    }

    func sendVerifiedTransactionUpdate(id: UInt64) {
        updateEvents = ["update"]
        continuation.yield(.verified(VerifiedSubscriptionTransaction(transactionID: id, finish: { [weak self] in
            self?.updateEvents.removeFirst()
            self?.updateEvents.append("finish:\(id)")
            self?.finishedTransactionIDs.append(id)
        })))
    }

    func sendUnverifiedTransactionUpdate() {
        continuation.yield(.unverified)
    }

    func transaction(id: UInt64) -> VerifiedSubscriptionTransaction {
        VerifiedSubscriptionTransaction(transactionID: id, finish: { [weak self] in
            self?.finishedTransactionIDs.append(id)
        })
    }
}

private actor EntitlementRaceController {
    private let secondResult: Result<ResolvedEntitlement, SubscriptionIssue>
    private var queryCount = 0
    private var firstResultContinuation: CheckedContinuation<ResolvedEntitlement, Error>?
    private var firstStartedContinuations: [CheckedContinuation<Void, Never>] = []

    init(secondResult: Result<ResolvedEntitlement, SubscriptionIssue> = .success(.freeCore)) {
        self.secondResult = secondResult
    }

    func nextResult() async throws -> ResolvedEntitlement {
        queryCount += 1
        if queryCount == 1 {
            let waiters = firstStartedContinuations
            firstStartedContinuations.removeAll()
            waiters.forEach { $0.resume() }
            return try await withCheckedThrowingContinuation { firstResultContinuation = $0 }
        }
        return try secondResult.get()
    }

    func waitUntilFirstQueryStarts() async {
        if queryCount > 0 { return }
        await withCheckedContinuation { firstStartedContinuations.append($0) }
    }

    func completeFirstQueryWithPaid() {
        firstResultContinuation?.resume(returning: .paidCoach(
            expirationDate: nil,
            billingState: .active
        ))
        firstResultContinuation = nil
    }
}

private actor ExpirationWake {
    private var requested: Date?
    private var sleepContinuation: CheckedContinuation<Void, Error>?
    private var sleepingContinuations: [CheckedContinuation<Void, Never>] = []

    func sleep(until date: Date) async throws {
        requested = date
        let waiters = sleepingContinuations
        sleepingContinuations.removeAll()
        waiters.forEach { $0.resume() }
        try await withCheckedThrowingContinuation { sleepContinuation = $0 }
    }

    func waitUntilSleeping() async {
        if requested != nil { return }
        await withCheckedContinuation { sleepingContinuations.append($0) }
    }

    func fire() {
        sleepContinuation?.resume()
        sleepContinuation = nil
    }

    func requestedDate() -> Date? { requested }
}
