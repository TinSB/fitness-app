import Foundation
import XCTest

/// Portable schema checks run in the normal SwiftPM gate. StoreKit lifecycle
/// behavior runs in Rede's iOS XCTest target, where StoreKitTest has a real
/// simulator-hosted environment.
final class StoreKitConfigurationTests: XCTestCase {
    private let productIDs = Set([
        "com.tinsab.rede.coach.monthly.test",
        "com.tinsab.rede.coach.annual.test",
    ])

    func testLocalConfigurationHasOneBilingualMonthlyAnnualGroup() throws {
        let configurationURL = try XCTUnwrap(
            Bundle.module.url(forResource: "Rede", withExtension: "storekit")
        )
        let data = try Data(contentsOf: configurationURL)
        let root = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        let groups = try XCTUnwrap(root["subscriptionGroups"] as? [[String: Any]])
        XCTAssertEqual(groups.count, 1)

        let group = try XCTUnwrap(groups.first)
        let groupID = try XCTUnwrap(group["id"] as? String)
        let subscriptions = try XCTUnwrap(group["subscriptions"] as? [[String: Any]])
        XCTAssertEqual(subscriptions.count, 2)
        XCTAssertEqual(Set(subscriptions.compactMap { $0["productID"] as? String }), productIDs)
        XCTAssertEqual(
            Set(subscriptions.compactMap { $0["recurringSubscriptionPeriod"] as? String }),
            Set(["P1M", "P1Y"])
        )

        for subscription in subscriptions {
            XCTAssertEqual(subscription["subscriptionGroupID"] as? String, groupID)
            XCTAssertFalse((subscription["displayPrice"] as? String ?? "").isEmpty)
            let localizations = try XCTUnwrap(
                subscription["localizations"] as? [[String: Any]]
            )
            XCTAssertEqual(
                Set(localizations.compactMap { $0["locale"] as? String }),
                Set(["en_US", "zh_CN"])
            )
            XCTAssertTrue(localizations.allSatisfy {
                !($0["displayName"] as? String ?? "").isEmpty
            })
        }
    }
}
