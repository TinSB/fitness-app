import Foundation
import RedeEntitlements

/// App-owned subscription lifecycle/configuration boundary. Production purchase
/// presentation is fail-closed until App Store Connect IDs, policy URLs, and an
/// approved post-1.8 paid capability are all explicitly configured.
enum RedeSubscriptionRuntime {
    private enum Key {
        static let productIDs = "RedeSubscriptionProductIDs"
        static let privacyPolicyURL = "RedeSubscriptionPrivacyPolicyURL"
        static let termsOfUseURL = "RedeSubscriptionTermsOfUseURL"
        static let paidCapabilityReady = "RedeSubscriptionPaidCapabilityReady"
    }

    #if DEBUG
    static let testMonthlyProductID = "com.tinsab.rede.coach.monthly.test"
    static let testAnnualProductID = "com.tinsab.rede.coach.annual.test"
    #endif

    static func configuration(
        bundle: Bundle = .main,
        arguments: [String] = ProcessInfo.processInfo.arguments
    ) -> SubscriptionConfiguration {
        #if DEBUG
        if arguments.contains("-redeStoreKitTest") {
            return SubscriptionConfiguration(
                productIDs: [testMonthlyProductID, testAnnualProductID],
                privacyPolicyURL: URL(string: "https://rede.fit/privacy"),
                termsOfUseURL: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"),
                paidCapabilityIsReady: true
            )
        }
        #endif

        let info = bundle.infoDictionary ?? [:]
        let productIDs = (info[Key.productIDs] as? [String]) ?? []
        let privacyURL = (info[Key.privacyPolicyURL] as? String).flatMap(URL.init(string:))
        let termsURL = (info[Key.termsOfUseURL] as? String).flatMap(URL.init(string:))
        let paidCapabilityReady = (info[Key.paidCapabilityReady] as? NSNumber)?.boolValue ?? false
        return SubscriptionConfiguration(
            productIDs: productIDs,
            privacyPolicyURL: privacyURL,
            termsOfUseURL: termsURL,
            paidCapabilityIsReady: paidCapabilityReady
        )
    }

    @MainActor
    static func makeModel(
        configuration: SubscriptionConfiguration,
        arguments: [String] = ProcessInfo.processInfo.arguments
    ) -> SubscriptionModel {
        #if DEBUG
        if arguments.contains("-redePaidCoachActiveFixture") {
            // L3 Simulator entitlement fixture only: unlock an already-owned feature while the
            // production purchase launch gate remains disabled. No products or transactions exist.
            return SubscriptionModel(
                provider: PaidCoachActiveFixtureProvider(),
                configuration: configuration
            )
        }
        #endif
        return SubscriptionModel(
            provider: StoreKitSubscriptionProvider(productIDs: configuration.productIDs),
            configuration: configuration
        )
    }
}

#if DEBUG
private actor PaidCoachActiveFixtureProvider: SubscriptionProviding {
    nonisolated var transactionUpdates: AsyncStream<SubscriptionUpdate> {
        AsyncStream { continuation in continuation.finish() }
    }

    func products() async throws -> [SubscriptionProduct] { [] }

    func currentEntitlement() async throws -> ResolvedEntitlement {
        .paidCoach(expirationDate: nil, billingState: .active)
    }

    func purchase(productID: String) async throws -> PurchaseOutcome {
        throw SubscriptionIssue.configurationInvalid
    }

    func restore() async throws {
        throw SubscriptionIssue.configurationInvalid
    }
}
#endif
