import SwiftUI
import RedeEntitlements
import RedeL10n
import RedeTrainingDecision

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
    var onCoachAction: (WeeklyCoachReviewAction) -> Void = { _ in }
    @Environment(SessionStore.self) private var sessionStore
    @Environment(SubscriptionModel.self) private var subscriptionModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var profile: SessionStore.ProfileSnapshot?
    /// 周期化开关持久态（FR-PL2 enablement；默认关 = opt-in）。
    @State private var mesocycleOn = false
    @State private var weeklyRestartOn = false
    /// FR-NT1 休息结束提醒开关（默认关 = opt-in；开启先请求系统授权）。
    @State private var notifRestEndOn = false
    /// FR-NT2 每周提醒持久态（切片3 仅加载保全、无 UI；切片4 接开关）。
    @State private var notifWeeklyOn = false
    @State private var notifComebackOn = true
    /// 系统层拒绝授权时显示去 iOS 设置的提示。
    @State private var notifPermissionDenied = false
    /// 通知开关操作进行中（授权/写盘）：串行化 + 禁用开关，防"开→快切关"竞态致磁盘/UI 不一致（审查 MAJOR-2）。
    @State private var isNotifBusy = false
    @State private var health = HealthModel()  // FR-PR8：Apple 健康只读体重展示
    @State private var healthBusy = false
    /// K7 数据导出（FR-SE6 兑现）：读 canonical 成功 → share sheet；失败 → 如实 alert。
    @State private var exportItem: ExportFile?
    @State private var exportBusy = false
    @State private var exportFailed = false
    @State private var showSubscriptionPage = false
    @State private var pendingCoachAction: WeeklyCoachReviewAction?
    @State private var subscriptionManagementFailed = false
    /// 行内单题编辑（方向 A 拍板 2026-06-10：改哪题进哪题，退役整流重跑）。
    @State private var editing: PlateQuestion?
    /// 最近一次保存的变更收据（铭牌下方替换提示行）。
    @State private var editReceipt: String?
    @State private var feedbackFallbackText: String?
    /// 背板折叠态（J5 渐进披露：默认全收起）。
    @State private var expandedInfo: Set<String> = []

    /// M6-3 正式反馈渠道。mailto 交给系统邮件 App；StoreKit 另由 Apple
    /// 服务处理。Rede 自身不上传训练数据，但不能再把整个 runtime 描述成“不连网”。
    /// 2026-06-19 改用 hello@rede.fit（Cloudflare Email Routing 转发到 owner 收件箱），不再暴露个人邮箱。
    private let feedbackAddress = "hello@rede.fit"

    private var s: RedeStrings { store.strings }
    private var subscriptionPagePresentation: SubscriptionPagePresentation {
        SubscriptionPagePolicy.presentation(for: subscriptionModel.launchDecision)
    }

    var body: some View {
        NavigationStack {
            sheetContent
                .navigationDestination(item: $editing) { question in
                    PlateQuestionEditView(
                        question: question,
                        snapshot: profile,
                        onSaved: { receipt, newSnapshot in
                            editReceipt = receipt
                            profile = newSnapshot
                        }
                    )
                    .environment(store)
                    .environment(sessionStore)
                    .toolbar(.hidden, for: .navigationBar)
                }
        }
    }

    private var sheetContent: some View {
        VStack(spacing: 0) {
            header
            if let errorText = sessionStore.settingsSaveErrorText {
                Text(errorText)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeRisk)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 10)
            }
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        preferenceRows
                        EngraveDivider().padding(.top, RedeSpace.section)
                        periodizationSection
                        EngraveDivider().padding(.top, RedeSpace.section)
                        notificationsSection
                        EngraveDivider().padding(.top, RedeSpace.section)
                        healthSection
                        EngraveDivider().padding(.top, RedeSpace.section)
                        dataSection
                            .id("data")   // -settingsScrollTo 锚点
                        EngraveDivider().padding(.top, RedeSpace.section)
                        subscriptionSection
                            .id("subscription")
                        EngraveDivider().padding(.top, RedeSpace.section)
                        backgroundPlate
                        EngraveDivider().padding(.top, RedeSpace.section)
                        backplateInfo
                        feedbackKey
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.bottom, 24)
                }
                .onAppear {
                    // 截图钩子（沿 -progressScrollTo 先例）：-settingsScrollTo <锚点> 滚到
                    // 折叠线以下区块（simctl 无法交互滚动时的审计通道）；未知锚点静默忽略。
                    let args = ProcessInfo.processInfo.arguments
                    if let idx = args.firstIndex(of: "-settingsScrollTo"), args.indices.contains(idx + 1) {
                        let anchor = args[idx + 1]
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            proxy.scrollTo(anchor, anchor: .top)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
        .sensoryFeedback(.selection, trigger: store.unit)
        .sensoryFeedback(.selection, trigger: store.locale)
        // K7：导出成功 → 系统 share sheet（临时文件由系统 tmp 生命周期回收）。
        .sheet(item: $exportItem) { item in
            ExportActivityView(items: [item.url])
        }
        .sheet(isPresented: $showSubscriptionPage, onDismiss: {
            guard let action = pendingCoachAction else { return }
            pendingCoachAction = nil
            onCoachAction(action)
            dismiss()
        }) {
            SubscriptionPageSheet(
                configuration: subscriptionModel.configuration,
                onCoachAction: { action in
                    pendingCoachAction = action
                    showSubscriptionPage = false
                }
            )
                .environment(store)
                .environment(subscriptionModel)
                .presentationDetents([.large])
        }
        // K7：读失败如实提示（dataUnreadable 文案家族），绝不假成功。
        .alert(s.settingsExportFailedTitle, isPresented: $exportFailed) {
            Button(s.settingsExportFailedConfirm, role: .cancel) {}
        } message: {
            Text(s.settingsExportFailedBody)
        }
        .alert(s.settingsSubscriptionOperationFailed, isPresented: $subscriptionManagementFailed) {
            Button(s.settingsExportFailedConfirm, role: .cancel) {}
        }
        .task {
            // 审查 MAJOR-2（M5-2）：清掉历史保存错误——本页只显示「设置期间」的写入错误（设置专属字段，隔离于训练 saveErrorText）。
            sessionStore.settingsSaveErrorText = nil
            profile = await Task.detached { SessionStore.loadProfileSnapshot() }.value
            mesocycleOn = await Task.detached { SessionStore.loadMesocycleEnabled() }.value
            weeklyRestartOn = await Task.detached { SessionStore.loadWeeklyCycleRestart() }.value
            let notif = await Task.detached { SessionStore.loadNotificationPreferences() }.value
            notifRestEndOn = notif.restEnd
            notifWeeklyOn = notif.weekly
            notifComebackOn = notif.comeback
            notifPermissionDenied = false
            await health.loadSilently() // 静默尝试读（不弹框）：之前授权过则直接显示体重
            // 截图钩子（沿 -autoOpenSettings 先例）：-editPlateQuestion <goal|days|equipment|level|sex>
            // 直接打开单题编辑页；未知值忽略
            let args = ProcessInfo.processInfo.arguments
            if let idx = args.firstIndex(of: "-editPlateQuestion"), args.indices.contains(idx + 1),
               let question = PlateQuestion(rawValue: args[idx + 1]) {
                editing = question
            }
            // K7 截图钩子（同上先例）：-autoExportData 打开设置即触发导出（simctl 无法点击 UI）。
            if args.contains("-autoExportData") { exportData() }
        }
    }

    // MARK: - FR-PR8 Apple 健康（只读体重展示）

    private var healthSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Overline(text: s.healthSectionTitle).padding(.top, 18)
            switch health.state {
            case .weight(let sample):
                VStack(alignment: .leading, spacing: 3) {
                    Text(s.healthWeightLine(weight: "\(s.formatKg(sample.kg)) \(s.unitLabel)", dateISO: sample.dateISO))
                        .font(.redeBody).foregroundStyle(Color.redeT1).monospacedDigit()
                    Text(s.healthSourceLabel).font(.redeCaption).foregroundStyle(Color.redeT4)
                }
            case .noData:
                Text(s.healthNoData).font(.redeCaption).foregroundStyle(Color.redeT3)
                    .fixedSize(horizontal: false, vertical: true)
            case .unavailable:
                Text(s.healthUnavailable).font(.redeCaption).foregroundStyle(Color.redeT3)
            case .notConnected, .connecting:
                Button {
                    guard !healthBusy else { return }
                    healthBusy = true
                    Task { await health.connect(); healthBusy = false }
                } label: {
                    Text(health.state == .connecting ? s.healthConnecting : s.healthConnectAction)
                        .font(.redeBody).foregroundStyle(Color.redeEmber2)
                        .frame(minHeight: RedeShape.controlHeight, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.redePressable)
                .disabled(healthBusy)
            }
        }
    }

    // MARK: - FR-SE9 / FR-SUB2 方案与订阅

    private var subscriptionSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Overline(text: s.settingsSubscriptionSection).padding(.top, 18)

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(subscriptionTierLabel)
                    .font(.redeBody)
                    .foregroundStyle(Color.redeT1)
                Spacer()
                if subscriptionModel.entitlement == .checking {
                    ProgressView()
                        .controlSize(.small)
                        .tint(Color.redeT3)
                        .accessibilityLabel(s.settingsSubscriptionChecking)
                }
            }
            .frame(minHeight: RedeShape.controlHeight)

            if let subscriptionStatusNote {
                Text(subscriptionStatusNote)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            subscriptionActionRow(
                title: s.settingsSubscriptionOpenCoach,
                systemImage: "sparkles"
            ) {
                showSubscriptionPage = true
            }

            if subscriptionPagePresentation.showsTransactionControls {
                subscriptionActionRow(
                    title: s.settingsSubscriptionRestore,
                    systemImage: "arrow.clockwise"
                ) {
                    Task { await subscriptionModel.restore() }
                }
                .disabled(subscriptionOperationBusy)

                subscriptionActionRow(
                    title: s.settingsSubscriptionManage,
                    systemImage: "rectangle.portrait.and.arrow.right"
                ) {
                    manageSubscriptions()
                }

                policyLinks
            }

            if case .unknown = subscriptionModel.entitlement {
                Button(s.settingsSubscriptionRetry) {
                    Task { await subscriptionModel.refresh() }
                }
                .font(.redeCaption)
                .foregroundStyle(Color.redeT2)
                .buttonStyle(.redePressable)
            }

            if let operationNote = subscriptionOperationNote {
                Text(operationNote)
                    .font(.redeCaption)
                    .foregroundStyle(subscriptionOperationIsFailure ? Color.redeRisk : Color.redeT3)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("subscription-operation-note")
            }
        }
    }

    private var subscriptionTierLabel: String {
        switch subscriptionModel.entitlement {
        case .checking:
            s.settingsSubscriptionChecking
        case .freeCore:
            s.settingsSubscriptionFreeCore
        case .unknown:
            s.settingsSubscriptionUnknownTier
        case .paidCoach:
            s.settingsSubscriptionPaidCoach
        }
    }

    private var subscriptionStatusNote: String? {
        switch subscriptionModel.entitlement {
        case .checking:
            s.settingsSubscriptionChecking
        case .freeCore:
            nil
        case .unknown:
            s.settingsSubscriptionUnknown
        case .paidCoach(_, let billingState):
            billingState == .gracePeriod
                ? s.settingsSubscriptionGrace
                : s.settingsSubscriptionVerified
        }
    }

    private var subscriptionOperationBusy: Bool {
        switch subscriptionModel.operation {
        case .purchasing, .restoring: true
        default: false
        }
    }

    private var subscriptionOperationIsFailure: Bool {
        if case .failed = subscriptionModel.operation { return true }
        return false
    }

    private var subscriptionOperationNote: String? {
        switch subscriptionModel.operation {
        case .idle, .purchasing:
            nil
        case .restoring:
            s.settingsSubscriptionChecking
        case .pending:
            s.settingsSubscriptionPending
        case .succeeded(.restore):
            s.settingsSubscriptionRestoreSuccess
        case .succeeded(.purchase):
            s.settingsSubscriptionVerified
        case .failed:
            s.settingsSubscriptionOperationFailed
        }
    }

    private func subscriptionActionRow(
        title: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
                    .accessibilityHidden(true)
                Text(title)
                    .font(.redeBody)
                    .foregroundStyle(Color.redeT2)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.redeT4)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: RedeShape.controlHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
    }

    private var policyLinks: some View {
        HStack(spacing: 16) {
            if let privacyURL = subscriptionModel.configuration.privacyPolicyURL {
                Button(s.settingsPrivacy) { openURL(privacyURL) }
            }
            if let termsURL = subscriptionModel.configuration.termsOfUseURL {
                Button(s.settingsSubscriptionTerms) { openURL(termsURL) }
            }
        }
        .font(.redeCaption)
        .foregroundStyle(Color.redeT3)
        .buttonStyle(.redePressable)
    }

    private func manageSubscriptions() {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }) else {
            subscriptionManagementFailed = true
            return
        }
        let groupID: String? = {
            guard case .available(let products) = subscriptionModel.catalog else { return nil }
            return products.first?.subscriptionGroupID
        }()
        Task {
            do {
                try await RedeSubscriptionManagement.show(
                    in: scene,
                    subscriptionGroupID: groupID
                )
                await subscriptionModel.refresh()
            } catch {
                subscriptionManagementFailed = true
            }
        }
    }

    // MARK: - K7 数据（FR-SE6 兑现）：只保留自解释的导出行；owner 2026-07-18
    // 删除常驻说明小字。隐私/关于仍留背板渐进披露。

    private var dataSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Overline(text: s.settingsData).padding(.top, 18)
            Button {
                exportData()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT4)
                        .accessibilityHidden(true)   // 装饰性图标（§16.1，审查 NIT）
                    Text(s.settingsExportAction)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT2)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.redeT4)
                        .accessibilityHidden(true)   // 装饰性 affordance（§16.1）
                }
                .frame(minHeight: RedeShape.controlHeight)
                .contentShape(Rectangle())
            }
            .buttonStyle(.redePressableRow)
            .disabled(exportBusy)
        }
    }

    /// K7 导出：canonical `app-data.json` **原样字节**（不重编码、不挑字段——诚实带走全部数据）
    /// → 系统临时目录落 `rede-export-yyyy-MM-dd.json` → share sheet。全程零写入 canonical；
    /// 读失败/文件缺失如实 alert，绝不产出空文件假成功。
    private func exportData() {
        guard !exportBusy else { return }
        exportBusy = true
        Task {
            defer { exportBusy = false }
            let url = await Task.detached(priority: .userInitiated) { () -> URL? in
                let source = TodayModel.canonicalFileURL()
                guard let data = try? Data(contentsOf: source), !data.isEmpty else { return nil }
                let formatter = DateFormatter()
                formatter.locale = Locale(identifier: "en_US_POSIX")
                formatter.timeZone = .current
                formatter.dateFormat = "yyyy-MM-dd"
                let dest = FileManager.default.temporaryDirectory
                    .appendingPathComponent("rede-export-\(formatter.string(from: Date())).json", isDirectory: false)
                do {
                    try? FileManager.default.removeItem(at: dest) // 同日重复导出：覆盖旧临时文件
                    try data.write(to: dest, options: [.atomic])
                    return dest
                } catch {
                    return nil
                }
            }.value
            if let url {
                exportItem = ExportFile(url: url)
            } else {
                exportFailed = true
            }
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
                .buttonStyle(.redePressable)
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
                    // 切单位后重算今日（§8）：处方目标落新单位真实梯子，不再是旧单位格子裸换算。
                    Task {
                        await sessionStore.savePreferences(unitSystem: unit.rawValue, locale: nil)
                        await sessionStore.loadToday()
                    }
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

    // MARK: - 训练周期开关（FR-PL2 enablement）：label + 钢开关 + 诚实说明。默认关 = opt-in。

    private var periodizationSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Overline(text: s.settingsPeriodizationOverline)
                .padding(.top, 18)
            HStack {
                Text(s.settingsPeriodizationLabel)
                    .font(.redeBody)
                    .foregroundStyle(Color.redeT2)
                Spacer()
                SteelToggle(isOn: Binding(
                    get: { mesocycleOn },
                    set: { newValue in
                        guard newValue != mesocycleOn else { return }
                        mesocycleOn = newValue
                        // 落库后即时重载今日（处方吃相位）；计划页周期条随 tab 切换自刷新。
                        // 写失败回滚开关位（审查 M-1）：UI 与磁盘一致，saveErrorText 已在页头如实提示。
                        Task {
                            if await sessionStore.saveMesocycleEnabled(newValue) {
                                await sessionStore.loadToday()
                            } else {
                                mesocycleOn = !newValue
                            }
                        }
                    }
                ))
            }
            Text(s.settingsPeriodizationNote)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .fixedSize(horizontal: false, vertical: true)

            // 每周循环模式（2026-07-08 owner 拍板「两个都做，设置里切换」）：
            // 默认关=顺延（序列型，漏的训练日下次补）；开=每周从分化第一天重开（日历型）。
            HStack {
                Text(s.settingsWeeklyRestartLabel)
                    .font(.redeBody)
                    .foregroundStyle(Color.redeT2)
                Spacer()
                SteelToggle(isOn: Binding(
                    get: { weeklyRestartOn },
                    set: { newValue in
                        guard newValue != weeklyRestartOn else { return }
                        weeklyRestartOn = newValue
                        Task {
                            if await sessionStore.saveWeeklyCycleRestart(newValue) {
                                await sessionStore.loadToday()
                            } else {
                                weeklyRestartOn = !newValue   // 写失败回滚开关位（同 mesocycle）
                            }
                        }
                    }
                ))
            }
            .padding(.top, 14)
            Text(s.settingsWeeklyRestartNote)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .sensoryFeedback(.selection, trigger: mesocycleOn)
        .sensoryFeedback(.selection, trigger: weeklyRestartOn)
    }

    // 通知（FR-NT1 休息结束 + FR-NT2 每周）：开启先请求系统授权（价值先行 opt-in），被拒回滚 + 指向系统设置。
    private var notificationsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Overline(text: s.notificationsSectionTitle)
                .padding(.top, 18)
            notifToggleRow(
                label: s.notificationRestEndLabel, isOn: { notifRestEndOn },
                persist: { await sessionStore.saveNotificationPreferences(restEndEnabled: $0, weeklyEnabled: notifWeeklyOn, comebackEnabled: notifComebackOn) },
                setLocal: { notifRestEndOn = $0 }
            )
            notifToggleRow(
                label: s.notificationWeeklyLabel, isOn: { notifWeeklyOn },
                persist: { await sessionStore.saveNotificationPreferences(restEndEnabled: notifRestEndOn, weeklyEnabled: $0, comebackEnabled: notifComebackOn) },
                setLocal: { notifWeeklyOn = $0 }
            )
            // FR-NT3 召回（批次 F）：缺省开——久未训练时按 5/12/21 天各提醒一次
            notifToggleRow(
                label: s.notificationComebackLabel, isOn: { notifComebackOn },
                persist: { await sessionStore.saveNotificationPreferences(restEndEnabled: notifRestEndOn, weeklyEnabled: notifWeeklyOn, comebackEnabled: $0) },
                setLocal: { notifComebackOn = $0 }
            )
            if notifPermissionDenied {
                Text(s.notificationPermissionDeniedHint)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeRisk)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .sensoryFeedback(.selection, trigger: notifRestEndOn)
        .sensoryFeedback(.selection, trigger: notifWeeklyOn)
    }

    /// 单个通知开关行 + 说明。UI 态写盘**成功后**才置（与磁盘一致）；isNotifBusy 串行化 + .disabled
    /// 防授权/写盘期间并发切换竞态（审查 MAJOR-2）；开启先请求系统授权（价值先行）。
    @ViewBuilder
    private func notifToggleRow(
        label: String, isOn: @escaping () -> Bool,
        persist: @escaping (Bool) async -> Bool, setLocal: @escaping (Bool) -> Void
    ) -> some View {
        HStack {
            Text(label).font(.redeBody).foregroundStyle(Color.redeT2)
            Spacer()
            SteelToggle(isOn: Binding(
                get: isOn,
                set: { newValue in
                    guard newValue != isOn(), !isNotifBusy else { return }
                    isNotifBusy = true
                    if newValue {
                        Task {
                            defer { isNotifBusy = false }
                            guard await sessionStore.requestNotificationAuthorization() else { notifPermissionDenied = true; return }
                            notifPermissionDenied = false
                            if await persist(true) { setLocal(true) }
                        }
                    } else {
                        notifPermissionDenied = false
                        Task {
                            defer { isNotifBusy = false }
                            if await persist(false) { setLocal(false) }
                        }
                    }
                }
            ))
            .disabled(isNotifBusy)
        }
        // 开关说明副文已删（owner：标题自解释，副文太重）。授权被拒的提示仍在 section 级保留。
    }

    // MARK: - 设备铭牌（唯一 hero）：训练背景 spec plate + 修改回答（FR-SE2）

    private var backgroundPlate: some View {
        VStack(alignment: .leading, spacing: 0) {
            Overline(text: s.settingsBackground)
                .padding(.top, 18)
            ForgedCard(showReg: true) {
                VStack(spacing: 0) {
                    plateRow(s.onbGoalLabel, profile?.primaryGoal.map { s.onbGoalOption($0).title }, question: .goal)
                    plateDivider
                    plateRow(s.onbDaysLabel, profile?.weeklyTrainingDays.map { s.settingsDaysValue($0) }, question: .days)
                    plateDivider
                    plateRow(s.onbEquipLabel, profile?.equipmentScenario.map { s.onbEquipOption($0).title }, question: .equipment)
                    plateDivider
                    plateRow(s.settingsSelfReportedBackgroundLabel, profile?.trainingLevel.map { s.onbLevelOption($0).title }, question: .level)  // 自报输入≠系统等级（FR-PR6 上线后区分，§6.5.14）
                    plateDivider
                    plateRow(s.settingsSexLabel, profile?.sex.map { s.settingsSexOption($0).title }, question: .sex)  // 可选（批次 D：仅相对力量标准用；未设显示 —）
                }
                .padding(.vertical, 5)
                .padding(.horizontal, 16)
            }
            .padding(.top, 9)
            // 只在保存后显示短暂变更收据；不常驻“点任意一行修改”说明小字。
            if let editReceipt {
                Text(editReceipt)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
                    .padding(.top, 10)
            }
        }
    }

    /// 四答齐全才允许行内编辑（异常档案保持只读铭牌，不进编辑流）。
    private var profileComplete: Bool {
        profile?.primaryGoal != nil && profile?.weeklyTrainingDays != nil
            && profile?.equipmentScenario != nil && profile?.trainingLevel != nil
    }

    private var plateDivider: some View {
        Rectangle().fill(Color.redeHair2).frame(height: 1)
    }

    private func plateRow(_ label: String, _ value: String??, question: PlateQuestion) -> some View {
        Button {
            guard profileComplete else { return }
            editing = question
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Overline(text: label)
                Spacer()
                Text((value ?? nil) ?? "—")
                    .font(.system(size: 15, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT1)
                // 审查 NIT-1：档案不完整时铭牌只读，不显示「能点」的暗示
                if profileComplete {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.redeT4)
                }
            }
            .padding(.vertical, 9)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
        .accessibilityHint(profileComplete ? s.settingsPlateAccessibilityHint : "")
    }

    // MARK: - 背板蚀刻：数据/隐私/关于 渐进披露（默认收起）

    private var backplateInfo: some View {
        VStack(spacing: 0) {
            // 「数据」行已上移成 dataSection（K7：单一导出入口，避免双标题）。
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
            .buttonStyle(.redePressableRow)
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

// MARK: - Rede Coach 页面（品牌页始终可见；购买控件仍由 launch gate 锁闭）

private struct SubscriptionPageSheet: View {
    let configuration: SubscriptionConfiguration
    let onCoachAction: (WeeklyCoachReviewAction) -> Void
    @Environment(LocaleStore.self) private var localeStore
    @Environment(SubscriptionModel.self) private var subscriptionModel
    @Environment(\.dismiss) private var dismiss

    private var s: RedeStrings { localeStore.strings }
    private var products: [SubscriptionProduct] {
        guard case .available(let products) = subscriptionModel.catalog else { return [] }
        return products
    }
    private var pagePresentation: SubscriptionPagePresentation {
        SubscriptionPagePolicy.presentation(for: subscriptionModel.launchDecision)
    }
    private var currentPlan: String {
        switch subscriptionModel.entitlement {
        case .checking:
            s.settingsSubscriptionChecking
        case .freeCore:
            s.settingsSubscriptionFreeCore
        case .unknown:
            s.settingsSubscriptionUnknownTier
        case .paidCoach:
            s.settingsSubscriptionPaidCoach
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Overline(text: s.settingsSubscriptionPaidCoach, color: .redeT3)
                Spacer()
                Button(s.settingsDone) { dismiss() }
                    .font(.redeBody)
                    .foregroundStyle(Color.redeT2)
                    .buttonStyle(.redePressable)
            }
            .padding(.horizontal, RedeSpace.page)
            .frame(height: 58)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.redeHair2).frame(height: 1)
            }

            if FeatureAccessPolicy.allows(
                .paidCoach,
                entitlement: subscriptionModel.entitlement
            ) {
                // Access gate and launch gate are intentionally separate: a verified subscriber
                // keeps Paid Coach even when product catalog/purchase presentation is unavailable.
                WeeklyCoachReviewView(onAction: onCoachAction)
            } else {
                switch pagePresentation {
                case .preparing, .unavailable:
                    previewContent(pagePresentation)
                case .store:
                    storeContent
                }
            }
        }
        .background(Color.redeBase.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .accessibilityIdentifier("subscription-page")
        .onDisappear {
            Task { await subscriptionModel.refresh() }
        }
    }

    private func previewContent(_ presentation: SubscriptionPagePresentation) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                brandHeader

                EngraveDivider()
                    .padding(.vertical, RedeSpace.section)

                VStack(alignment: .leading, spacing: 10) {
                    Overline(text: s.subscriptionPageCurrentPlan)
                    Text(currentPlan)
                        .font(.redeHeadline)
                        .foregroundStyle(Color.redeT1)
                }

                EngraveDivider()
                    .padding(.vertical, RedeSpace.section)

                previewStatus(presentation)
                    .accessibilityElement(children: .combine)
                    .accessibilityIdentifier(
                        presentation == .preparing
                            ? "subscription-page-preparing"
                            : "subscription-page-unavailable"
                    )
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RedeSpace.page)
            .padding(.bottom, 36)
        }
    }

    private var storeContent: some View {
        RedeSubscriptionStoreView(configuration: configuration, products: products) {
            VStack(alignment: .leading, spacing: 14) {
                Text(s.settingsSubscriptionPaidCoach)
                    .font(.redeTitle)
                    .foregroundStyle(Color.redeT1)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(alignment: .firstTextBaseline) {
                    Text(s.subscriptionPageCurrentPlan)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT3)
                    Spacer()
                    Text(currentPlan)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 12)
        }
        .tint(Color.redeEmber2)
        .accessibilityIdentifier("subscription-page-store")
    }

    @ViewBuilder
    private func previewStatus(_ presentation: SubscriptionPagePresentation) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            switch presentation {
            case .preparing:
                Overline(text: s.subscriptionPagePreparingOverline, color: .redeEmber2)
                Text(s.subscriptionPagePreparingTitle)
                    .font(.redeHeadline)
                    .foregroundStyle(Color.redeT1)
                    .fixedSize(horizontal: false, vertical: true)
                previewStatusLine(s.subscriptionPageNotOpen)
            case .unavailable:
                Overline(text: s.subscriptionPageUnavailableOverline, color: .redeCaution)
                Text(s.subscriptionPageUnavailableTitle)
                    .font(.redeHeadline)
                    .foregroundStyle(Color.redeT1)
                    .fixedSize(horizontal: false, vertical: true)
                previewStatusLine(s.subscriptionPageFreeCoreAvailable)
            case .store:
                EmptyView()
            }
        }
    }

    private func previewStatusLine(_ text: String) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color.redeT4)
                .frame(width: 6, height: 6)
                .accessibilityHidden(true)
            Text(text)
                .font(.redeBody)
                .foregroundStyle(Color.redeT2)
        }
    }

    private var brandHeader: some View {
        Text(s.settingsSubscriptionPaidCoach)
            .font(.redeTitle)
            .foregroundStyle(Color.redeT1)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 28)
    }
}

