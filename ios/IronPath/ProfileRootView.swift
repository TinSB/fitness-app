// ProfileRootView — iOS-17B Profile Surface V1.
//
// 我的 (Profile) tab. Read-only rendering of the profile / unit / screening
// / settings Domain values, with a local-only display-unit toggle. Thin
// renderer (master §5/§15): all formatting is delegated to
// IronPathDomain.ProfileDisplay — this view holds no business logic, reads
// no disk, and writes no AppData. The four Domain values are injected
// (default = a deterministic preview sample) so the surface renders without
// touching canonical data; real on-device read + edit are later, gated
// slices (master §8/§9/§14).
//
// === iOS-17S Tab Shell Scaffold V1 · parallel-line integration contract ===
// This slice fills ONLY this RootView's body + the package logic it renders.
// It does NOT edit ContentView (the shell), another tab's RootView,
// FocusMode*, or project.pbxproj. Keep the app layer thin (master
// §5/§15/§19.3): no business logic, no persistence, no network/cloud/auth
// here.

import Foundation
import SwiftUI
import IronPathDomain
import IronPathNotifications

struct ProfileRootView: View {
    private let profile: UserProfile
    private let unitSettings: UnitSettings
    private let screening: ScreeningProfile
    private let appSettings: AppSettings

    /// Display-unit preference as local UI state ONLY — toggling it never
    /// writes UnitSettings/AppData (storage stays kg; the UnitSettings
    /// contract). Seeded from the injected settings' displayUnit.
    @State private var displayUnit: WeightUnit

    init(
        profile: UserProfile = ProfileDisplayPreviewSample.userProfile,
        unitSettings: UnitSettings = ProfileDisplayPreviewSample.unitSettings,
        screening: ScreeningProfile = ProfileDisplayPreviewSample.screeningProfile,
        appSettings: AppSettings = ProfileDisplayPreviewSample.appSettings
    ) {
        self.profile = profile
        self.unitSettings = unitSettings
        self.screening = screening
        self.appSettings = appSettings
        _displayUnit = State(
            initialValue: unitSettings.displayUnit ?? unitSettings.weightUnit ?? .kg
        )
    }

    var body: some View {
        NavigationStack {
            List {
                profileSection
                unitSection
                screeningSection
                settingsSection
                // HK-1: user-gated, read-only Apple Health body-weight import.
                // Owns its own view-model; the read/write happens only on tap.
                HealthKitBodyWeightImportSection()
                // N-2: user-gated, LOCAL-only weekly training reminder. Owns its
                // own view-model; scheduling happens only on tap, via the package
                // seam (no UserNotifications import / no disk here).
                TrainingReminderCard()
            }
            .navigationTitle("我的")
        }
    }

    // MARK: - Sections

    private var profileSection: some View {
        Section("个人资料") {
            LabeledContent("姓名", value: ProfileDisplay.text(profile.name))
            LabeledContent("性别", value: ProfileDisplay.sex(profile.sex))
            LabeledContent("年龄", value: ProfileDisplay.integer(profile.age, suffix: " 岁"))
            LabeledContent("身高", value: ProfileDisplay.height(profile.heightCm))
            LabeledContent("体重", value: ProfileDisplay.weight(profile.weightKg, unit: displayUnit))
            LabeledContent("训练水平", value: ProfileDisplay.trainingLevel(profile.trainingLevel))
            LabeledContent("主要目标", value: ProfileDisplay.text(profile.primaryGoal))
            LabeledContent("每周训练", value: ProfileDisplay.integer(profile.weeklyTrainingDays, suffix: " 天"))
            LabeledContent("单次时长", value: ProfileDisplay.integer(profile.sessionDurationMin, suffix: " 分钟"))

            // Collapsed by default — keep the main list calm (AGENTS UI rules).
            DisclosureGroup("健康备注") {
                LabeledContent("既往伤病", value: ProfileDisplay.list(profile.injuryFlags))
                LabeledContent("疼痛备注", value: ProfileDisplay.list(profile.painNotes))
            }
        }
    }

    private var unitSection: some View {
        Section {
            Picker("显示单位", selection: $displayUnit) {
                Text(ProfileDisplay.unitName(.kg)).tag(WeightUnit.kg)
                Text(ProfileDisplay.unitName(.lb)).tag(WeightUnit.lb)
            }
            .pickerStyle(.segmented)
        } header: {
            Text("单位")
        } footer: {
            Text("重量始终以千克存储，此处仅切换显示单位，不会修改任何已保存的数据。")
        }
    }

    private var screeningSection: some View {
        Section("筛查") {
            LabeledContent("疼痛触发", value: ProfileDisplay.list(screening.painTriggers))
            LabeledContent("受限动作", value: ProfileDisplay.list(screening.restrictedExercises))
            LabeledContent("纠正优先", value: ProfileDisplay.list(screening.correctionPriority))
        }
    }

