// CanonicalKeyOrderFoldParityTests — FIX-B (§9 canonicalKeyOrder fidelity).
//
// Pins the §9 canonical key order against the retired legacy canonical-stringify for
// objects whose sibling keys are EQUAL once lowercased ("Foo"/"foo", "AB"/"ab"/…).
// Before FIX-B, `canonicalKeyOrder`'s tie-break was raw code-point order
// (upper-before-lower) — the EXACT inverse of the legacy web schema `localeCompare` tertiary
// case tie-break (lower-before-upper) — so `canonicalJSONData()` byte-diverged
// from the legacy web schema canonical form on case-folded sibling keys. No fixture carried such
// keys, so the debt stayed latent (Swift was internally consistent → round-trip /
// snapshot-hash green). This LOAD-BEARING cross-validation loads the
// `app-data/canonical-keyorder-fold-v1` golden — generated from the REAL
// canonical-stringify (`JSON.stringify(sortKeysDeep(payload))`, byte-identical to
// `accountBoundaryLocalInventory.ts:116` stableStringify) + the REAL
// `buildAppDataSnapshotHash` — and asserts, case-by-case, that:
//
//   * `JSONValue(payload).canonicalJSONString()` equals the golden `canonicalJson`
//     BYTE-FOR-BYTE (the §9 canonical byte form), and
//   * the Swift FNV-1a over that canonical string equals the golden `snapshotHash`
//     (`phase19b-…`, the cross-end byte-identical parity anchor).
//
// With the pre-FIX-B `< ` tie-break, the very first case (`bar`/`Bar`/`foo`/`Foo`)
// re-orders to `{"Bar":4,"bar":3,"Foo":1,"foo":2}` ≠ the golden, so this test FAILS
// before the fix and PASSES after — the tie-break direction is load-bearing.

import XCTest
@testable import RedeDomain
import Foundation

final class CanonicalKeyOrderFoldParityTests: XCTestCase {
    /// Walks the source-file path back to the repo root, then resolves the
    /// FIX-B case-fold golden. Deterministic at compile time via `#filePath`,
    /// independent of `swift test`'s `.build/` working directory (the
    /// `AppDataRealExportParityTests` precedent — no `Bundle.module` copy).
    private func goldenURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // RedeDomainTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // RedeDomain/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
            .appendingPathComponent("ios/ParityFixtures/parity/golden/app-data/canonical-keyorder-fold-v1.json")
    }

    func testCaseFoldGoldenExists() throws {
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: goldenURL().path),
            "FIX-B case-fold golden must exist at the canonical parity path"
        )
    }

    /// LOAD-BEARING: every case's Swift canonical string == the legacy web schema-generated
    /// `canonicalJson` byte-for-byte AND its FNV-1a == the legacy web schema `snapshotHash`.
    func testCanonicalKeyOrderMatchesTsGoldenByteForByte() throws {
        let data = try Data(contentsOf: goldenURL())
        let golden = try JSONValue(decoding: data)
        guard case .object(let root) = golden,
              let cases = root["cases"]?.arrayValue else {
            XCTFail("golden must be an object carrying a `cases` array")
            return
        }
        // Guard the batch is non-trivial — the fixture must keep exercising the
        // case-fold tie-break (5 cases: top-level fold / hash-fold set / nested /
        // mixed-primary / array-recursion). A silently-emptied fixture must fail.
        XCTAssertGreaterThanOrEqual(cases.count, 5,
                                    "case-fold golden must carry the full case batch")

        for (index, c) in cases.enumerated() {
            guard case .object(let caseObj) = c,
                  let payload = caseObj["payload"],
                  let expectedCanonical = caseObj["canonicalJson"]?.stringValue,
                  let expectedHash = caseObj["snapshotHash"]?.stringValue else {
                XCTFail("case \(index) missing payload / canonicalJson / snapshotHash")
                continue
            }
            let label = caseObj["label"]?.stringValue ?? "case \(index)"

            // §9 canonical byte form — must equal the legacy web schema canonical-stringify output.
            let actualCanonical = try payload.canonicalJSONString()
            XCTAssertEqual(actualCanonical, expectedCanonical,
                           "canonicalJSONString must byte-match the legacy web schema canonical-stringify golden — \(label)")

            // Cross-end snapshot-hash anchor — FNV-1a over the same canonical string.
            XCTAssertEqual(fnv1aPhase19b(actualCanonical), expectedHash,
                           "FNV-1a over the canonical string must match the legacy web schema snapshotHash — \(label)")
        }
    }

    /// Focused, golden-independent probe of the comparator's tie-break direction:
    /// keys equal once lowercased sort lower-BEFORE-upper (localeCompare tertiary),
    /// while the case-insensitive primary order is unaffected.
    func testCanonicalKeyOrderTieBreakIsLowerBeforeUpper() {
        // Tie-break (equal when lowercased): lower sorts first.
        XCTAssertTrue(canonicalKeyOrder("bar", "Bar"))
        XCTAssertFalse(canonicalKeyOrder("Bar", "bar"))
        XCTAssertTrue(canonicalKeyOrder("foo", "Foo"))
        XCTAssertTrue(canonicalKeyOrder("ab", "aB"))   // ab < aB < Ab < AB
        XCTAssertTrue(canonicalKeyOrder("aB", "Ab"))
        XCTAssertTrue(canonicalKeyOrder("Ab", "AB"))
        // Case-insensitive primary is unchanged by the tie-break fix.
        XCTAssertTrue(canonicalKeyOrder("bar", "foo"))   // b < f
        XCTAssertTrue(canonicalKeyOrder("Bar", "foo"))   // primary b < f beats case
        XCTAssertFalse(canonicalKeyOrder("foo", "Bar"))
    }
}

// FNV-1a (32-bit) — copy of the algorithm from `AppDataRealExportParityTests`
// (`buildAppDataSnapshotHash`'s `hashText`, accountBoundaryLocalInventory.ts:127).
// Centralisation into a shared helper is iOS-7 work when the cloud upload path
// needs the same primitive.
private func fnv1aPhase19b(_ text: String) -> String {
    var hash: UInt32 = 2166136261
    for unit in text.utf16 {
        hash ^= UInt32(unit)
        hash = hash &* 16777619
    }
    return String(format: "phase19b-%08x", hash)
}
