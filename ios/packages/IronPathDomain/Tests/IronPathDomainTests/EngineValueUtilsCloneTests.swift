// EngineValueUtilsCloneTests — PA-S2 `clone` (engineUtils.ts:28) Swift-value-semantics
// unit tests. `clone` has no golden (its observable behaviour is fully characterised by
// these pure cases): a JSONValue value-type deep copy whose ONLY JSON-round-trip transform
// is non-finite numbers → null (JS `JSON.stringify(NaN/±Infinity) === "null"`); everything
// else, including key insertion order, is preserved verbatim.

import XCTest
import IronPathDomain

final class EngineValueUtilsCloneTests: XCTestCase {

    func testCloneIsDeepIdentityForFiniteValueTreePreservingKeyOrder() {
        // Keys deliberately NOT alphabetical ("b" before "a") to prove insertion order is kept
        // (OrderedJSONObject equality is order-sensitive, so == fails if order changes).
        let tree = JSONValue.object(OrderedJSONObject(entries: [
            OrderedJSONObject.Entry(key: "b", value: .string("x")),
            OrderedJSONObject.Entry(key: "a", value: .number(.integer(42))),
            OrderedJSONObject.Entry(key: "nested", value: .array([
                .bool(true), .null, .number(.double(2.5)), .string("k"),
            ])),
            OrderedJSONObject.Entry(key: "obj", value: .object(OrderedJSONObject(entries: [
                OrderedJSONObject.Entry(key: "z", value: .number(.integer(1))),
            ]))),
        ]))
        XCTAssertEqual(EngineValueUtils.clone(tree), tree)
    }

    func testCloneCollapsesNonFiniteDoublesToNull() {
        XCTAssertEqual(EngineValueUtils.clone(.number(.double(.nan))), .null)
        XCTAssertEqual(EngineValueUtils.clone(.number(.double(.infinity))), .null)
        XCTAssertEqual(EngineValueUtils.clone(.number(.double(-Double.infinity))), .null)
    }

    func testCloneCollapsesNonFiniteInsideContainers() {
        let input = JSONValue.object(OrderedJSONObject(entries: [
            OrderedJSONObject.Entry(key: "nan", value: .number(.double(.nan))),
            OrderedJSONObject.Entry(key: "arr", value: .array([
                .number(.double(.infinity)), .number(.integer(3)),
            ])),
        ]))
        let expected = JSONValue.object(OrderedJSONObject(entries: [
            OrderedJSONObject.Entry(key: "nan", value: .null),
            OrderedJSONObject.Entry(key: "arr", value: .array([.null, .number(.integer(3))])),
        ]))
        XCTAssertEqual(EngineValueUtils.clone(input), expected)
    }

    func testCloneKeepsFiniteNumbersOfEveryReprAndOrder() {
        let input = JSONValue.array([
            .number(.integer(0)),
            .number(.double(72.6)),
            .number(.decimal(Decimal(string: "3.14")!)),
        ])
        XCTAssertEqual(EngineValueUtils.clone(input), input)
    }

    func testCloneLeavesScalarsUnchanged() {
        XCTAssertEqual(EngineValueUtils.clone(.null), .null)
        XCTAssertEqual(EngineValueUtils.clone(.bool(false)), .bool(false))
        XCTAssertEqual(EngineValueUtils.clone(.string("")), .string(""))
        XCTAssertEqual(EngineValueUtils.clone(.number(.integer(-7))), .number(.integer(-7)))
    }

    func testCloneKeepsEmptyContainers() {
        XCTAssertEqual(EngineValueUtils.clone(.array([])), .array([]))
        XCTAssertEqual(EngineValueUtils.clone(.object(OrderedJSONObject())), .object(OrderedJSONObject()))
    }
}
