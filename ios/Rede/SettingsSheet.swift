import SwiftUI
import RedeL10n

// 设置（M5-2 功能壳 → 2026-06-10 工艺重做，owner 拍板方向 B「信号键」，
// 设计真相 rede-app.html #ovl-settings，方向稿 rede-12-settings-instrument.html）。
// 检修面板架构：固定铭牌头（overline 型号行 + headline，完成不随滚动走）
// + 机加工分段开关（凹槽轨，选中=色调抬升不点 ember，H2）
// + 设备铭牌 spec plate = 唯一 hero（锻面+registration+仪表字阶，S3/S5/K2）
// + S2 刻线分组 + 背板蚀刻渐进披露（默认收起，J5）
// + ember 仅一处 = 发送反馈（面板唯一向外动作，S1/A2-6）。
// 保存失败提示钉在头部下方（任何滚动位置可见）。

struct SettingsSheet: View {
    @Bindable var store: LocaleStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var profile: SessionStore.ProfileSnapshot?
    @State private var showEditAnswers = false
    @State private var feedbackFallbackText: String?
    /// 背板折叠态（J5 渐进披露：默认全收起）。
    @State private var expandedInfo: Set<String> = []

    /// M6-3 正式反馈渠道（owner 确认 2026-06-10）。mailto 外部拉起，
    /// 不算 app runtime 网络真相（隐私文案「不连网」仍属实）。
    private let feedbackAddress = "xuhaochen122@gmail.com"

    private var s: RedeStrings { store.strings }

