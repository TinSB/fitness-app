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

import SwiftUI
import IronPathDomain

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