    private var settingsSection: some View {
        Section {
            LabeledContent("训练模式", value: ProfileDisplay.text(appSettings.trainingMode))
            LabeledContent("当前模板", value: ProfileDisplay.text(appSettings.selectedTemplateId))
            LabeledContent("准备度参考健康数据", value: ProfileDisplay.bool(appSettings.useHealthDataForReadiness))
        } header: {
            Text("设置")
        } footer: {
            // Honest disclosure — no fake success (master §15.4). Scope is the
            // profile/unit/screening/settings above; the 健康数据 section below
            // has its own disclosure for the user-gated Apple Health import.
            Text("以上个人资料、筛查与设置为只读示例预览，真实资料的读取与编辑将在后续版本上线。")
        }
    }
}

#Preview {
    ProfileRootView()
}

// MARK: - N-2 Training Reminders (local-only weekly reminder)
//
// A user-gated card that schedules REPEATING weekly local training reminders.
// Mirrors the HK-1 section pattern: a self-contained sub-view that owns its own
// `@StateObject` view-model, co-located here to avoid a new app file / pbxproj
// edit (the task's "尽量只编辑 ProfileRootView" / no-new-file preference). The
// view holds NO business logic — all scheduling lives in the pure
// `TrainingReminderPolicy` + the `TrainingReminderScheduling` seam; the model is
// thin glue. It never imports UserNotifications and never touches disk
// (FileManager / UserDefaults): iOS persists the repeating notifications and the
// live state is read back from the notification center.

/// Honest in-RAM status for the training-reminder card — no fake success
/// (master §15.4).
private enum TrainingReminderStatus: Equatable {
    case idle                       // not opted in / auth unknown
    case unavailable                // previews / tests (no live scheduler)
    case requesting                 // authorization in flight
    case authorized                 // authorized, nothing scheduled
    case scheduled(TrainingReminderSchedule)
    case denied
    case failed(String)
}

@MainActor
private final class TrainingReminderModel: ObservableObject {
    @Published private(set) var status: TrainingReminderStatus = .idle
    /// Picker state — in-RAM only, NEVER persisted; re-seeded from the live pending
    /// schedule on appear (iOS persists the repeating notifications, not the app).
    @Published var selectedWeekdays: Set<Int> = []
    @Published var timeOfDay: Date
    @Published private(set) var nextFireText: String?

    /// The local scheduler. Injectable for previews/tests (nil → not opted in); the
    /// running app opts into the real `UserNotificationsTrainingReminderScheduler`
    /// from the card's `.task`.
    private var scheduler: TrainingReminderScheduling?
    private let now: () -> Date
    private let calendar: Calendar

    init(
        scheduler: TrainingReminderScheduling? = nil,
        now: @escaping () -> Date = { Date() },
        calendar: Calendar = .current
    ) {
        self.scheduler = scheduler
        self.now = now
        self.calendar = calendar
        self.timeOfDay = calendar.date(bySettingHour: 19, minute: 0, second: 0, of: now()) ?? now()
    }

    /// Opt the RUNNING app into the real local scheduler (idempotent). Previews/
    /// tests leave it unset so they never touch UserNotifications.
    func activateLiveSchedulerIfNeeded() {
        #if os(iOS)
        if scheduler == nil { scheduler = UserNotificationsTrainingReminderScheduler() }
        #endif
    }

    var isAuthorized: Bool {
        switch status {
        case .authorized, .scheduled: return true
        default: return false
        }
    }

    /// Show the weekday/time pickers once authorized.
    var showsPickers: Bool { isAuthorized }

    /// Offer the enable button before reminders are authorized.
    var showsEnableButton: Bool {
        switch status {
        case .idle, .denied, .failed, .unavailable: return true
        case .requesting, .authorized, .scheduled: return false
        }
    }

    private var hour: Int { calendar.component(.hour, from: timeOfDay) }
    private var minute: Int { calendar.component(.minute, from: timeOfDay) }

    /// On appear: opt in + reflect the LIVE persisted schedule. An empty pending
    /// set keeps `.idle` (honest — we never prompt without a tap).
    func refresh() async {
        activateLiveSchedulerIfNeeded()
        guard let scheduler else { status = .unavailable; return }
        if let schedule = await scheduler.pendingSchedule() {
            apply(schedule)
        }
    }

    /// User-gated: request LOCAL notification authorization and reveal the pickers.
    func enable() async {
        guard let scheduler else { status = .unavailable; return }
        status = .requesting
        switch await scheduler.requestAuthorization() {
        case .authorized:
            if let schedule = await scheduler.pendingSchedule() {
                apply(schedule)
            } else {
                status = .authorized
            }
        case .denied, .notDetermined:
            status = .denied
        case .unavailable:
            status = .unavailable
        }
    }

    /// Replace the scheduled reminders with the current picker selection. Reads the
    /// live schedule back so the displayed state always reflects reality. Honest
    /// `.failed` on a thrown error — never a fabricated success.
    func save() async {
        guard let scheduler, isAuthorized else { return }
        let requests = TrainingReminderPolicy.makeReminders(
            weekdays: selectedWeekdays, hour: hour, minute: minute
        )
        do {
            try await scheduler.replaceReminders(requests)
            if let schedule = await scheduler.pendingSchedule() {
                apply(schedule)
            } else {
                status = .authorized
                nextFireText = nil
            }
        } catch {
            status = .failed(error.localizedDescription)
        }
    }

