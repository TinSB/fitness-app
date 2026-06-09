// TrainingReminderScheduling — N-2 Training Reminders V1.
//
// The injectable seam between the pure `TrainingReminderPolicy` and the real
// `UNUserNotificationCenter` adapter. Keeping scheduling behind this protocol
// means the policy + the app view-model are testable on the host without the
// UserNotifications framework (the real adapter is `#if os(iOS)`-only).
//
// LOCAL-ONLY by design: the seam can request authorization, REPLACE the full set
// of repeating weekly training reminders, READ BACK the currently-pending
// schedule, and CANCEL them all. It exposes NO remote / push capability —
// registering for remote (APNs) push is a server system and stays forbidden
// (master §17).
//
// The app keeps NO schedule of its own: iOS persists the repeating notifications,
// and `pendingSchedule()` is the single source of "what is currently set". This
// is what lets the thin app layer honour the ios/Rede no-disk boundary (no
// UserDefaults, no files) while still showing an honest on/off state.
//
// Reuses N-1's `RestReminderAuthorization` (the same local-notification
// authorization result) rather than duplicating an identical enum.

import Foundation

/// The protocol seam. READ the doc above: LOCAL scheduling only.
public protocol TrainingReminderScheduling: Sendable {
    /// Request user authorization to post LOCAL notifications. Returns the
    /// resulting authorization; a denial is surfaced honestly (never a fake grant).
    func requestAuthorization() async -> RestReminderAuthorization

    /// Replace ALL training reminders with exactly `requests`: schedule each given
    /// repeating weekly reminder and remove any of ours not in the set (so a
    /// de-selected weekday is dropped). Throws on failure so the caller can report
    /// an honest error — never a fabricated success. An empty array clears them.
    func replaceReminders(_ requests: [TrainingReminderRequest]) async throws

    /// The schedule currently pending in the notification center, reconstructed
    /// from our pending requests (nil if none of ours are pending). The single
    /// source of "what is set" — the app persists nothing itself.
    func pendingSchedule() async -> TrainingReminderSchedule?

    /// Cancel ALL of our training reminders (idempotent; no-op if none pending).
    func cancelAll() async
}
