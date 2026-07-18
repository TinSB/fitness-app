import Foundation

/// Release/admin configuration. Product IDs and policy URLs are injected by the
/// app; they are intentionally not architecture constants.
public struct SubscriptionConfiguration: Equatable, Sendable {
    public let productIDs: [String]
    public let privacyPolicyURL: URL?
    public let termsOfUseURL: URL?
    public let paidCapabilityIsReady: Bool

    public init(
        productIDs: [String],
        privacyPolicyURL: URL?,
        termsOfUseURL: URL?,
        paidCapabilityIsReady: Bool
    ) {
        self.productIDs = productIDs
        self.privacyPolicyURL = privacyPolicyURL
        self.termsOfUseURL = termsOfUseURL
        self.paidCapabilityIsReady = paidCapabilityIsReady
    }

    public static let disabled = SubscriptionConfiguration(
        productIDs: [],
        privacyPolicyURL: nil,
        termsOfUseURL: nil,
        paidCapabilityIsReady: false
    )
}

public enum SubscriptionLaunchBlocker: Equatable, Sendable {
    case paidCapabilityNotReady
    case missingPolicyLinks
    case invalidPolicyLinks
    case catalogMismatch
}

public enum SubscriptionLaunchDecision: Equatable, Sendable {
    case ready
    case blocked(SubscriptionLaunchBlocker)
}

/// A single fail-closed launch gate for the purchase surface. Entitlement
/// verification still runs when this gate is blocked so existing customers can
/// retain access; only new purchase presentation is disabled.
public enum SubscriptionLaunchGate {
    public static func evaluate(
        configuration: SubscriptionConfiguration,
        products: [SubscriptionProduct]
    ) -> SubscriptionLaunchDecision {
        guard configuration.paidCapabilityIsReady else {
            return .blocked(.paidCapabilityNotReady)
        }
        guard let privacy = configuration.privacyPolicyURL,
              let terms = configuration.termsOfUseURL else {
            return .blocked(.missingPolicyLinks)
        }
        guard isSecureWebURL(privacy), isSecureWebURL(terms) else {
            return .blocked(.invalidPolicyLinks)
        }

        let configuredIDs = Set(configuration.productIDs)
        let returnedIDs = Set(products.map(\.id))
        let groups = Set(products.map(\.subscriptionGroupID).filter { !$0.isEmpty })
        let periods = Set(products.map(\.period))
        let hasLocalizedPresentation = products.allSatisfy {
            !$0.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !$0.displayPrice.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }

        guard configuration.productIDs.count == 2,
              configuredIDs.count == 2,
              products.count == 2,
              returnedIDs == configuredIDs,
              groups.count == 1,
              periods == Set([.monthly, .annual]),
              hasLocalizedPresentation else {
            return .blocked(.catalogMismatch)
        }
        return .ready
    }

    private static func isSecureWebURL(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https" && !(url.host ?? "").isEmpty
    }
}
