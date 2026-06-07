// CoachActionDismissalEdit — CC-5 coach-action dismiss WRITE (Domain open-bag half).
//
// Pure, IO-free logic that turns the user's intent to "暂不处理 (dismiss today)" ONE coach
// action into a new CANONICAL `AppData` whose `dismissedCoachActions` is rewritten — the Domain
// half of the coach-action capstone's ONLY source-truth WRITE (§8.3). The IO half (load →
// defensive DataHealth clean-view gate → backup → atomic save → honest fail) lives in
// `IronPathPersistence.CanonicalSessionWriter.dismissCoachAction`, and the DataHealth gate is
// supplied by the caller (the app layer), so this file stays a pure value transform with no
// FileManager / disk / network / clock.
//
// FAITHFUL MIRROR of the legacy web app write `handleDismissCoachAction` (`retired web reference`) — steps
// ①③④ are line-by-line; step ② (the DEDUP BASE) DELIBERATELY DIVERGES, more conservatively (the
// honest correction is at the ② DEDUP-BASE note below — it is NOT a line-by-line copy of
// App.tsx:1912). The numbered steps:
//   ① `dismissedAt = todayKey()` — a civil calendar day `YYYY-MM-DD` (engineUtils.ts:30, the
//      LOCAL-day key `local.toISOString().slice(0,10)`). It is the `today` ARGUMENT here: this
//      Domain transform reads NO clock — the caller injects the civil date (§11.2 / red-line #4).
//   ② DEDUP: drop any existing entry with the SAME `scope === 'today'` AND the SAME `actionId`
//      AND the SAME day (`item.dismissedAt.slice(0, 10) === dismissedAt` — first-10-chars, NOT a
//      regex `dateKey`), keeping every other entry VERBATIM (its original JSONValue).
//   ③ APPEND a fresh dismissed-action value `{ actionId, dismissedAt: today, scope: 'today' }`.
//   ④ DOUBLE-WRITE the SAME `nextDismissed` array into BOTH the top-level open-bag key
//      `root.dismissedCoachActions` (App.tsx:1919) AND the nested `settings.dismissedCoachActions`
//      typed slot (App.tsx:1922) — one value transform, so a later read-filter (CC-6) sees zero
//      staleness whichever priority it reads, and a legacy-web-origin document (which double-writes the
//      same way) stays consistent.
// ② DEDUP-BASE divergence (honest correction — this is NOT a line-by-line mirror of App.tsx:1912):
// App.tsx:1912 dedups against `current.dismissedCoachActions` — ROOT-ONLY. This transform instead
// reads the READ-SIDE priority `root.dismissedCoachActions || settings.dismissedCoachActions || []`
// (`retired web reference` — a present array, even empty, at `root` wins JS `||`, else
// `settings`, else empty), the SAME priority the CC-6 read-filter at `enginePipeline.ts:98` reads.
// WHY diverge: iOS persists a RAW canonical document the legacy web app sanitizer has not necessarily run over,
// so taking the read-side priority keeps the write's dedup base ALIGNED with what CC-6 actually
// reads. On a real root-vs-settings divergence this is strictly MORE CONSERVATIVE — it preserves the
// user's dismiss intent rather than dropping it — and it still writes ONLY the user's input intent,
// never an engine output (no behavioural cost; the audit confirmed the dedup result is correct).
//
// INPUT, NOT OUTPUT (§11): a `DismissedCoachAction` is the user's OWN intent — it carries ONLY
// `{ actionId, dismissedAt, scope }` (a reference to the action the user dismissed + when + the
// scope). It is NEVER an engine OUTPUT: this write never touches a coach-action engine result,
// the `mesocyclePlan` weeks blob, a prescription, a phase / readiness / e1RM, or any computed
// field. The dismiss DECISION engine (`CoachActionDismissEngine`, CC-3 — fingerprint matching,
// `filterDismissedCoachActions` / `filterVisibleCoachActions`) is untouched and reused at READ
// time (CC-6); this slice only PERSISTS the intent.
//
// Why the value is constructed inline (rather than calling CC-3's
// `CoachActionDismissEngine.dismissCoachActionToday` / `DismissedCoachAction.encoded()`): those
// live in `IronPathTrainingDecision`, which sits ABOVE this package
// (`IronPathTrainingDecision → IronPathDataHealth → IronPathDomain`). `IronPathDomain` is the
// bottom layer and cannot import them without a dependency cycle. The constructed shape is the
// trivial 3-field literal `dismissCoachActionToday` produces (coachActionDismissEngine.ts:25-31)
// — the persisted document shape is inherently a Domain concern, exactly as `withConfigScalars` /
// `withCorrectedMetrics` build their canonical values in Domain. No engine logic is duplicated.
//
// This is an EDIT, not a restore (§13/§14): it rewrites the user's already-canonical document in
// place. Open-bag preserving — `schemaVersion` is unchanged (an edit is not a schema change),
// every OTHER top-level key + every OTHER settings key + all unknown / future fields survive
// verbatim, and ISO timestamps elsewhere are carried through untouched (this edit stamps only the
// injected civil `today` onto the new dismiss entry). The canonical emitter sorts keys, so the
// in-place vs append position of the rewritten keys never affects `canonicalJSONData()`.

