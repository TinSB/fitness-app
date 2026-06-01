// FocusSavedSessionDetailView — iOS-10 Local Training Persistence Mega Bundle V1
// (Iteration 5: local saved-session detail); iOS-15 adds PER-EXERCISE RECOVERY
// INSIGHT + an honest "resume where you left off" affordance.
//
// A local-only detail sheet for one saved snapshot: the engine context
// (sessionIntent / activePhase / deload), completed/target sets, the per-
// exercise rows, the local source note, and a small developer line with the
// schema version. iOS-15 layers in a READ-ONLY recovery view: each saved
// exercise is tagged 可恢复 / 已变更 (derived purely from the existing restore
// reconciliation), a short drift note, a list of new current exercises the
// snapshot has no progress for, and a resume affordance that reuses the EXISTING
// in-memory draft restore (no new restore semantics). This is NOT a full history
// app — no charts, no calendar, no cloud restore. Pure SwiftUI; never touches
// disk, network, cloud, or AppData.

import SwiftUI
import IronPathDomain
import IronPathLocalSnapshot

struct FocusSavedSessionDetailView: View {
    let snapshot: LocalCompletedSessionSnapshot
    /// iOS-15: the CURRENT scenario's exercise ids, supplied by the caller so the
    /// sheet can project a read-only recovery insight via the pure
    /// `LocalSnapshotRecovery.insight`. Defaults to empty for previews (which then
    /// shows an honest "nothing restorable" state).
    var currentExerciseIds: [String] = []
    /// iOS-17A: display unit for the per-set "上次成绩" weights. Storage is always
    /// kg (the v3 `setLogs` carry kg); this only formats the value at render time.
    /// Defaults to `.kg` for previews.
    var displayUnit: WeightUnit = .kg
    /// DEEP-EDIT-1: correct ONE logged set's 重量 / 次数 / RIR through the canonical
    /// gated write. The host injects `FocusModeMvpState.updateLoggedSet`; weight is
    /// entered in `displayUnit` and stored as kg by the host. Returns an HONEST
    /// outcome (`.saved` only after a real gated write; `.failed` otherwise) — the row
    /// reflects the new value ONLY after `.saved`, never a fake success. nil (the
    /// default) disables the edit affordance entirely (previews show read-only).
    var onSaveSet: ((_ exerciseId: String, _ setIndex: Int, _ weightInDisplayUnit: Double?, _ reps: Int?, _ rir: Int?) -> LoggedSetEditOutcome)? = nil
    /// DEEP-EDIT-1 display: load this snapshot's per-set DISPLAY values CANONICAL-FIRST
    /// (the corrected AppData.history metrics when present, else the LocalSnapshot copy),
    /// keyed `[exerciseId][setIndex]`. The host injects `FocusModeMvpState.canonicalSetDisplay(for:)`,
    /// whose read goes through the §10 clean-view chokepoint. nil (the default) keeps
    /// previews/tests on the snapshot copy — so a corrected set shows its new value
    /// PERSISTENTLY (cold start too), not the stale snapshot, without an in-RAM override.
    var loadCanonicalSetDisplay: (() -> [String: [Int: LocalCompletedSetEntrySnapshot]])? = nil
    /// iOS-11: restore this saved session into an in-RAM training draft and
    /// continue it. Optional so previews can omit it.
    var onContinue: (() -> Void)? = nil

    // MARK: - DEEP-EDIT-1 per-set edit + canonical display state

    /// Identifies one logged set within this saved session for editing.
    private struct SetEditKey: Hashable {
        let exerciseId: String
        let setIndex: Int
    }
    /// The set currently in two-step edit mode (nil = none).
    @State private var editingKey: SetEditKey? = nil
    /// In-flight edit-form drafts (display-unit weight / reps / RIR text).
    @State private var draftWeight: String = ""
    @State private var draftReps: String = ""
    @State private var draftRir: String = ""
    /// Honest inline error for the in-flight edit (parse error or a failed write).
    @State private var saveError: String? = nil
    /// Per-set DISPLAY values resolved CANONICAL-FIRST (keyed `[exerciseId][setIndex]`):
    /// the corrected AppData.history metrics when a canonical set matches, else the
    /// LocalSnapshot copy. Loaded on appear and refreshed after a committed correction,
    /// so a corrected set shows its new value PERSISTENTLY (cold start too) — the
    /// authoritative store is AppData.history, so no in-RAM value override is needed.
    @State private var canonicalSetDisplay: [String: [Int: LocalCompletedSetEntrySnapshot]] = [:]
    /// Sets the user corrected THIS session — drives the small "已修正" marker only. The
    /// VALUE comes from `canonicalSetDisplay` (canonical is the source of truth); this
    /// is just an in-session affordance, not a value store.
    @State private var correctedKeys: Set<SetEditKey> = []

