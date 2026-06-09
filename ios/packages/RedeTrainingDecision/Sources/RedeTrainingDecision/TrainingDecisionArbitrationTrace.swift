// iOS-4B1 — arbitration-trace item helper. The trace itself decodes as an
// ordered `[String]` on HiddenDebugSignals; this lightweight value type lets
// callers/tests inspect an item's AR-<n>-<slug> structure without any engine
// logic. It computes NOTHING about a decision — it only parses a code string.

import Foundation

/// A parsed view over a single `AR-<number>-<slug>` arbitration code string.
/// Purely structural — does not decide anything.
public struct ArbitrationTraceItem: Equatable, Sendable {
    /// The raw code verbatim, e.g. "AR-2-reentry-override".
    public let code: String

    public init(_ code: String) {
        self.code = code
    }

    /// The numeric rule index, e.g. 2 for "AR-2-reentry-override". nil if the
    /// code does not follow the AR-<n>- convention.
    public var ruleNumber: Int? {
        let parts = code.split(separator: "-")
        guard parts.count >= 2, parts[0] == "AR" else { return nil }
        return Int(parts[1])
    }

    /// The slug after `AR-<n>-`, e.g. "reentry-override". nil if not parseable.
    public var slug: String? {
        let parts = code.split(separator: "-", maxSplits: 2, omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0] == "AR" else { return nil }
        return String(parts[2])
    }

    /// True when the code matches the `AR-<digits>-<slug>` shape.
    public var isWellFormed: Bool {
        ruleNumber != nil && slug != nil
    }
}

public extension HiddenDebugSignals {
    /// The arbitration trace as parsed items, order preserved.
    var arbitrationItems: [ArbitrationTraceItem] {
        arbitrationTrace.map { ArbitrationTraceItem($0) }
    }
}