import Foundation

extension AppData {
    /// A new `AppData` recording the user's intent to dismiss coach action `actionId` for the
    /// civil day `today` (`YYYY-MM-DD`). Pure value transform (Swift value semantics — the
    /// receiver is untouched). Mirrors `handleDismissCoachAction` (App.tsx:1908-1928) — with the
    /// file-header ② DEDUP-BASE divergence: dedup the current effective dismissed list by the
    /// READ-SIDE priority `root || settings` (NOT App.tsx's root-only — more conservative,
    /// CC-6-aligned) on scope+actionId+day, append `{ actionId, dismissedAt: today, scope: "today" }`, and
    /// DOUBLE-WRITE the SAME resulting array into BOTH `root.dismissedCoachActions` and
    /// `settings.dismissedCoachActions` — in ONE transform, so a single gated save persists both
    /// halves and no second write is ever opened.
    ///
    /// `today` is INJECTED by the caller (a civil calendar day) — this transform reads no clock
    /// (§11.2 / red-line #4). It writes ONLY the user's intent `{ actionId, dismissedAt, scope }`
    /// — never an engine output (§11). Open-bag / schema / timestamp preserving at both levels.
    public func withDismissedCoachAction(actionId: String, today: String) -> AppData {
        // ②-base: the current effective dismissed list, by the read-side priority
        // (enginePipeline.ts:102) — a present array (even empty) at root wins (JS `||`), else
        // settings, else empty. Raw JSONValues so kept entries re-emit byte-for-byte.
        let currentRaw: [JSONValue] =
            Self.truthyArray(root["dismissedCoachActions"])
            ?? Self.truthyArray(settings.dismissedCoachActions)
            ?? []

        // ②: drop the same-day same-action same-scope entry (replace, not append), keeping every
        // other entry VERBATIM. Mirrors App.tsx:1912-1914 (`.slice(0, 10)`, not a regex dateKey).
        let kept = currentRaw.filter { item in
            guard let obj = item.objectValue else { return true }   // non-object: cannot match → keep
            let scope = obj["scope"]?.stringValue
            let id = obj["actionId"]?.stringValue
            let day = String((obj["dismissedAt"]?.stringValue ?? "").prefix(10))
            let matches = scope == "today" && id == actionId && day == today
            return !matches
        }

        // ③: append the fresh dismissed-action value `{ actionId, dismissedAt: today, scope:
        // 'today' }` — the exact shape `dismissCoachActionToday` builds (coachActionDismissEngine.ts:25;
        // constructed inline — see file header on the layering that forbids importing it).
        let newEntry = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "actionId", value: .string(actionId)),
            .init(key: "dismissedAt", value: .string(today)),
            .init(key: "scope", value: .string("today")),
        ]))
        let nextDismissed = JSONValue.array(kept + [newEntry])

        // ④: DOUBLE-WRITE the SAME `nextDismissed` — root open-bag key (App.tsx:1919) + nested
        // settings typed slot (App.tsx:1922) — within ONE transform. `{...current.settings, …}`
        // is mirrored over the RAW settings object so every other settings key survives verbatim
        // (a missing / non-object settings slot starts a fresh object with just this key).
        var entries = root.entries
        Self.setEntry(&entries, key: "dismissedCoachActions", value: nextDismissed)

        var settingsEntries = root["settings"]?.objectValue?.entries ?? []
        Self.setEntry(&settingsEntries, key: "dismissedCoachActions", value: nextDismissed)
        Self.setEntry(&entries, key: "settings", value: .object(OrderedJSONObject(entries: settingsEntries)))

        return AppData(schemaVersion: schemaVersion, root: OrderedJSONObject(entries: entries))
    }

    /// JS `||` truthiness for the read-priority chain: a present ARRAY value (even empty) is
    /// "truthy" → used; `null` / missing / a non-array is "falsy" → fall through to the next
    /// source. Returns the raw element list so kept entries re-emit verbatim.
    private static func truthyArray(_ value: JSONValue?) -> [JSONValue]? {
        guard let value, case .array(let arr) = value else { return nil }
        return arr
    }

    /// In-place-or-append a single key (the open-bag rewrite paradigm shared by every `with…`
    /// edit). The canonical emitter sorts keys, so position never affects the on-disk bytes.
    private static func setEntry(_ entries: inout [OrderedJSONObject.Entry], key: String, value: JSONValue) {
        if let idx = entries.firstIndex(where: { $0.key == key }) {
            entries[idx] = OrderedJSONObject.Entry(key: key, value: value)
        } else {
            entries.append(OrderedJSONObject.Entry(key: key, value: value))
        }
    }
}
