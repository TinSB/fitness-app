// RestReminderScheduling + RestReminderAuthorization — N-1 Local Rest-Timer
// Notification V1.
//
// The injectable seam between the pure scheduling policy and the real
// `UNUserNotificationCenter`. Keeping the scheduling behind this protocol means
// the app-layer view-model + the policy are testable on the host without the
// UserNotifications framework (the real adapter is `#if os(iOS)`-only).
//
// LOCAL-ONLY by design: the seam can request authorization, schedule ONE local
// reminder, and cancel it. It exposes NO remote / push capability — registering
// for remote (APNs) push is a server system and stays forbidden (master §17).

import Foundation

/// The outcome of requesting local-notification authorization. `.unavailable`
/// is the honest state for previews/tests (no live scheduler opted in) — never a
/// fake "authorized".
public enum RestReminderAuthorization: Equatable, Sendable {
    case authorized
    case denied
    case notDetermined
    case unavailable
}

/// The protocol seam. READ the doc above: LOCAL scheduling only.
public protocol RestReminderScheduling: Sendable {
    /// Request user authorization to post LOCAL notifications. Returns the
    /// resulting authorization; a denial is surfaced honestly (never a fake grant).
    func requestAuthorization() async -> RestReminderAuthorization

    /// Schedule the local reminder. Re-scheduling with the same identifier
    /// replaces the pending one (one reminder at a time). Throws on failure so
    /// the caller can report an honest error — never a fabricated success.
    func schedule(_ request: RestReminderRequest) async throws

    /// Cancel the pending reminder with this identifier (no-op if none pending).
    func cancel(identifier: String) async
}