    /// Turn reminders off (cancel all of ours). Stays authorized so the user can
    /// re-save without re-prompting.
    func disable() async {
        guard let scheduler, isAuthorized else { return }
        await scheduler.cancelAll()
        status = .authorized
        nextFireText = nil
    }

    private func apply(_ schedule: TrainingReminderSchedule) {
        selectedWeekdays = schedule.weekdays
        timeOfDay = calendar.date(
            bySettingHour: schedule.hour, minute: schedule.minute, second: 0, of: now()
        ) ?? timeOfDay
        status = .scheduled(schedule)
        nextFireText = Self.nextFireText(schedule: schedule, now: now(), calendar: calendar)
    }

    private static func nextFireText(schedule: TrainingReminderSchedule, now: Date, calendar: Calendar) -> String? {
        guard let date = TrainingReminderPolicy.nextFireDate(
            weekdays: schedule.weekdays, hour: schedule.hour, minute: schedule.minute,
            now: now, calendar: calendar
        ) else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.setLocalizedDateFormatFromTemplate("EEEE HH:mm")
        return formatter.string(from: date)
    }
}

private struct TrainingReminderCard: View {
    @StateObject private var model = TrainingReminderModel()

    /// Display order (Monday-first, Chinese) → Calendar weekday (1 = Sun … 7 = Sat).
    private static let weekdays: [(weekday: Int, label: String)] = [
        (2, "一"), (3, "二"), (4, "三"), (5, "四"), (6, "五"), (7, "六"), (1, "日"),
    ]

    var body: some View {
        Section {
            if model.showsEnableButton {
                Button {
                    Task { await model.enable() }
                } label: {
                    HStack {
                        Label("开启训练提醒", systemImage: "bell.badge")
                        Spacer()
                        if case .requesting = model.status { ProgressView() }
                    }
                }
            }

            if model.showsPickers {
                weekdayRow
                DatePicker("提醒时间", selection: $model.timeOfDay, displayedComponents: .hourAndMinute)
                actionRow
            }

            if let line = statusLine {
                Text(line)
                    .font(.footnote)
                    .foregroundStyle(statusIsError ? .red : .secondary)
            }
        } header: {
            Text("训练提醒")
        } footer: {
            Text("按选定的星期与时间，在本机重复提醒你训练 · 不联网 · 无远程推送。提醒由系统在设备上保存与触发。")
        }
        .task { await model.refresh() }
    }

    private var weekdayRow: some View {
        HStack(spacing: 6) {
            ForEach(Self.weekdays, id: \.weekday) { day in
                let isOn = model.selectedWeekdays.contains(day.weekday)
                Button {
                    if isOn { model.selectedWeekdays.remove(day.weekday) }
                    else { model.selectedWeekdays.insert(day.weekday) }
                } label: {
                    Text(day.label)
                        .font(.footnote.weight(.medium))
                        .frame(maxWidth: .infinity, minHeight: 32)
                }
                .buttonStyle(.bordered)
                .tint(isOn ? .accentColor : .secondary)
            }
        }
    }

    private var actionRow: some View {
        HStack {
            Button("保存提醒") {
                Task { await model.save() }
            }
            .buttonStyle(.borderedProminent)
            Spacer()
            if case .scheduled = model.status {
                Button("关闭训练提醒", role: .destructive) {
                    Task { await model.disable() }
                }
            }
        }
    }

    private var statusIsError: Bool {
        if case .failed = model.status { return true }
        return false
    }

    private var statusLine: String? {
        switch model.status {
        case .idle:
            return "开启后，可选择星期与时间，在本机重复提醒你训练。"
        case .unavailable:
            return "当前环境不安排通知。"
        case .requesting:
            return "正在请求通知授权…"
        case .authorized:
            return model.selectedWeekdays.isEmpty
                ? "已授权 · 选择至少一天并点“保存提醒”。"
                : "已授权 · 点“保存提醒”以安排本机提醒。"
        case .scheduled(let schedule):
            var line = "已设 · 每周 \(Self.weekdaysLabel(schedule.weekdays)) \(Self.timeLabel(schedule))"
            if let next = model.nextFireText { line += " · 下次：\(next)" }
            return line
        case .denied:
            return "通知未授权 · 可在系统设置中开启后再试。"
        case .failed(let message):
            return "操作失败：\(message)"
        }
    }

    private static func weekdaysLabel(_ selected: Set<Int>) -> String {
        weekdays.filter { selected.contains($0.weekday) }.map(\.label).joined(separator: "、")
    }

    private static func timeLabel(_ schedule: TrainingReminderSchedule) -> String {
        String(format: "%02d:%02d", schedule.hour, schedule.minute)
    }
}
