// TodayStateEngine — SC-B scheduling-track self-contained today-state port.
//
// Faithful line-by-line Swift port of the ENTIRE `retired web reference`:
// `buildTodayTrainingState` (ts:40) + its private helpers `sessionDateKey` (ts:35)
// and `recentTimestamp` (ts:37). The legacy web schema engine imports ONLY the
// `ProgramTemplate`/`TrainingSession`/`TrainingTemplate` types + `toLocalDateKey`
// (the SC-B `TrainingCalendarEngine.toLocalDateKey`, ported in THIS slice) — it is
// genuinely self-contained: no other engine, no data table.
//
// PURE / READ-ONLY: classifies the day as not_started / in_progress / completed from
// an active session + completed-session history + an injected `selectedDate` /
// `currentLocalDate`. Zero `: Date` — the legacy web schema `new Date().toISOString()` final
// fallback (todayStateEngine.ts:47) is the ONE wall-clock seam; this port threads it
// as an INJECTED `nowIso` parameter (the AN-1 injected-clock contract), and every
// parity fixture supplies `selectedDate` or `currentLocalDate` so the `||` chain
// short-circuits before `nowIso` (the legacy web schema `new Date()` fallback cannot be pinned
// deterministically — exactly why the EngineUtils `todayKey`/`monthKey` wall-clock
// tools were left injected, not ported). The destructure at todayStateEngine.ts:40-46
// drops `templates` / `programTemplate` (unused in the body) — so this port omits them
// too. No IO, no randomness, no write path. NOT wired into any UI (a later SC slice).

import Foundation
import RedeDomain

public enum TodayStateEngine {

    /// `TodayTrainingState` (todayStateEngine.ts:4-23) — the legacy web schema discriminated union, modeled as
    /// one struct whose per-status fields are Optional. The canonical golden drops the fields a
    /// given `status` does not carry (e.g. `not_started` omits `activeSessionId`), which decode
    /// to nil — matching what the corresponding branch leaves nil here.
    public struct TodayTrainingState: Equatable, Sendable {
        public let status: String         // 'not_started' | 'in_progress' | 'completed'
        public let date: String
        public let primaryAction: String  // 'start_training' | 'continue_training' | 'view_summary'
        public let plannedTemplateId: String?       // not_started only (may be absent)
        public let activeSessionId: String?         // in_progress only
        public let completedSessionIds: [String]?   // completed only
        public let lastCompletedSessionId: String?  // completed only

        public init(
            status: String,
            date: String,
            primaryAction: String,
            plannedTemplateId: String? = nil,
            activeSessionId: String? = nil,
            completedSessionIds: [String]? = nil,
            lastCompletedSessionId: String? = nil
        ) {
            self.status = status
            self.date = date
            self.primaryAction = primaryAction
            self.plannedTemplateId = plannedTemplateId
            self.activeSessionId = activeSessionId
            self.completedSessionIds = completedSessionIds
            self.lastCompletedSessionId = lastCompletedSessionId
        }
    }

    // MARK: - sessionDateKey / recentTimestamp (todayStateEngine.ts:35 / :37)

    /// `sessionDateKey` (ts:35): `toLocalDateKey(session.date || session.startedAt || session.finishedAt)`.
    /// NOTE the precedence is `date || startedAt || finishedAt` — DISTINCT from
    /// `getSessionCalendarDate`'s `finishedAt || startedAt || date`.
    private static func sessionDateKey(_ session: TrainingSession) -> String {
        TrainingCalendarEngine.toLocalDateKey(
            TrainingCalendarEngine.truthy(session.date)
                ?? TrainingCalendarEngine.truthy(session.startedAt)
                ?? TrainingCalendarEngine.truthy(session.finishedAt)
        )
    }

    /// `recentTimestamp` (ts:37): `String(session.finishedAt || session.startedAt || session.date || '')`.
    private static func recentTimestamp(_ session: TrainingSession) -> String {
        TrainingCalendarEngine.truthy(session.finishedAt)
            ?? TrainingCalendarEngine.truthy(session.startedAt)
            ?? TrainingCalendarEngine.truthy(session.date)
            ?? ""
    }

    // MARK: - buildTodayTrainingState (todayStateEngine.ts:40)

    /// `buildTodayTrainingState` (todayStateEngine.ts:40-83). `nowIso` is the injected
    /// `new Date().toISOString()` seam (ts:47); fixtures always pass `selectedDate` or
    /// `currentLocalDate` so it is never the load-bearing path.
    public static func buildTodayTrainingState(
        activeSession: TrainingSession? = nil,
        history: [TrainingSession] = [],
        selectedDate: String? = nil,
        currentLocalDate: String? = nil,
        plannedTemplateId: String? = nil,
        nowIso: String
    ) -> TodayTrainingState {
        // ts:47 — date = toLocalDateKey(selectedDate || currentLocalDate || new Date().toISOString())
        let date = TrainingCalendarEngine.toLocalDateKey(
            TrainingCalendarEngine.truthy(selectedDate)
                ?? TrainingCalendarEngine.truthy(currentLocalDate)
                ?? nowIso
        )

        // ts:49-56 — `if (activeSession && activeSession.completed !== true)` → in_progress.
        if let activeSession, activeSession.completed != true {
            return TodayTrainingState(
                status: "in_progress",
                date: date,
                primaryAction: "continue_training",
                activeSessionId: activeSession.id
            )
        }

        // ts:58-65 — completed sessions on `date`, NEWEST first.
        let completedSessions = stableSorted(
            history.filter { session in
                // const flag = session.dataFlag || 'normal'
                let rawFlag = session._unknown["dataFlag"]?.stringValue
                let flag = (rawFlag == nil || rawFlag!.isEmpty) ? "normal" : rawFlag!
                if flag == "test" || flag == "excluded" { return false } // ts:61
                if session.completed != true { return false }            // ts:62 (`!== true`)
                return sessionDateKey(session) == date                   // ts:63
            }
        ) { left, right in
            // (l, r) => recentTimestamp(r).localeCompare(recentTimestamp(l)) — DESC by code point.
            let l = recentTimestamp(left), r = recentTimestamp(right)
            return r < l ? -1 : (r > l ? 1 : 0)
        }

        // ts:67-75 — completed.
        if let first = completedSessions.first {
            return TodayTrainingState(
                status: "completed",
                date: date,
                primaryAction: "view_summary",
                completedSessionIds: completedSessions.map { $0.id ?? "" },
                lastCompletedSessionId: first.id
            )
        }

        // ts:77-82 — not_started.
        return TodayTrainingState(
            status: "not_started",
            date: date,
            primaryAction: "start_training",
            plannedTemplateId: plannedTemplateId
        )
    }

    // MARK: - stableSorted (JS `Array.prototype.sort` stability)

    /// STABLE sort over a JS three-way comparator (negative = left first); ties keep their
    /// original relative order, mirroring `Array.prototype.sort` (the `WorkoutCycleScheduler`
    /// precedent).
    private static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }
}