    var body: some View {
        VStack(spacing: 0) {
            header
            if let errorText = sessionStore.saveErrorText {
                Text(errorText)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeRisk)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 10)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    preferenceRows
                    EngraveDivider().padding(.top, RedeSpace.section)
                    backgroundPlate
                    EngraveDivider().padding(.top, RedeSpace.section)
                    backplateInfo
                    feedbackKey
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.bottom, 24)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
        .sensoryFeedback(.selection, trigger: store.unit)
        .sensoryFeedback(.selection, trigger: store.locale)
        .task {
            // 审查 MAJOR-2（M5-2）：清掉历史保存错误——本页只显示「设置期间」的写入错误。
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

    // MARK: - 面板铭牌头（固定，不随滚动走）

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Overline(text: s.settingsPanelOverline)
                Text(s.settingsTitle)
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .foregroundStyle(Color.redeT1)
            }
            Spacer()
            Button(s.settingsDone) { dismiss() }
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.redeT2)
                .frame(minWidth: 44, minHeight: 44, alignment: .bottomTrailing)
                .buttonStyle(.plain)
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Color.redeHair2).frame(height: 1) }
    }

    // MARK: - 偏好：label 左 + 机加工分段开关 右（FR-SE1/SE3，改动即时生效 + 写闸持久化）

    private var preferenceRows: some View {
        VStack(spacing: 12) {
            preferenceRow(s.settingsUnit, options: RedeUnit.allCases.map(\.displayName), selection: Binding(
                get: { store.unit.displayName },
                set: { picked in
                    guard let unit = RedeUnit.allCases.first(where: { $0.displayName == picked }),
                          unit != store.unit else { return }
                    store.unit = unit
                    Task { await sessionStore.savePreferences(unitSystem: unit.rawValue, locale: nil) }
                }
            ))
            preferenceRow(s.settingsLanguage, options: RedeLocale.allCases.map(\.displayName), selection: Binding(
                get: { store.locale.displayName },
                set: { picked in
                    guard let locale = RedeLocale.allCases.first(where: { $0.displayName == picked }),
                          locale != store.locale else { return }
                    store.locale = locale
                    Task { await sessionStore.savePreferences(unitSystem: nil, locale: locale.rawValue) }
                }
            ))
        }
        .padding(.top, 16)
    }

    private func preferenceRow(_ label: String, options: [String], selection: Binding<String>) -> some View {
        HStack {
            Text(label)
                .font(.redeBody)
                .foregroundStyle(Color.redeT2)
            Spacer()
            SegControl(options: options, selection: selection, machined: true)
                .frame(width: 168)
        }
    }

    // MARK: - 设备铭牌（唯一 hero）：训练背景 spec plate + 修改回答（FR-SE2）

    private var backgroundPlate: some View {
        VStack(alignment: .leading, spacing: 0) {
            Overline(text: s.settingsBackground)
                .padding(.top, 18)
            ForgedCard(showReg: true) {
                VStack(spacing: 0) {
                    plateRow(s.onbGoalLabel, profile?.primaryGoal.map { s.onbGoalOption($0).title })
                    plateDivider
                    plateRow(s.onbDaysLabel, profile?.weeklyTrainingDays.map { s.settingsDaysValue($0) })
                    plateDivider
                    plateRow(s.onbEquipLabel, profile?.equipmentScenario.map { s.onbEquipOption($0).title })
                    plateDivider
                    plateRow(s.onbLevelLabel, profile?.trainingLevel.map { s.onbLevelOption($0).title })
                }
                .padding(.vertical, 5)
                .padding(.horizontal, 16)
            }
            .padding(.top, 9)
            HStack {
                Text(s.settingsEditAnswersNote)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
                Spacer()
                SteelButton(title: s.settingsEditAnswers) { showEditAnswers = true }
            }
            .padding(.top, 10)
        }
    }

    private var plateDivider: some View {
        Rectangle().fill(Color.redeHair2).frame(height: 1)
    }

    private func plateRow(_ label: String, _ value: String??) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Overline(text: label)
            Spacer()
            Text((value ?? nil) ?? "—")
                .font(.system(size: 15, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Color.redeT1)
        }
        .padding(.vertical, 9)
    }

    // MARK: - 背板蚀刻：数据/隐私/关于 渐进披露（默认收起）

    private var backplateInfo: some View {
        VStack(spacing: 0) {
            infoRow(id: "data", title: s.settingsData, detail: s.settingsExportNote)
            infoRow(id: "privacy", title: s.settingsPrivacy, detail: s.settingsPrivacyNote)
            infoRow(id: "about", title: s.settingsAbout, detail: s.settingsDisclaimer)
        }
        .padding(.top, 14)
    }

    private func infoRow(id: String, title: String, detail: String) -> some View {
        let expanded = expandedInfo.contains(id)
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                // 审查 MINOR-1：守项目 reduce-motion 约定（同 TrainTabView/OnboardingView）
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) {
                    if expanded { expandedInfo.remove(id) } else { expandedInfo.insert(id) }
                }
            } label: {
                HStack {
                    Text(title)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT2)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.redeT4)
                        .rotationEffect(.degrees(expanded ? 180 : 0))
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if expanded {
                Text(detail)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
                    .padding(.bottom, 12)
            }
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
    }

    // MARK: - 信号键：发送反馈 = 全面板唯一 ember（FR-SE5/M6-3）

    private var feedbackKey: some View {
        VStack(alignment: .leading, spacing: 10) {
            EmbButton(icon: "envelope", title: s.settingsFeedback) { sendFeedback() }
            if let feedbackFallbackText {
                Text(feedbackFallbackText)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
                    .textSelection(.enabled)
            }
        }
        .padding(.top, 18)
    }

    /// M6-3 一键反馈：主题带版本，正文带上下文行（版本/系统/机型/语言/单位）——
    /// 全部在 compose 窗口对用户可见、可删，透明不偷带。mailto 打不开时如实给地址。
    private func sendFeedback() {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        let model = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? hardwareModel()
        let context = "Rede \(version) (\(build)) · iOS \(UIDevice.current.systemVersion) · \(model) · \(store.locale.rawValue) · \(store.unit.rawValue)"
        var comps = URLComponents()
        comps.scheme = "mailto"
        comps.path = feedbackAddress
        comps.queryItems = [
            URLQueryItem(name: "subject", value: s.feedbackSubject(version: version)),
            URLQueryItem(name: "body", value: "\(s.feedbackBodyPrompt)\n\n—\n\(context)"),
        ]
        guard let url = comps.url else {
            feedbackFallbackText = s.feedbackFallback(address: feedbackAddress)
            return
        }
        openURL(url) { accepted in
            feedbackFallbackText = accepted ? nil : s.feedbackFallback(address: feedbackAddress)
        }
    }

    private func hardwareModel() -> String {
        var sys = utsname()
        uname(&sys)
        return withUnsafePointer(to: &sys.machine) { ptr in
            ptr.withMemoryRebound(to: CChar.self, capacity: Int(_SYS_NAMELEN)) { String(cString: $0) }
        }
    }
}

#Preview {
    SettingsSheet(store: LocaleStore())
        .environment(SessionStore())
}
