// RestReminderModel — N-1 Local Rest-Timer Notification V1.
//
// Thin app-layer view-model that wires the N-1 LOCAL rest-timer reminder,
// mirroring the HK-1 `HealthKitBodyWeightImportModel` pattern: it holds in-RAM
// UI state, opts INTO the real local scheduler on first activation (so SwiftUI
// previews/tests never touch UserNotifications), and delegates ALL logic to the
// pure `RedeNotifications` package — the pure `RestReminderPolicy` + the
// `RestReminderScheduling` seam.
//
// Honest status (master §15.4 — no fake success):
//   • .enabled only after a real authorization grant
//   • .scheduled only after a real, thrown-error-free schedule
//   • .denied when authorization was refused (never a fake "on")
//   • .failed(_) on any thrown error
//   • .unavailable in previews/tests (never opted into a live scheduler)
//
// This file NEVER imports UserNotifications (it uses the package's
// `RestReminderScheduling` seam); the real `UserNotificationsRestReminderScheduler`
// is constructed only `#if os(iOS)`. It never touches FileManager / UserDefaults
// — the on/off + status is pure in-RAM state (resets on relaunch, by design for
// this first slice).

import Foundation
import SwiftUI
import RedeNotifications

/// In-RAM status for the rest-reminder surface. Drives the honest status line.
enum RestReminderStatus: Equatable {
    case idle                                              // not enabled yet
    case unavailable                                       // previews/tests
    case requesting                                        // authorization in flight
    case enabled                                           // authorized + on, none pending
    case scheduled(secondsFromNow: Int, exerciseName: String)
    case denied
    case failed(String)
}

@MainActor
final class RestReminderModel: ObservableObject {
    @Published private(set) var status: RestReminderStatus = .idle

    /// The local scheduler. Injectable for previews/tests (nil → not opted in).
    /// The running app opts into the real `UserNotificationsRestReminderScheduler`
    /// from the shell's `.task`.
    private var scheduler: RestReminderScheduling?

    /// Injectable clock. Only invoked when scheduling on the live path; the
    /// policy computes the fire instant from it (deterministic in tests).
    private let now: () -> Date

    init(scheduler: RestReminderScheduling? = nil, now: @escaping () -> Date = { Date() }) {
        self.scheduler = scheduler
        self.now = now
    }

    /// Opt the RUNNING app into the real local scheduler (idempotent). Called once
    /// from the shell on launch; previews/tests leave it unset so they never touch
    /// UserNotifications and `status` stays `.idle`.
    func activateLiveSchedulerIfNeeded() {
        #if os(iOS)
        if scheduler == nil { scheduler = UserNotificationsRestReminderScheduler() }
        #endif
    }

    /// Whether reminders are authorized + on (so a completed set should schedule).
    var isActive: Bool {
        switch status {
        case .enabled, .scheduled: return true
        default: return false
        }
    }

    /// User-gated: request LOCAL notification authorization and turn reminders on.
    /// An unopted environment is honest `.unavailable`; a refusal is `.denied`.
    func enableReminders() async {
        guard let scheduler else { status = .unavailable; return }
        status = .requesting
        switch await scheduler.requestAuthorization() {
        case .authorized: status = .enabled
        case .denied, .notDetermined: status = .denied
        case .unavailable: status = .unavailable
        }
    }

    /// Schedule (replacing any pending) the local rest reminder after a completed
    /// set. No-op when reminders aren't enabled. Honest `.failed` on a thrown
    /// error — never a fabricated success.
    func scheduleRestReminder(exerciseRoleRawValue: String, exerciseName: String, nextSetNumber: Int) async {
        guard let scheduler, isActive else { return }
        guard let request = RestReminderPolicy.makeReminder(
            now: now(),
            exerciseRoleRawValue: exerciseRoleRawValue,
            exerciseName: exerciseName,
            nextSetNumber: nextSetNumber
        ) else { return }
        do {
            try await scheduler.schedule(request)
            status = .scheduled(secondsFromNow: request.secondsFromNow, exerciseName: exerciseName)
        } catch {
            status = .failed(error.localizedDescription)
        }
    }

    /// Cancel the pending rest reminder (on next/prev exercise, session end,
    /// completion, reset, scenario change). No-op when nothing is active.
    func cancelRestReminder() async {
        guard let scheduler, isActive else { return }
        await scheduler.cancel(identifier: RestReminderPolicy.reminderIdentifier)
        status = .enabled
    }
}