// MARK: - K7 导出载体（.sheet(item:) 驱动 + 系统 share sheet 包装，沿 ShareCardPreviewView 先例）

private struct ExportFile: Identifiable {
    let id = UUID()
    let url: URL
}

private struct ExportActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

// MARK: - 行内单题编辑（方向 A 拍板 2026-06-10）

enum PlateQuestion: String, Identifiable, Hashable {
    case goal, days, equipment, level, sex
    var id: String { rawValue }
}

/// 单题编辑：预填当前答案；显式保存（dirty 才可点）/ 取消（任何状态可退，
/// 含保存失败——修复旧编辑流「写失败被困死」）；保存成功回传变更收据。
/// 整屏唯一 ember = 保存键（S1）。
struct PlateQuestionEditView: View {
    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.dismiss) private var dismiss

    let question: PlateQuestion
    let snapshot: SessionStore.ProfileSnapshot?
    let onSaved: (String, SessionStore.ProfileSnapshot?) -> Void

    @State private var goal: String?
    @State private var days: Int?
    @State private var equipment: String?
    @State private var level: String?
    @State private var sexCode: String = "not-set"   // 批次 D：三值编码（male/female/not-set）
    @State private var saving = false
    @State private var failed = false
    @State private var selectionPulse = 0

    init(question: PlateQuestion, snapshot: SessionStore.ProfileSnapshot?,
         onSaved: @escaping (String, SessionStore.ProfileSnapshot?) -> Void) {
        self.question = question
        self.snapshot = snapshot
        self.onSaved = onSaved
        _goal = State(initialValue: snapshot?.primaryGoal)
        _days = State(initialValue: snapshot?.weeklyTrainingDays)
        _equipment = State(initialValue: snapshot?.equipmentScenario)
        _level = State(initialValue: snapshot?.trainingLevel)
        _sexCode = State(initialValue: snapshot?.sex ?? "not-set")
    }

    private var s: RedeStrings { localeStore.strings }

    private var dirty: Bool {
        if question == .sex { return sexCode != (snapshot?.sex ?? "not-set") }
        return goal != snapshot?.primaryGoal || days != snapshot?.weeklyTrainingDays
            || equipment != snapshot?.equipmentScenario || level != snapshot?.trainingLevel
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Overline(text: s.settingsBackground)
                    Text(questionLabel)
                        .font(.redeHeadline)
                        .tracking(RedeTracking.headline)
                        .foregroundStyle(Color.redeT1)
                }
                Spacer()
                Button(s.onbEditCancel) { dismiss() }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.redeT2)
                    .frame(minWidth: 44, minHeight: 44, alignment: .bottomTrailing)
                    .buttonStyle(.redePressable)
            }
            .padding(.top, 14)
            .padding(.bottom, 12)
            .overlay(alignment: .bottom) { Rectangle().fill(Color.redeHair2).frame(height: 1) }

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForgedCard {
                        VStack(alignment: .leading, spacing: 0) {
                            questionBody
                        }
                        .padding(.vertical, 18)
                        .padding(.horizontal, RedeSpace.card)
                    }
                    .padding(.top, 16)

                    if failed {
                        Text(s.onbWriteFailed)
                            .font(.redeCallout)
                            .foregroundStyle(Color.redeRisk)
                            .padding(.top, 12)
                        if let detail = sessionStore.settingsSaveErrorText {
                            Text(detail)
                                .font(.redeCaption)
                                .foregroundStyle(Color.redeT4)
                                .lineLimit(2)
                                .padding(.top, 2)
                        }
                    }

                    EmbButton(icon: "checkmark", title: s.onbEditSave) { save() }
                        .disabled(!dirty || saving)
                        .opacity((!dirty || saving) ? 0.45 : 1)
                        .padding(.top, 16)
                }
                .padding(.bottom, 24)
            }
        }
        .padding(.horizontal, RedeSpace.page)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.redeBase)
        .sensoryFeedback(.selection, trigger: selectionPulse)
    }

    private var questionLabel: String {
        switch question {
        case .goal: s.onbGoalLabel
        case .days: s.onbDaysLabel
        case .equipment: s.onbEquipLabel
        case .level: s.onbLevelLabel
        case .sex: s.settingsSexLabel
        }
    }

    @ViewBuilder private var questionBody: some View {
        switch question {
        case .goal:
            editTitle(s.onbGoalQuestion)
            OnbOptionRows(codes: ["hypertrophy", "strength", "general"],
                          selected: goal, option: s.onbGoalOption) { goal = $0; selectionPulse += 1 }
        case .days:
            editTitle(s.onbDaysQuestion)
            Text(s.onbDaysNote)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT4)
                .padding(.top, 4)
            OnbDaysBand(selected: days, daysLabel: s.settingsDaysValue) { days = $0; selectionPulse += 1 }
        case .equipment:
            editTitle(s.onbEquipQuestion)
            OnbOptionRows(codes: ["commercial-gym", "home-dumbbell", "minimal"],
                          selected: equipment, option: s.onbEquipOption) { equipment = $0; selectionPulse += 1 }
        case .level:
            editTitle(s.onbLevelQuestion)
            Text(s.onbLevelNote)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT4)
                .padding(.top, 4)
            OnbOptionRows(codes: ["beginner", "intermediate", "advanced"],
                          selected: level, option: s.onbLevelOption) { level = $0; selectionPulse += 1 }
        case .sex:
            editTitle(s.settingsSexQuestion)
            Text(s.settingsSexNote)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT4)
                .padding(.top, 4)
            OnbOptionRows(codes: ["male", "female", "not-set"],
                          selected: sexCode, option: s.settingsSexOption) { sexCode = $0; selectionPulse += 1 }
        }
    }

    private func editTitle(_ text: String) -> some View {
        Text(text)
            .font(.redeHeadline)
            .foregroundStyle(Color.redeT1)
    }

    private func save() {
        guard !saving else { return }
        if question == .sex {
            // 单字段 scalar 写（applySexPreference），不走四答全量重写
            saving = true
            failed = false
            Task {
                let ok = await sessionStore.saveSex(sexCode == "not-set" ? nil : sexCode)
                saving = false
                if ok {
                    let receipt = receiptLine()
                    let fresh = await Task.detached { SessionStore.loadProfileSnapshot() }.value
                    onSaved(receipt, fresh)
                    dismiss()
                } else {
                    failed = true
                }
            }
            return
        }
        guard let goal, let days, let equipment, let level else { return }
        saving = true
        failed = false
        Task {
            let ok = await sessionStore.completeOnboarding(OnboardingAnswers(
                primaryGoal: goal, weeklyDays: days, equipmentScenario: equipment, trainingLevel: level
            ))
            saving = false
            if ok {
                let receipt = receiptLine()
                let fresh = await Task.detached { SessionStore.loadProfileSnapshot() }.value
                onSaved(receipt, fresh)
                dismiss()
            } else {
                // completeOnboarding 失败写的是训练 saveErrorText（与引导流共用）；本子编辑屏属设置语境，
                // 把错误移到 settingsSaveErrorText 并清训练字段——错误只在设置页显示、不污染训练小结（审查 M-2）。
                sessionStore.settingsSaveErrorText = sessionStore.saveErrorText
                sessionStore.saveErrorText = nil
                failed = true
            }
        }
    }

    /// 变更收据：「频率 每周 5 天 → 每周 6 天」；分化随之变化时追加「上下分化 → 推拉腿」。
    private func receiptLine() -> String {
        if question == .sex {
            let oldTitle = snapshot?.sex.map { s.settingsSexOption($0).title }
            let newTitle = s.settingsSexOption(sexCode).title
            return "\(s.settingsSexLabel) \(oldTitle ?? "—") → \(newTitle)"
        }
        var parts: [String] = []
        func add(_ label: String, _ oldValue: String?, _ newValue: String?) {
            if oldValue != newValue, let newValue {
                parts.append("\(label) \(oldValue ?? "—") → \(newValue)")
            }
        }
        add(s.onbGoalLabel, snapshot?.primaryGoal.map { s.onbGoalOption($0).title }, goal.map { s.onbGoalOption($0).title })
        add(s.onbDaysLabel, snapshot?.weeklyTrainingDays.map { s.settingsDaysValue($0) }, days.map { s.settingsDaysValue($0) })
        add(s.onbEquipLabel, snapshot?.equipmentScenario.map { s.onbEquipOption($0).title }, equipment.map { s.onbEquipOption($0).title })
        add(s.onbLevelLabel, snapshot?.trainingLevel.map { s.onbLevelOption($0).title }, level.map { s.onbLevelOption($0).title })
        // 模板分化对比（OnboardingPlanInit 纯函数，无 IO）
        if let goal, let days, let equipment, let level,
           let og = snapshot?.primaryGoal, let od = snapshot?.weeklyTrainingDays,
           let oe = snapshot?.equipmentScenario, let ol = snapshot?.trainingLevel {
            let newTemplate = OnboardingPlanInit.template(for: OnboardingAnswers(
                primaryGoal: goal, weeklyDays: days, equipmentScenario: equipment, trainingLevel: level))
            let oldTemplate = OnboardingPlanInit.template(for: OnboardingAnswers(
                primaryGoal: og, weeklyDays: od, equipmentScenario: oe, trainingLevel: ol))
            if newTemplate.splitType != oldTemplate.splitType {
                parts.append("\(s.onbSplitName(oldTemplate.splitType)) → \(s.onbSplitName(newTemplate.splitType))")
            }
        }
        return parts.joined(separator: " · ")
    }
}

#Preview {
    SettingsSheet(store: LocaleStore())
        .environment(SessionStore())
}
