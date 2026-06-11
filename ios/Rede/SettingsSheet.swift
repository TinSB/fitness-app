import SwiftUI
import RedeL10n

// 设置（M5-2 完整接管，FR-SE1~SE6 MVP 范围）：单位 / 语言 / 训练背景查看+修改 /
// 数据导出占位 / 健康免责 / 反馈入口。低频入口不占 tab（系统逻辑 §46），保守样式。
// 单位与语言改动即时生效（store）并经写闸持久化；背景修改 = 重跑引导四问（覆盖写）。

struct SettingsSheet: View {
    @Bindable var store: LocaleStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var profile: SessionStore.ProfileSnapshot?
    @State private var showEditAnswers = false

    /// beta 反馈占位通道（FR-SE5 不引入 runtime 网络真相）；正式渠道归 M6-3。
    private let feedbackAddress = "xuhaochen122@gmail.com"

    private var s: RedeStrings { store.strings }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(s.settingsTitle)
                        .font(.redeSubhead)
                        .foregroundStyle(Color.redeT1)
                    Spacer()
                    Button(s.settingsDone) { dismiss() }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color.redeT2)
                        .frame(minHeight: RedeShape.controlHeight)
                        .buttonStyle(.plain)
                }
                .padding(.top, 8)

                // FR-SE1 单位（改动即时生效 + 写闸持久化）
                section(s.settingsUnit) {
                    HStack(spacing: 8) {
                        ForEach(RedeUnit.allCases, id: \.self) { option in
                            SteelButton(title: option.displayName, isOn: store.unit == option) {
                                guard store.unit != option else { return }
                                store.unit = option
                                Task { await sessionStore.savePreferences(unitSystem: option.rawValue, locale: nil) }
                            }
                        }
                    }
                }

                // FR-SE3 语言（M5-2 起持久化）
                section(s.settingsLanguage) {
                    HStack(spacing: 8) {
                        ForEach(RedeLocale.allCases, id: \.self) { option in
                            SteelButton(title: option.displayName, isOn: store.locale == option) {
                                guard store.locale != option else { return }
                                store.locale = option
                                Task { await sessionStore.savePreferences(unitSystem: nil, locale: option.rawValue) }
                            }
                        }
                    }
                }

                // FR-SE2 训练背景（查看 + 修改=重跑引导，改动走写闸并影响后续判断）
                section(s.settingsBackground) {
                    VStack(alignment: .leading, spacing: 0) {
                        if let profile {
                            backgroundRow(s.onbGoalLabel,
                                          profile.primaryGoal.map { s.onbGoalOption($0).title })
                            backgroundRow(s.onbDaysLabel,
                                          profile.weeklyTrainingDays.map { s.settingsDaysValue($0) })
                            backgroundRow(s.onbEquipLabel,
                                          profile.equipmentScenario.map { s.onbEquipOption($0).title })
                            backgroundRow(s.onbLevelLabel,
                                          profile.trainingLevel.map { s.onbLevelOption($0).title })
                        } else {
                            backgroundRow(s.onbGoalLabel, nil)
                            backgroundRow(s.onbLevelLabel, nil)
                        }
                        SteelButton(title: s.settingsEditAnswers) { showEditAnswers = true }
                            .padding(.top, 12)
                    }
                }

                // FR-SE6 数据导出占位（事实陈述）
                section(s.settingsData) {
                    Text(s.settingsExportNote)
                        .font(.redeCallout)
                        .foregroundStyle(Color.redeT3)
                }

                // M6-2 隐私说明（FR-DT4 诚实表达：只说代码可证事实，文案合同见 L10n 测试）
                section(s.settingsPrivacy) {
                    Text(s.settingsPrivacyNote)
                        .font(.redeCallout)
                        .foregroundStyle(Color.redeT3)
                }

                // FR-SE4 免责 + FR-SE5 反馈
                section(s.settingsAbout) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(s.settingsDisclaimer)
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT3)
                        SteelButton(title: s.settingsFeedback) {
                            openURL(URL(string: "mailto:\(feedbackAddress)?subject=Rede%20Feedback")!)
                        }
                    }
                }

                if let errorText = sessionStore.saveErrorText {
                    Text(errorText)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeRisk)
                        .lineLimit(2)
                        .padding(.top, RedeSpace.section)
                }
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
        .task {
            // 审查 MAJOR-2：清掉历史保存错误——本页只显示「设置期间」发生的写入错误，
            // 不把训练存档失败误显示成设置保存失败。
            sessionStore.saveErrorText = nil
            profile = await Task.detached { SessionStore.loadProfileSnapshot() }.value
        }
        .fullScreenCover(isPresented: $showEditAnswers, onDismiss: {
            Task { profile = await Task.detached { SessionStore.loadProfileSnapshot() }.value }
        }) {
            OnboardingView(onFinish: { showEditAnswers = false })
                .environment(store)
                .environment(sessionStore)
        }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Overline(text: title)
            content()
        }
        .padding(.top, RedeSpace.section)
    }

    private func backgroundRow(_ label: String, _ value: String?) -> some View {
        HStack {
            Text(label)
                .font(.redeBody)
                .foregroundStyle(Color.redeT2)
            Spacer()
            Text(value ?? "—")
                .font(.redeBody)
                .monospacedDigit()
                .foregroundStyle(Color.redeT1)
        }
        .padding(.vertical, 9)
        .overlay(alignment: .bottom) { Rectangle().fill(Color.redeHair2).frame(height: 1) }
    }
}

#Preview {
    SettingsSheet(store: LocaleStore())
        .environment(SessionStore())
}
