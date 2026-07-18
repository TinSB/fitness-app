import Foundation

/// The only access levels in the first StoreKit slice.
public enum AccessTier: String, Equatable, Sendable {
    case freeCore
    case paidCoach
}

/// Billing states that still carry a verified Paid Coach entitlement.
public enum PaidBillingState: String, Equatable, Sendable {
    case active
    case gracePeriod
}

/// Stable, user-presentable failure categories. StoreKit errors never escape
/// the package and are never persisted in canonical training data.
public enum SubscriptionIssue: String, Error, Equatable, Sendable {
    case configurationInvalid
    case productsUnavailable
    case storeUnavailable
    case verificationFailed
    case unknown
}

/// UI-facing state. `unknown` is deliberately distinct from Free Core: it says
/// Rede could not verify paid access, while the access policy still guarantees
/// every 1.8 capability remains usable.
public enum EntitlementState: Equatable, Sendable {
    case checking
    case freeCore
    case paidCoach(expirationDate: Date?, billingState: PaidBillingState)
    case unknown(SubscriptionIssue)

    public var tier: AccessTier? {
        switch self {
        case .checking, .unknown:
            nil
        case .freeCore:
            .freeCore
        case .paidCoach:
            .paidCoach
        }
    }

    public var isVerifiedPaid: Bool {
        if case .paidCoach = self { return true }
        return false
    }
}

/// A provider can only return a resolved Apple truth. Loading and failure live
/// in `EntitlementState`, owned by the orchestration model.
public enum ResolvedEntitlement: Equatable, Sendable {
    case freeCore
    case paidCoach(expirationDate: Date?, billingState: PaidBillingState)

    public var state: EntitlementState {
        switch self {
        case .freeCore:
            .freeCore
        case .paidCoach(let expirationDate, let billingState):
            .paidCoach(expirationDate: expirationDate, billingState: billingState)
        }
    }
}

/// Feature code declares a requirement; it never checks product IDs or StoreKit
/// state directly. Existing Rede 1.8 features must all use `.freeCore`.
public enum AccessRequirement: Equatable, Sendable {
    case freeCore
    case paidCoach
}

public enum FeatureAccessPolicy {
    public static func allows(
        _ requirement: AccessRequirement,
        entitlement: EntitlementState,
        now: Date = Date()
    ) -> Bool {
        switch requirement {
        case .freeCore:
            return true
        case .paidCoach:
            guard case .paidCoach(let expirationDate, _) = entitlement else {
                return false
            }
            return expirationDate.map { $0 > now } ?? true
        }
    }
}

public enum SubscriptionPeriod: String, Equatable, Sendable {
    case monthly
    case annual
    case other
}

/// Localized product text comes from StoreKit. Callers must not synthesize or
/// hard-code prices, offers, or renewal claims.
public struct SubscriptionProduct: Equatable, Sendable, Identifiable {
    public let id: String
    public let displayName: String
    public let displayPrice: String
    public let period: SubscriptionPeriod
    public let subscriptionGroupID: String

    public init(
        id: String,
        displayName: String,
        displayPrice: String,
        period: SubscriptionPeriod,
        subscriptionGroupID: String
    ) {
        self.id = id
        self.displayName = displayName
        self.displayPrice = displayPrice
        self.period = period
        self.subscriptionGroupID = subscriptionGroupID
    }
}

public struct VerifiedSubscriptionTransaction: Sendable {
    public let transactionID: UInt64
    public let finish: @Sendable () async -> Void

    public init(
        transactionID: UInt64,
        finish: @escaping @Sendable () async -> Void
    ) {
        self.transactionID = transactionID
        self.finish = finish
    }
}

public enum PurchaseOutcome: Sendable {
    case purchased(VerifiedSubscriptionTransaction)
    case pending
    case userCancelled
}

/// A verified StoreKit transaction is acknowledged only after the model has
/// successfully rebuilt its entitlement projection. This closes the crash
/// window where finishing first could lose delivery.
public enum SubscriptionUpdate: Sendable {
    case verified(VerifiedSubscriptionTransaction)
    case unverified
}

public enum ProductCatalogState: Equatable, Sendable {
    case idle
    case loading
    case available([SubscriptionProduct])
    case unavailable(SubscriptionIssue)
}

public enum SubscriptionAction: Equatable, Sendable {
    case purchase
    case restore
}

public enum SubscriptionOperationState: Equatable, Sendable {
    case idle
    case purchasing
    case pending
    case restoring
    case succeeded(SubscriptionAction)
    case failed(SubscriptionIssue)
}
