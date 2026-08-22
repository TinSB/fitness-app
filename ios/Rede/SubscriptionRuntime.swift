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
        // 购买页家族的视觉验收夹具（2026-08-20）。存在的理由很具体：`.store` 与 `unknown × 商店就绪`
        // 这两格都要求商品目录非空，而 SKTestSession 在本机 iOS 26.5 运行时恒返回空目录
        //（开闸 checklist ① 的 blocker，已证与项目配置无关），simctl 又挂不上 .storekit 配置——
        // 没有这个夹具，checklist ⑦ 的两处修复和 Coach 页能力清单就永远只能靠读代码验收。
        // 只造目录与权益两个读值：购买动作照旧抛错，绝不模拟交易，生产不可达。
        if arguments.contains("-redeStorePreviewFixture") {
            return SubscriptionModel(
                provider: StorePreviewFixtureProvider(
                    productIDs: configuration.productIDs,
                    startsPaid: arguments.contains("-redePaidCoachActiveFixture")
                ),
                configuration: configuration
            )
        }
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
/// 目录 + 权益的只读夹具。**不模拟任何交易**：purchase 照旧抛错。
/// restore 只做一件真实流程里会发生的事——重新同步后权益变得可解析（unknown → Free Core），
/// 好让「恢复购买」那条路能被完整看一遍。
private actor StorePreviewFixtureProvider: SubscriptionProviding {
    private let productIDs: [String]
    private var resolvesEntitlement: Bool
    private let paid: Bool

    init(productIDs: [String], startsPaid: Bool) {
        self.productIDs = productIDs
        self.paid = startsPaid
        self.resolvesEntitlement = startsPaid
    }

    nonisolated var transactionUpdates: AsyncStream<SubscriptionUpdate> {
        AsyncStream { continuation in continuation.finish() }
    }

    func products() async throws -> [SubscriptionProduct] {
        guard productIDs.count == 2 else { return [] }
        return [
            SubscriptionProduct(id: productIDs[0], displayName: "Rede Coach Monthly",
                                displayPrice: "$4.99", period: .monthly, subscriptionGroupID: "preview"),
            SubscriptionProduct(id: productIDs[1], displayName: "Rede Coach Annual",
                                displayPrice: "$39.99", period: .annual, subscriptionGroupID: "preview"),
        ]
    }

    func currentEntitlement() async throws -> ResolvedEntitlement {
        if paid { return .paidCoach(expirationDate: nil, billingState: .active) }
        // 未 restore 前故意解不出来 → UI 落到 unknown 那一格（⑦ 要修的正是它）。
        guard resolvesEntitlement else { throw SubscriptionIssue.storeUnavailable }
        return .freeCore
    }

    func purchase(productID: String) async throws -> PurchaseOutcome {
        throw SubscriptionIssue.configurationInvalid
    }

    func restore() async throws { resolvesEntitlement = true }
}

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
