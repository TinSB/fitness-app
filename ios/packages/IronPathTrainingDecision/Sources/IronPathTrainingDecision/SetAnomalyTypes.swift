// SetAnomalyTypes — CC-0 coach-action capstone foundation (3/3).
//
// Faithful Swift port of the `SetAnomaly` TYPE FAMILY from
// `retired web reference`:
//   • `SetAnomalySeverity` (ts:5) — 3-case severity union (info/warning/critical).
//   • `SetAnomaly`         (ts:7) — { id, severity, title, message,
//                                     suggestedAction?, requiresConfirmation }.
//
// TYPE-ONLY port: `coachActionEngine` consumes `SetAnomaly` as a type-only input,
// so CC-0 ports the SHAPE only — the `detectSetAnomalies` engine logic (ts:269)
// and its imports (ActualSetDraft / UnitSettings / unitConversionEngine — used
// ONLY by the engine, never by these types) are a separate later track.
//
// Pure types: no runtime logic, no write path, no `: Date`.

import Foundation
import IronPathDomain

/// `SetAnomalySeverity` (setAnomalyEngine.ts:5). NOTE this is a DISTINCT union
/// from `DataHealthSeverity` (info/warning/error) — anomaly severity tops out at
/// `critical`, not `error`.
public enum SetAnomalySeverity: String, Equatable, Hashable, Sendable, CaseIterable {
    case info
    case warning
    case critical
}

/// `SetAnomaly` (setAnomalyEngine.ts:7). `suggestedAction` is the only optional
/// field (legacy web schema `?`); everything else is required.
public struct SetAnomaly: Equatable, Hashable, Sendable {
    public let id: String
    public let severity: SetAnomalySeverity
    public let title: String
    public let message: String
    public let suggestedAction: String?
    public let requiresConfirmation: Bool

    public init(
        id: String,
        severity: SetAnomalySeverity,
        title: String,
        message: String,
        suggestedAction: String? = nil,
        requiresConfirmation: Bool
    ) {
        self.id = id
        self.severity = severity
        self.title = title
        self.message = message
        self.suggestedAction = suggestedAction
        self.requiresConfirmation = requiresConfirmation
    }

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("SetAnomaly")
        self.id = try obj.requireString("id", "SetAnomaly.id")
        let rawSeverity = try obj.requireString("severity", "SetAnomaly.severity")
        guard let parsedSeverity = SetAnomalySeverity(rawValue: rawSeverity) else {
            throw SetAnomalyDecodeError.invalidEnum("severity", value: rawSeverity)
        }
        self.severity = parsedSeverity
        self.title = try obj.requireString("title", "SetAnomaly.title")
        self.message = try obj.requireString("message", "SetAnomaly.message")
        self.suggestedAction = obj.optionalString("suggestedAction")
        self.requiresConfirmation = obj.optionalBool("requiresConfirmation") ?? false
    }
}

/// Errors raised while decoding a `SetAnomaly` shape.
public enum SetAnomalyDecodeError: Error, Equatable, Sendable {
    case invalidEnum(String, value: String)
}
