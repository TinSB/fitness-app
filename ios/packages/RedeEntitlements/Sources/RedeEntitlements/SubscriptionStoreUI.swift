#if canImport(StoreKit) && canImport(SwiftUI)
import StoreKit
import SwiftUI

/// Package-owned StoreKit merchandising surface. The app supplies only Rede's
/// marketing shell and validated release configuration; price, offer, renewal,
/// purchase, and restore controls remain Apple's localized StoreKit UI.
public struct RedeSubscriptionStoreView<MarketingContent: View>: View {
    private let configuration: SubscriptionConfiguration
    private let products: [SubscriptionProduct]
    private let marketingContent: MarketingContent

    public init(
        configuration: SubscriptionConfiguration,
        products: [SubscriptionProduct],
        @ViewBuilder marketingContent: () -> MarketingContent
    ) {
        self.configuration = configuration
        self.products = products
        self.marketingContent = marketingContent()
    }

    public var body: some View {
        if SubscriptionLaunchGate.evaluate(configuration: configuration, products: products) == .ready,
           let privacyURL = configuration.privacyPolicyURL,
           let termsURL = configuration.termsOfUseURL {
            SubscriptionStoreView(productIDs: configuration.productIDs) {
                marketingContent
            }
            .subscriptionStoreControlStyle(.prominentPicker)
            .storeButton(.visible, for: .restorePurchases)
            .subscriptionStorePolicyDestination(url: privacyURL, for: .privacyPolicy)
            .subscriptionStorePolicyDestination(url: termsURL, for: .termsOfService)
        }
    }
}

#if os(iOS)
import UIKit

/// Native Apple subscription-management sheet. The app resolves and passes the
/// foreground scene; this adapter never guesses global scene ownership.
@MainActor
public enum RedeSubscriptionManagement {
    public static func show(
        in scene: UIWindowScene,
        subscriptionGroupID: String? = nil
    ) async throws {
        do {
            if let subscriptionGroupID, !subscriptionGroupID.isEmpty {
                try await AppStore.showManageSubscriptions(
                    in: scene,
                    subscriptionGroupID: subscriptionGroupID
                )
            } else {
                try await AppStore.showManageSubscriptions(in: scene)
            }
        } catch {
            throw SubscriptionIssue.storeUnavailable
        }
    }
}
#endif
#endif
