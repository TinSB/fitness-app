// iOS-4B1 — userFacing surface type skeleton.
//
// Each surface (today/plan/training/focus/progress/record/explanation) carries
// a rich, surface-specific payload. iOS-4B1 does NOT freeze every surface field
// (that is the engine port's job); instead each surface is backed by the full
// `JSONValue` open bag plus typed accessors for the stable common fields
// (surfaceId, headline, oneLineAdvice, micro). This decodes every golden's
// surface without failing and round-trips byte-stably, while still exposing
// the structured fields tests assert on. No engine logic.

import Foundation
import IronPathDomain

/// A single userFacing surface, preserved as the full open-bag JSON plus typed
/// accessors for the fields common to all surfaces.
public struct UserFacingSurface: Equatable, Sendable {
    /// The complete surface object exactly as decoded (forward-compatible).
    public let raw: JSONValue

    public init(raw: JSONValue) {
        self.raw = raw
    }

    public init(decoding value: JSONValue) throws {
        _ = try value.requireObject("UserFacingSurface")
        self.raw = value
    }

    private var object: OrderedJSONObject? { raw.objectValue }

    /// Stable discriminator: "today" | "plan" | ... present on every surface.
    public var surfaceId: String? { object?.optionalString("surfaceId") }

    /// Stable headline string present on every surface.
    public var headline: String? { object?.optionalString("headline") }

    /// One-line advice (present on most surfaces).
    public var oneLineAdvice: String? { object?.optionalString("oneLineAdvice") }

    /// The `micro` open bag (e.g. `{ phaseLabel }`), preserved raw.
    public var micro: JSONValue? { object?.rawValue("micro") }

    /// Convenience: read any field as a raw JSONValue for tests / future typing.
    public func field(_ key: String) -> JSONValue? { object?.rawValue(key) }

    public func encoded() -> JSONValue { raw }
}

/// The 7-surface userFacing map. Every golden carries all 7, but each is
/// modelled optional so a future narrower projection still decodes.
public struct TrainingDecisionUserFacing: Equatable, Sendable {
    public let today: UserFacingSurface?
    public let plan: UserFacingSurface?
    public let training: UserFacingSurface?
    public let focus: UserFacingSurface?
    public let progress: UserFacingSurface?
    public let record: UserFacingSurface?
    public let explanation: UserFacingSurface?

    public init(
        today: UserFacingSurface? = nil,
        plan: UserFacingSurface? = nil,
        training: UserFacingSurface? = nil,
        focus: UserFacingSurface? = nil,
        progress: UserFacingSurface? = nil,
        record: UserFacingSurface? = nil,
        explanation: UserFacingSurface? = nil
    ) {
        self.today = today
        self.plan = plan
        self.training = training
        self.focus = focus
        self.progress = progress
        self.record = record
        self.explanation = explanation
    }

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("TrainingDecisionUserFacing")
        func surface(_ key: String) throws -> UserFacingSurface? {
            guard let v = obj.rawValue(key), !v.isNull else { return nil }
            return try UserFacingSurface(decoding: v)
        }
        self.today = try surface("today")
        self.plan = try surface("plan")
        self.training = try surface("training")
        self.focus = try surface("focus")
        self.progress = try surface("progress")
        self.record = try surface("record")
        self.explanation = try surface("explanation")
    }

    /// The surfaceIds actually present, in canonical order.
    public var presentSurfaceIds: [String] {
        var ids: [String] = []
        if let s = today?.surfaceId ?? (today != nil ? "today" : nil) { ids.append(s) }
        if let s = plan?.surfaceId ?? (plan != nil ? "plan" : nil) { ids.append(s) }
        if let s = training?.surfaceId ?? (training != nil ? "training" : nil) { ids.append(s) }
        if let s = focus?.surfaceId ?? (focus != nil ? "focus" : nil) { ids.append(s) }
        if let s = progress?.surfaceId ?? (progress != nil ? "progress" : nil) { ids.append(s) }
        if let s = record?.surfaceId ?? (record != nil ? "record" : nil) { ids.append(s) }
        if let s = explanation?.surfaceId ?? (explanation != nil ? "explanation" : nil) { ids.append(s) }
        return ids
    }

    public func encoded() -> JSONValue {
        var entries: [OrderedJSONObject.Entry] = []
        if let s = today { entries.append(.init(key: "today", value: s.encoded())) }
        if let s = plan { entries.append(.init(key: "plan", value: s.encoded())) }
        if let s = training { entries.append(.init(key: "training", value: s.encoded())) }
        if let s = focus { entries.append(.init(key: "focus", value: s.encoded())) }
        if let s = progress { entries.append(.init(key: "progress", value: s.encoded())) }
        if let s = record { entries.append(.init(key: "record", value: s.encoded())) }
        if let s = explanation { entries.append(.init(key: "explanation", value: s.encoded())) }
        return .object(OrderedJSONObject(entries: entries))
    }
}