    /// Pure, read-only projection over the existing restore reconciliation. No
    /// progress is applied here; restore still happens only via `onContinue`.
    private var insight: LocalSnapshotRecoveryInsight {
        LocalSnapshotRecovery.insight(from: snapshot, currentExerciseIds: currentExerciseIds)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard
                if onContinue != nil { resumeCard }
                contextCard
                recoveryInsightCard
                exerciseListCard
                footerNote
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        // DEEP-EDIT-1 display: pull the canonical-first per-set values on open so a
        // previously-corrected set renders its authoritative value (not the stale
        // snapshot). nil host (previews) → stays empty → falls back to the snapshot.
        .onAppear { refreshCanonicalSetDisplay() }
    }

    /// Pull the canonical-first per-set display values from the host (if wired). Called
    /// on appear and after a committed correction, so the rows reflect the authoritative
    /// AppData.history values — the in-RAM display override is no longer needed.
    private func refreshCanonicalSetDisplay() {
        guard let loadCanonicalSetDisplay else { return }
        canonicalSetDisplay = loadCanonicalSetDisplay()
    }

    // MARK: - iOS-15 resume affordance (thin UI over the EXISTING restore)

    @ViewBuilder
    private var resumeCard: some View {
        let insight = self.insight
        VStack(alignment: .leading, spacing: 6) {
            if insight.isRestorable {
                if let index = insight.resumeExerciseIndex, let name = insight.resumeExerciseName {
                    Text("上次练到第 \(index + 1) / \(insight.currentExerciseCount) 个动作：\(name)")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.primary)
                }
                Button {
                    onContinue?()
                } label: {
                    Text("从这里继续（本机草稿）")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                Text("在本机把这次训练恢复为草稿并继续 · 不写入云端 · 不改动其它数据")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            } else {
                // Honest disabled state: nothing in this saved session still maps
                // to the current scenario, so there is nothing to continue.
                Text("无法继续这次训练")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                Button {} label: {
                    Text("从这里继续（本机草稿）")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .disabled(true)
                Text("这次存档的动作已全部变更或无法恢复，本机无法继续。")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("已保存训练详情（本机）")
                .font(.title2.weight(.semibold))
            Text(Self.displayTime(snapshot.createdAtIso))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
            // iOS-12: schema badge + restore-eligibility (detail only opens for
            // already-validated saved snapshots, so they are restore-eligible).
            HStack(spacing: 6) {
                Text("schema v\(snapshot.schemaVersion)")
                    .font(.caption2.monospacedDigit())
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(RoundedRectangle(cornerRadius: 4).fill(Color(.tertiarySystemBackground)))
                Text("本机可恢复继续")
                    .font(.caption2)
                    .foregroundStyle(.green)
            }
            Text("仅保存在本机 · 不同步云端")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var contextCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("训练决策上下文")
                .font(.headline)
            row("样例", snapshot.scenarioLabel)
            row("本次训练", snapshot.sessionIntent)
            row("训练阶段", snapshot.activePhase)
            row("减载档位", "\(snapshot.deloadLevel) · \(snapshot.deloadStrategy)")
            row("完成组数", "\(snapshot.totalCompletedSets) / \(snapshot.totalTargetSets)")
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    // MARK: - iOS-15 per-exercise recovery insight (read-only)

    @ViewBuilder
    private var recoveryInsightCard: some View {
        let insight = self.insight
        // Only meaningful once we know the current scenario (caller supplied ids).
        if !currentExerciseIds.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("恢复明细（本机）")
                    .font(.headline)
                if insight.hasDrift {
                    Text("这次存档与当前训练样例有差异：可恢复的动作会带回进度，已变更的不会。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("这次存档与当前训练样例一致，全部动作均可恢复进度。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                VStack(spacing: 8) {
                    ForEach(insight.rows, id: \.exerciseId) { row in
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.name).font(.subheadline.weight(.medium))
                                Text("\(row.completedSets) / \(row.targetSets) 组")
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(.tertiary)
                            }
                            Spacer()
                            recoveryBadge(row.status)
                        }
                        .padding(.vertical, 6)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemBackground)))
                    }
                }
                if !insight.newCurrentExerciseIds.isEmpty {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("新动作（本机无进度）")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Text(insight.newCurrentExerciseIds.joined(separator: " · "))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
        }
    }

