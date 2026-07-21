import Foundation
import Observation

/// StoreKit is hidden behind this seam. Tests and previews use deterministic
/// fakes; the production adapter is the only implementation that imports
/// StoreKit.
public protocol SubscriptionProviding: Sendable {
    var transactionUpdates: AsyncStream<SubscriptionUpdate> { get }
    func products() async throws -> [SubscriptionProduct]
    func currentEntitlement() async throws -> ResolvedEntitlement
    func purchase(productID: String) async throws -> PurchaseOutcome
    func restore() async throws
}

@MainActor
@Observable
public final class SubscriptionModel {
    public private(set) var entitlement: EntitlementState = .checking
    public private(set) var catalog: ProductCatalogState = .idle
    public private(set) var operation: SubscriptionOperationState = .idle
    public private(set) var entitlementIssue: SubscriptionIssue?
    public let configuration: SubscriptionConfiguration

    @ObservationIgnored private let provider: any SubscriptionProviding
    @ObservationIgnored private let now: @Sendable () -> Date
    @ObservationIgnored private let sleepUntil: @Sendable (Date) async throws -> Void
    @ObservationIgnored private var updatesTask: Task<Void, Never>?
    @ObservationIgnored private var expirationTask: Task<Void, Never>?
    @ObservationIgnored private var started = false
    @ObservationIgnored private var deliveredTransactionIDs: Set<UInt64> = []
    @ObservationIgnored private var entitlementRefreshGeneration: UInt64 = 0

    public convenience init(
        provider: any SubscriptionProviding,
        configuration: SubscriptionConfiguration = .disabled
    ) {
        self.init(
            provider: provider,
            configuration: configuration,
            now: { Date() },
            sleepUntil: { date in try await Self.defaultSleep(until: date) }
        )
    }

    init(
        provider: any SubscriptionProviding,
        configuration: SubscriptionConfiguration,
        now: @escaping @Sendable () -> Date,
        sleepUntil: @escaping @Sendable (Date) async throws -> Void
    ) {
        self.provider = provider
        self.configuration = configuration
        self.now = now
        self.sleepUntil = sleepUntil
    }

    public var launchDecision: SubscriptionLaunchDecision {
        guard configuration.paidCapabilityIsReady else {
            return .blocked(.paidCapabilityNotReady)
        }
        guard case .available(let products) = catalog else {
            return .blocked(.catalogMismatch)
        }
        return SubscriptionLaunchGate.evaluate(
            configuration: configuration,
            products: products
        )
    }

    deinit {
        updatesTask?.cancel()
        expirationTask?.cancel()
    }

    /// Idempotent process-lifetime start. The listener is installed before the
    /// first reads so a transaction update cannot fall into a launch race.
    public func start() async {
        if !started {
            started = true
            let updates = provider.transactionUpdates
            updatesTask = Task { [weak self] in
                for await update in updates {
                    guard !Task.isCancelled else { return }
                    switch update {
                    case .unverified:
                        self?.handleUnverifiedUpdate()
                    case .verified(let transaction):
                        _ = await self?.deliver(transaction)
                    }
                }
            }
        }
        _ = await refreshEntitlement(showChecking: true)
        await loadProducts()
    }

    public func refresh() async {
        _ = await refreshEntitlement(showChecking: !entitlement.isVerifiedPaid)
        await loadProducts()
    }

    public func purchase(productID: String) async {
        guard launchDecision == .ready,
              configuration.productIDs.contains(productID) else {
            operation = .failed(.configurationInvalid)
            return
        }
        operation = .purchasing
        do {
            switch try await provider.purchase(productID: productID) {
            case .purchased(let transaction):
                guard await deliver(transaction) else {
                    operation = .failed(entitlementIssue ?? .verificationFailed)
                    return
                }
                operation = .succeeded(.purchase)
            case .pending:
                operation = .pending
            case .userCancelled:
                operation = .idle
            }
        } catch {
            let mapped = issue(from: error)
            if mapped == .verificationFailed {
                markEntitlementUnknown(mapped)
            }
            operation = .failed(mapped)
        }
    }

    /// Explicit user action only. A restore failure never mutates the last
    /// verified entitlement.
    public func restore() async {
        operation = .restoring
        do {
            try await provider.restore()
            guard await refreshEntitlement(showChecking: false) else {
                operation = .failed(entitlementIssue ?? .verificationFailed)
                return
            }
            operation = .succeeded(.restore)
        } catch {
            operation = .failed(issue(from: error))
        }
    }

    public func clearOperationNotice() {
        operation = .idle
    }

    private func loadProducts() async {
        catalog = .loading
        do {
            catalog = .available(try await provider.products())
        } catch {
            catalog = .unavailable(issue(from: error))
        }
    }

    @discardableResult
    private func refreshEntitlement(showChecking: Bool) async -> Bool {
        entitlementRefreshGeneration &+= 1
        let generation = entitlementRefreshGeneration
        if showChecking { entitlement = .checking }
        do {
            let resolved = try await provider.currentEntitlement().state
            // A newer refresh started while this query was suspended. Its result
            // owns state; this stale query did not project access and therefore
            // must not authorize transaction.finish().
            guard generation == entitlementRefreshGeneration else { return false }
            apply(resolved)
            entitlementIssue = nil
            return true
        } catch {
            guard generation == entitlementRefreshGeneration else { return false }
            let mapped = issue(from: error)
            entitlementIssue = mapped
            apply(.unknown(mapped))
            return false
        }
    }

    private func handleUnverifiedUpdate() {
        markEntitlementUnknown(.verificationFailed)
    }

    private func markEntitlementUnknown(_ issue: SubscriptionIssue) {
        // Invalidate any older in-flight query so it cannot restore paid access
        // after this newer verification failure was observed.
        entitlementRefreshGeneration &+= 1
        entitlementIssue = issue
        apply(.unknown(issue))
    }

    private func deliver(_ transaction: VerifiedSubscriptionTransaction) async -> Bool {
        // Every signed update rebuilds access, even when it carries a transaction
        // ID already acknowledged after purchase. Refund/revocation can publish a
        // newer view of that same ID and must be able to remove paid access.
        guard await refreshEntitlement(showChecking: false) else {
            return false
        }
        // Insert before suspension at finish() so a concurrent duplicate from
        // PurchaseResult / Transaction.updates cannot be acknowledged twice.
        if deliveredTransactionIDs.insert(transaction.transactionID).inserted {
            await transaction.finish()
        }
        return true
    }

    private func issue(from error: Error) -> SubscriptionIssue {
        (error as? SubscriptionIssue) ?? .unknown
    }

    private func apply(_ state: EntitlementState) {
        entitlement = state
        expirationTask?.cancel()
        expirationTask = nil

        guard case .paidCoach(let expirationDate?, _) = state,
              expirationDate > now() else { return }
        let sleepUntil = self.sleepUntil
        expirationTask = Task { [weak self] in
            do {
                try await sleepUntil(expirationDate)
            } catch {
                return
            }
            guard !Task.isCancelled else { return }
            _ = await self?.refreshEntitlement(showChecking: false)
        }
    }

    private nonisolated static func defaultSleep(until date: Date) async throws {
        let interval = date.timeIntervalSinceNow
        guard interval > 0 else { return }
        let nanoseconds = UInt64(min(interval, Double(UInt64.max) / 1_000_000_000) * 1_000_000_000)
        try await Task.sleep(nanoseconds: nanoseconds)
    }
}
