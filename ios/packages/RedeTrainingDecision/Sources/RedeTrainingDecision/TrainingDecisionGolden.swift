// iOS-4B1 — the `parityGolden` envelope that wraps every golden file. Pure
// metadata decode; no engine logic.

import Foundation
import RedeDomain

/// The `parityGolden` envelope stamped by the parity generator.
public struct ParityGoldenEnvelope: Equatable, Sendable {
    public let sourceFixtureId: String
    public let generatedFromCommit: String?
    public let generatedAtPolicy: String?
    public let deterministicClockIso: String?
    public let generatorVersion: String?

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("ParityGoldenEnvelope")
        self.sourceFixtureId = try obj.requireString("sourceFixtureId", "ParityGoldenEnvelope")
        self.generatedFromCommit = obj.optionalString("generatedFromCommit")
        self.generatedAtPolicy = obj.optionalString("generatedAtPolicy")
        // deterministicClockIso is null for non-clock fixtures — kept as String?.
        self.deterministicClockIso = obj.optionalString("deterministicClockIso")
        self.generatorVersion = obj.optionalString("generatorVersion")
    }
}