    @ViewBuilder
    private func recoveryBadge(_ status: LocalRecoveryStatus) -> some View {
        switch status {
        case .restorable:
            Text("可恢复")
                .font(.caption2.weight(.medium))
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(Color.green.opacity(0.15)))
                .foregroundStyle(.green)
        case .changed:
            Text("已变更")
                .font(.caption2.weight(.medium))
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(Color.orange.opacity(0.15)))
                .foregroundStyle(.orange)
        }
    }

    private var exerciseListCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("完成动作")
                .font(.headline)
            if snapshot.exercises.isEmpty {
                Text("没有完成的动作")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 8) {
                    ForEach(snapshot.exercises) { ex in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(ex.name).font(.subheadline.weight(.medium))
                                    Text(ex.role).font(.caption2).foregroundStyle(.tertiary)
                                }
                                Spacer()
                                Text("\(ex.completedSets) / \(ex.targetSets) 组")
                                    .font(.subheadline.monospacedDigit())
                            }
                            perSetSummary(for: ex)
                        }
                        .padding(.vertical, 6)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemBackground)))
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    // MARK: - iOS-17A per-set "上次成绩" summary (DERIVED display copy)

    /// Render the v3 per-set detail (weight / reps / RIR) for one exercise. A
    /// legacy v1/v2 session (or a set logged with no metrics) carries no
    /// `setLogs`, so this honestly shows "无逐组明细" rather than fabricating data.
    /// Weight is stored in kg and converted to the caller's `displayUnit` here.
    @ViewBuilder
    private func perSetSummary(for exercise: LocalCompletedExerciseSnapshot) -> some View {
        if let logs = exercise.setLogs, !logs.isEmpty {
            VStack(alignment: .leading, spacing: 3) {
                ForEach(logs, id: \.setIndex) { entry in
                    setRow(exerciseId: exercise.exerciseId, entry: entry)
                }
            }
            .padding(.top, 2)
        } else {
            Text("无逐组明细")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    /// One per-set line, e.g. "60kg · 8次 · RIR 2". Each metric is shown only when
    /// present (honest "not entered" → omitted, never a fabricated 0); a fully
    /// blank set degrades to "已完成".
    static func setLine(_ entry: LocalCompletedSetEntrySnapshot, displayUnit: WeightUnit) -> String {
        var parts: [String] = []
        if let kg = entry.weightKg, let shown = WeightConversion.fromKilograms(kg, to: displayUnit) {
            parts.append("\(formatWeight(shown))\(displayUnit.rawValue)")
        }
        if let reps = entry.reps { parts.append("\(reps)次") }
        if let rir = entry.rir { parts.append("RIR \(rir)") }
        return parts.isEmpty ? "已完成" : parts.joined(separator: " · ")
    }

    /// Format a display-unit weight: drop the trailing ".0" for whole values
    /// (60, not 60.0); keep one decimal otherwise (137.5).
    private static func formatWeight(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value.rounded()))
        }
        return String(format: "%.1f", value)
    }

    // MARK: - DEEP-EDIT-1 per-set two-step edit → save (canonical gated write)

    /// One per-set row: a read-only value line with an "编辑" affordance, or — when
    /// this set is being edited — the inline two-step edit form. The displayed value
    /// prefers an in-RAM override (set only after a committed canonical write) over
    /// the snapshot, so a just-corrected set shows its new value honestly.
    @ViewBuilder
    private func setRow(exerciseId: String, entry: LocalCompletedSetEntrySnapshot) -> some View {
        let key = SetEditKey(exerciseId: exerciseId, setIndex: entry.setIndex)
        // Prefer the canonical-first resolved value (the DEEP-EDIT-1-corrected metrics
        // from AppData.history when present) over the snapshot copy, so a correction
        // shows persistently. Empty map (previews / no canonical match) → the snapshot.
        let shown = canonicalSetDisplay[exerciseId]?[entry.setIndex] ?? entry
        if editingKey == key {
            setEditForm(exerciseId: exerciseId, entry: shown)
        } else {
            HStack(spacing: 6) {
                Text("第 \(entry.setIndex + 1) 组")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                if correctedKeys.contains(key) {
                    Text("已修正")
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(Capsule().fill(Color.green.opacity(0.15)))
                        .foregroundStyle(.green)
                }
                Spacer()
                Text(Self.setLine(shown, displayUnit: displayUnit))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.primary)
                if onSaveSet != nil {
                    Button {
                        beginEditing(key: key, entry: shown)
                    } label: {
                        Text("编辑").font(.caption2.weight(.medium))
                    }
                    .buttonStyle(.borderless)
                }
            }
        }
    }

    /// The inline two-step edit form for one set: three display-unit fields (重量 /
    /// 次数 / RIR) + honest error + 保存/取消. Weight is entered in `displayUnit`; the
    /// host converts to kg. A blank field clears that metric (honest "not entered").
    @ViewBuilder
    private func setEditForm(exerciseId: String, entry: LocalCompletedSetEntrySnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("修正第 \(entry.setIndex + 1) 组（仅本机）")
                .font(.caption.weight(.semibold))
            HStack(alignment: .top, spacing: 8) {
                editField("重量(\(displayUnit.rawValue))", text: $draftWeight, numeric: true, decimal: true)
                editField("次数", text: $draftReps, numeric: true, decimal: false)
                editField("RIR", text: $draftRir, numeric: true, decimal: false)
            }
            if let saveError {
                Text("⚠️ \(saveError)")
                    .font(.caption2)
                    .foregroundStyle(.red)
            }
            HStack(spacing: 8) {
                Button {
                    saveCurrentEdit(exerciseId: exerciseId, setIndex: entry.setIndex)
                } label: {
                    Text("保存").font(.caption.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                Button("取消", role: .cancel) {
                    editingKey = nil
                    saveError = nil
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            Text("修正会就地写入本机训练记录（引擎据此重算）· 不写云端 · 留空表示未填")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemBackground)))
    }

    @ViewBuilder
    private func editField(_ label: String, text: Binding<String>, numeric: Bool, decimal: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            TextField("", text: text)
                .textFieldStyle(.roundedBorder)
                .font(.caption2.monospacedDigit())
                .keyboardType(numeric ? (decimal ? .decimalPad : .numberPad) : .default)
        }
    }

    /// Enter edit mode for one set: prefill the fields from the currently shown value
    /// (weight converted kg → display unit), clear any stale error.
    private func beginEditing(key: SetEditKey, entry: LocalCompletedSetEntrySnapshot) {
        editingKey = key
        saveError = nil
        if let shownWeight = WeightConversion.fromKilograms(entry.weightKg, to: displayUnit) {
            draftWeight = Self.formatWeight(shownWeight)
        } else {
            draftWeight = ""
        }
        draftReps = entry.reps.map(String.init) ?? ""
        draftRir = entry.rir.map(String.init) ?? ""
    }

    /// Parse the drafts (blank = cleared; a non-empty unparseable/negative field is an
    /// honest error that blocks the save) and invoke the host's gated write. On
    /// `.saved` the row reflects the new value via an in-RAM override; on `.failed`
    /// the honest message stays and edit mode is kept — never a fake success.
    private func saveCurrentEdit(exerciseId: String, setIndex: Int) {
        guard let onSaveSet else { return }
        let weight: Double?
        switch Self.parseOptionalNonNegativeDouble(draftWeight) {
        case .some(let v): weight = v
        case .none: saveError = "请输入有效的重量"; return
        }
        let reps: Int?
        switch Self.parseOptionalNonNegativeInt(draftReps) {
        case .some(let v): reps = v
        case .none: saveError = "请输入有效的次数"; return
        }
        let rir: Int?
        switch Self.parseOptionalNonNegativeInt(draftRir) {
        case .some(let v): rir = v
        case .none: saveError = "请输入有效的 RIR"; return
        }

        switch onSaveSet(exerciseId, setIndex, weight, reps, rir) {
        case .saved:
            // The authoritative store (AppData.history) now holds the correction; pull
            // it back through the canonical read path so the row reflects it (no in-RAM
            // value override needed), and mark the set corrected for this session.
            correctedKeys.insert(SetEditKey(exerciseId: exerciseId, setIndex: setIndex))
            refreshCanonicalSetDisplay()
            editingKey = nil
            saveError = nil
        case .failed(let message):
            saveError = message
        }
    }

    /// Parse an optional non-negative Double field. Outer optional: `.some` = a valid
    /// parse (its inner value nil = the field was blank → cleared); `.none` = an
    /// invalid/negative entry the caller must reject.
    private static func parseOptionalNonNegativeDouble(_ raw: String) -> Double??  {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .some(nil) }
        guard let value = Double(trimmed), value.isFinite, value >= 0 else { return .none }
        return .some(value)
    }

    private static func parseOptionalNonNegativeInt(_ raw: String) -> Int?? {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .some(nil) }
        guard let value = Int(trimmed), value >= 0 else { return .none }
        return .some(value)
    }

    private var footerNote: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("来源：\(snapshot.source)")
                .font(.caption2)
                .foregroundStyle(.tertiary)
            // Small developer-facing line; clearly local.
            Text("本机快照 schema v\(snapshot.schemaVersion) · id \(snapshot.snapshotId)")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func row(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).font(.subheadline).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.subheadline.monospacedDigit()).foregroundStyle(.primary)
        }
    }

    /// Render an ISO-8601 instant as a compact UTC `yyyy-MM-dd HH:mm` label.
    private static func displayTime(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? {
            let alt = ISO8601DateFormatter()
            alt.formatOptions = [.withInternetDateTime]
            return alt.date(from: iso)
        }()
        guard let date else { return iso }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "UTC")
        fmt.dateFormat = "yyyy-MM-dd HH:mm 'UTC'"
        return fmt.string(from: date)
    }
}

