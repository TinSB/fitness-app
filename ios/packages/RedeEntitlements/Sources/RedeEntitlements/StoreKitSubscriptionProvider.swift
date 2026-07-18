#if canImport(StoreKit)
import Foundation
import StoreKit

/// The only StoreKit 2 adapter in Rede. Product IDs are injected release
/// configuration; this type never reads or writes canonical app data.
public actor StoreKitSubscriptionProvider: SubscriptionProviding {
    struct StatusAccessCandidate: Equatable, Sendable {
        let expirationDate: Date?
        let billingState: PaidBillingState
    }

    enum ExpiredStatusEvidence: Equatable, Sendable {
        case verified(StatusAccessCandidate?)
        case unverified
        case unavailable
    }

    public nonisolated let transactionUpdates: AsyncStream<SubscriptionUpdate>

    private let productIDs: Set<String>
    private var productsByID: [String: Product] = [:]

    public init(productIDs: [String]) {
        let configuredIDs = Set(productIDs.filter { !$0.isEmpty })
        self.productIDs = configuredIDs
        self.transactionUpdates = Self.makeUpdateStream(productIDs: configuredIDs)
    }

    public func products() async throws -> [SubscriptionProduct] {
        guard !productIDs.isEmpty else { throw SubscriptionIssue.configurationInvalid }
        do {
            let loaded = try await Product.products(for: productIDs)
            for product in loaded { productsByID[product.id] = product }
            return loaded
                .map(Self.summary)
                .sorted { Self.periodRank($0.period) < Self.periodRank($1.period) }
        } catch let issue as SubscriptionIssue {
            throw issue
        } catch {
            throw SubscriptionIssue.productsUnavailable
        }
    }

    public func currentEntitlement() async throws -> ResolvedEntitlement {
        guard !productIDs.isEmpty else { return .freeCore }
        var newest: (expirationDate: Date?, billingState: PaidBillingState)?
        var sawUnverified = false
        let now = Date()

        for await result in Transaction.currentEntitlements {
            switch result {
            case .unverified(let transaction, _):
                if productIDs.contains(transaction.productID) { sawUnverified = true }
            case .verified(let transaction):
                guard productIDs.contains(transaction.productID),
                      transaction.revocationDate == nil else { continue }
                guard let candidate = try await entitlementDetails(for: transaction, now: now) else {
                    continue
                }
                if let current = newest {
                    let currentDate = current.expirationDate ?? .distantFuture
                    let candidateDate = candidate.expirationDate ?? .distantFuture
                    if candidateDate > currentDate { newest = candidate }
                } else {
                    newest = candidate
                }
            }
        }

        return try Self.finalizeCurrentEntitlement(
            newest: newest.map {
                .paidCoach(expirationDate: $0.expirationDate, billingState: $0.billingState)
            },
            sawUnverified: sawUnverified
        )
    }

    public func purchase(productID: String) async throws -> PurchaseOutcome {
        guard self.productIDs.contains(productID) else {
            throw SubscriptionIssue.configurationInvalid
        }
        do {
            let product = try await storeProduct(for: productID)
            switch try await product.purchase() {
            case .pending:
                return .pending
            case .userCancelled:
                return .userCancelled
            case .success(let verification):
                switch verification {
                case .unverified:
                    throw SubscriptionIssue.verificationFailed
                case .verified(let transaction):
                    guard self.productIDs.contains(transaction.productID),
                          transaction.revocationDate == nil else {
                        throw SubscriptionIssue.verificationFailed
                    }
                    return .purchased(VerifiedSubscriptionTransaction(
                        transactionID: transaction.id,
                        finish: { await transaction.finish() }
                    ))
                }
            @unknown default:
                throw SubscriptionIssue.unknown
            }
        } catch StoreKitError.userCancelled {
            return .userCancelled
        } catch let issue as SubscriptionIssue {
            throw issue
        } catch {
            throw SubscriptionIssue.storeUnavailable
        }
    }

    public func restore() async throws {
        do {
            try await AppStore.sync()
        } catch {
            throw SubscriptionIssue.storeUnavailable
        }
    }

    private func storeProduct(for productID: String) async throws -> Product {
        if let cached = productsByID[productID] { return cached }
        let loaded = try await Product.products(for: [productID])
        guard let product = loaded.first(where: { $0.id == productID }) else {
            throw SubscriptionIssue.productsUnavailable
        }
        productsByID[product.id] = product
        return product
    }

    /// `currentEntitlements` is the access truth. An unexpired verified
    /// transaction is active without a second network-dependent status read.
    /// Once its original expiration passes, a fresh verified subscription
    /// status must prove continued active/grace access; unavailable or
    /// unverified status is honest unknown, never Free Core.
    private func entitlementDetails(
        for transaction: Transaction,
        now: Date
    ) async throws -> (expirationDate: Date?, billingState: PaidBillingState)? {
        if let expiration = transaction.expirationDate, expiration <= now {
            return try await verifiedStatusAccess(for: transaction, now: now)
        }
        return (transaction.expirationDate, .active)
    }

    private func verifiedStatusAccess(
        for transaction: Transaction,
        now: Date
    ) async throws -> (expirationDate: Date?, billingState: PaidBillingState)? {
        do {
            let product = try await storeProduct(for: transaction.productID)
            guard let subscription = product.subscription else {
                throw SubscriptionIssue.configurationInvalid
            }
            let statuses = try await subscription.status
            var newest: StatusAccessCandidate?
            var sawUnverified = false

            for status in statuses {
                switch status.transaction {
                case .unverified(let statusTransaction, _):
                    if productIDs.contains(statusTransaction.productID) {
                        sawUnverified = true
                    }
                case .verified(let statusTransaction):
                    guard productIDs.contains(statusTransaction.productID),
                          statusTransaction.revocationDate == nil else { continue }

                    let candidate: StatusAccessCandidate?
                    switch status.state {
                    case .subscribed:
                        if let expiration = statusTransaction.expirationDate,
                           expiration <= now {
                            candidate = nil
                        } else {
                            candidate = StatusAccessCandidate(
                                expirationDate: statusTransaction.expirationDate,
                                billingState: .active
                            )
                        }
                    case .inGracePeriod:
                        switch status.renewalInfo {
                        case .unverified:
                            sawUnverified = true
                            candidate = nil
                        case .verified(let renewalInfo):
                            guard let expiration = renewalInfo.gracePeriodExpirationDate else {
                                throw SubscriptionIssue.verificationFailed
                            }
                            candidate = expiration > now
                                ? StatusAccessCandidate(
                                    expirationDate: expiration,
                                    billingState: .gracePeriod
                                )
                                : nil
                        }
                    default:
                        candidate = nil
                    }

                    if let candidate {
                        let candidateDate = candidate.expirationDate ?? .distantFuture
                        let newestDate = newest.map {
                            $0.expirationDate ?? .distantFuture
                        } ?? .distantPast
                        if newest == nil || candidateDate > newestDate {
                            newest = candidate
                        }
                    }
                }
            }

            let evidence: ExpiredStatusEvidence = sawUnverified
                ? .unverified
                : .verified(newest)
            return try Self.resolveExpiredStatusEvidence(evidence).map {
                ($0.expirationDate, $0.billingState)
            }
        } catch let issue as SubscriptionIssue {
            throw issue
        } catch {
            return try Self.resolveExpiredStatusEvidence(.unavailable).map {
                ($0.expirationDate, $0.billingState)
            }
        }
    }

    /// Pure reduction seam for an expired transaction's secondary status read.
    /// This keeps network/read failure and unverified evidence distinguishable
    /// from a verified "no access" result, even when StoreKitTest is unavailable.
    nonisolated static func resolveExpiredStatusEvidence(
        _ evidence: ExpiredStatusEvidence
    ) throws -> StatusAccessCandidate? {
        switch evidence {
        case .verified(let candidate):
            return candidate
        case .unverified:
            throw SubscriptionIssue.verificationFailed
        case .unavailable:
            throw SubscriptionIssue.storeUnavailable
        }
    }

    /// Relevant unverified observations dominate a simultaneous verified
    /// candidate. The caller can retry, but must never choose the optimistic
    /// result from a mixed trust set.
    nonisolated static func finalizeCurrentEntitlement(
        newest: ResolvedEntitlement?,
        sawUnverified: Bool
    ) throws -> ResolvedEntitlement {
        if sawUnverified { throw SubscriptionIssue.verificationFailed }
        return newest ?? .freeCore
    }

    private nonisolated static func makeUpdateStream(
        productIDs: Set<String>
    ) -> AsyncStream<SubscriptionUpdate> {
        AsyncStream { continuation in
            let task = Task {
                for await result in Transaction.updates {
                    guard !Task.isCancelled else { break }
                    switch result {
                    case .unverified(let transaction, _):
                        guard productIDs.contains(transaction.productID) else { continue }
                        continuation.yield(.unverified)
                    case .verified(let transaction):
                        guard productIDs.contains(transaction.productID) else { continue }
                        continuation.yield(.verified(VerifiedSubscriptionTransaction(
                            transactionID: transaction.id,
                            finish: { await transaction.finish() }
                        )))
                    }
                }
                continuation.finish()
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }

    private nonisolated static func summary(_ product: Product) -> SubscriptionProduct {
        let info = product.subscription
        return SubscriptionProduct(
            id: product.id,
            displayName: product.displayName,
            displayPrice: product.displayPrice,
            period: info.map { period($0.subscriptionPeriod) } ?? .other,
            subscriptionGroupID: info?.subscriptionGroupID ?? ""
        )
    }

    private nonisolated static func period(_ period: Product.SubscriptionPeriod) -> SubscriptionPeriod {
        switch (period.unit, period.value) {
        case (.month, 1): .monthly
        case (.year, 1): .annual
        default: .other
        }
    }

    private nonisolated static func periodRank(_ period: SubscriptionPeriod) -> Int {
        switch period {
        case .monthly: 0
        case .annual: 1
        case .other: 2
        }
    }
}
#endif