#Preview {
    FocusSavedSessionDetailView(
        snapshot: LocalCompletedSessionSnapshot(
            snapshotId: "focus-normal-2",
            createdAtIso: "2026-05-27T10:00:00.000Z",
            scenarioId: "normal",
            scenarioLabel: "普通",
            sessionIntent: "normal-session",
            activePhase: "base",
            deloadLevel: "none",
            deloadStrategy: "maintain",
            totalCompletedSets: 5,
            totalTargetSets: 6,
            exercises: [
                LocalCompletedExerciseSnapshot(
                    exerciseId: "bench-press", name: "平板卧推", role: "secondary-compound",
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 3, targetSets: 3),
                    setLogs: [
                        LocalCompletedSetEntrySnapshot(setIndex: 0, weightKg: 60, reps: 8, rir: 2),
                        LocalCompletedSetEntrySnapshot(setIndex: 1, weightKg: 62.5, reps: 6, rir: 1),
                        LocalCompletedSetEntrySnapshot(setIndex: 2, weightKg: 62.5, reps: 5, rir: 0),
                    ]
                ),
                // A legacy / no-detail exercise: no setLogs → honest "无逐组明细".
                LocalCompletedExerciseSnapshot(
                    exerciseId: "lateral-raise", name: "哑铃侧平举", role: "isolation",
                    progress: LocalCompletedSetProgressSnapshot(completedSets: 2, targetSets: 3)
                ),
            ]
        ),
        // Preview the partial-drift path: bench-press still exists, lateral-raise
        // changed, and "cable-fly" is a new current exercise.
        currentExerciseIds: ["bench-press", "cable-fly"],
        onContinue: {}
    )
}
