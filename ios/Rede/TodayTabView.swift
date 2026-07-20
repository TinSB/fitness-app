import SwiftUI
import RedeL10n
import RedeLocalSnapshot
import RedeTrainingDecision

// Today — 按 rede-app.html #s-today 复原。
// M2-3：引擎真数据接入（裁决+处方），视觉与 M0-2 静态复原完全一致、只换数据源。
// 文案走 RedeL10n 双语 key/模板（引擎零文案）；重量 kg 口径（FR-SE1 落地前不硬编码 lb）。

struct TodayTabView: View {
    let onStartTraining: () -> Void
    /// FR-T5 修数据卡「去核对」：跳到进展页数据质量区（跨 tab；由 RootTabView 切 selection）。
    var onReviewData: () -> Void = {}
    /// FR-SUB3 正常复盘行动：打开进展页顶部，不强制滚到数据质量区。
    var onViewProgress: () -> Void = {}
    /// K3「下一场」预告行：跳计划页（跨 tab；由 RootTabView 切 selection）。
    var onGoPlan: () -> Void = {}

    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(AppUpdateModel.self) private var appUpdateModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    // 截图钩子（沿 -initialTab 先例）：-expandTodayReason 启动即展开依据抽屉
    @State private var reasonExpanded = ProcessInfo.processInfo.arguments.contains("-expandTodayReason")
    @State private var showSettings = false
    /// 初始 Today 读取完成后才允许自动 What's New，避免抢在恢复训练面板前弹出。
    @State private var initialTodayLoadComplete = false
    /// 嵌套 Rede Coach sheet 先全部关闭，再在 Settings sheet 的 onDismiss 切 tab，
    /// 避免 dismissal 与 tab navigation 同帧竞争。
    @State private var pendingCoachAction: WeeklyCoachReviewAction?
    /// FR-EX2：点开的动作详情目标（nil = 未打开）。
    @State private var detailTarget: ExerciseDetailTarget?
    /// FR-TR6：点了某替代动作后，先弹「只换这次 / 以后都换」二选一，选完才写（携带写所需信息）。
    @State private var pendingSwap: PendingSwap?
    /// FR-TR12「今天换一天练」：①选训练日的对话框 ②选了某天后的单次/永久二选一 ③永久分支打开顺序编辑器。
    @State private var showDayPicker = false
    @State private var pendingDayOverride: String?
    @State private var showSequenceEditor = false
    /// 永久分支信号：在「换一天练」面板关闭**之后**再开顺序编辑器（onDismiss 接力，避免同批次 dismiss+present 的竞争）。
    @State private var pendingSequenceEditor = false
    /// FR-T5 切片6c：采纳后的撤销条（瞬态，挂今日页根 overlay，独立于教练卡生命周期——
    /// 抗"写后 reload 卡消失"导致撤销入口蒸发）。约 5s 自动淡出。
    @State private var undoBanner: UndoBanner?
    /// 触感脉冲（采纳/撤销=成功确认，暂不/展开折叠=轻选择）：成功分支自增触发 .sensoryFeedback。
    @State private var commitPulse = 0
    @State private var selectPulse = 0
    /// T1/K3 最近一场总结（无处方分支从已落盘历史派生；nil = 数据缺退回原状）。
    /// K3（2026-07-16）放宽 today-only：休息日/停练回归日显「上一场」，练完态仍显「今天这场」。
    @State private var completedDigest: TodayCompletedDigest?
    /// N3b：近 5 场（含当场）总体量，旧→新——总结卡吨位行小折线用；<2 场不渲染（单点无意义）。
    @State private var recentVolumes: [CGFloat] = []
    /// K3「下一场」预告（PlanDayProjection 现成投影；nil = 无排期不渲染）。
    @State private var nextSession: PlanDayProjection?
    /// K4 练完态「本周」合计吨位（snapshot.weeklyVolume 当前 ISO 周桶——与总结卡总量
    /// 同一 snapshot 口径，同屏数字必对账；nil = 本周无桶/未加载不渲染）。
    @State private var weekVolumeKg: Double?
    /// T1 练完态分享入口打开的预览（复用训练小结同款载体与预览视图）。
    @State private var sharePreview: SharePreviewItem?
    /// K8 周一「上周收官」行（PRD-4 周初叙事雏形；nil = 非周一/上周零训练/数据缺 → 不渲染）。
    @State private var weekReview: WeekReview?

    /// K8 数据载体：上周天数（cleanView 日期去重，单位=天）+ 上周吨位（snapshot 周桶）
    /// + 较上上周百分比（上上周无桶/零吨位 → nil 只报事实）。
    private struct WeekReview: Equatable {
        let days: Int
        let volumeKg: Double
        let deltaPercent: Int?
    }

    private var model: TodayModel? { sessionStore.todayModel }

    private var isUnreadable: Bool {
        if case .unreadable? = sessionStore.todayOutcome { return true }
        return false
    }

    private var s: RedeStrings { localeStore.strings }

    // 截图钩子（沿 -expandTodayReason 先例）：-todayStartAtBottom 打开即停在页底
    //（simctl 无法交互滚动；供实拍页底更新行等低频区）。
    private static let startAtBottom = ProcessInfo.processInfo.arguments.contains("-todayStartAtBottom")

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(
                    title: s.todayTitle,
                    subtitle: model.map { s.dateLine($0.now) } ?? "",
                    trailingIcon: "gearshape",
                    trailingAccessibilityLabel: s.settingsTitle,
                    onTrailingTap: { showSettings = true }
                )

                todayContent

                // FR-SE10 更新信号（2026-07-20 收敛）：低频运维信息移页底 receipt 区之后，
                // 不再压在训练判断上方；设置页「版本与更新」常驻入口保证可发现性。
                if let version = appUpdateModel.promptVersion {
                    AppUpdateSignalStrip(version: version)
                        .padding(.top, 28)
                        .transition(reduceMotion
                            ? .opacity
                            : .move(edge: .bottom).combined(with: .opacity))
                }
            }
            .padding(.bottom, RedeSpace.bottomBar)
        }
        .defaultScrollAnchor(Self.startAtBottom ? .bottom : .top)
        .background(Color.redeBase)
        // 切片6c：撤销条挂今日页根、避开 tab 栏；独立于教练卡，卡 reload 消失也不丢撤销入口。
        .overlay(alignment: .bottom) {
            if let banner = undoBanner {
                undoBannerView(banner)
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: undoBanner?.id)
        // 教练卡 / 写失败提示的出现消失（采纳/暂不后随 reload 变化）= 过渡，不硬闪（reduceMotion 守卫）。
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: coachAction?.actionKey)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: sessionStore.coachSaveErrorText)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.22), value: appUpdateModel.promptVersion)
        .sensoryFeedback(.success, trigger: commitPulse)   // 采纳 / 撤销成功 = 提交确认
        .sensoryFeedback(.selection, trigger: selectPulse) // 暂不 / 展开折叠 = 轻选择
        .task {
            sessionStore.coachSaveErrorText = nil // 进页清教练写错误（新视图干净起步；隔离于全局 saveErrorText）
            if sessionStore.todayOutcome == nil { await sessionStore.loadToday() }
            initialTodayLoadComplete = true
            // K8：训练日分支的周一收官行（休息/练完分支归 loadCompletedDigest 同批链，
            // 不在此重复 IO）。loadToday 已 await——此刻 model/分支判定是最终值；
            // weekReview 已有值说明 task(id:) 侧已算过（同日不变），不二次 IO。
            if !showsRestBranch, weekReview == nil { await loadWeekReviewIfEligible() }
            // 截图/UI 验证钩子（同 -autoOpenSharePreview 先例）：自动打开设置页（看 Apple 健康区等）。
            if CommandLine.arguments.contains("-autoOpenSettings") { showSettings = true }
            // FR-TR6 验证钩子：自动给首个处方动作打开换动作（swapIntent）detail，便于点替代项验「只换这次/以后都换」。
            if CommandLine.arguments.contains("-autoOpenSwap"), let first = model?.prescription?.exercises.first {
                detailTarget = ExerciseDetailTarget(id: first.exerciseId, swapIntent: true)
            }
            // FR-TR12 验证钩子：自动弹「今天换一天练」选训练日对话框。
            if CommandLine.arguments.contains("-autoOpenDaySwap") { showDayPicker = true }
            // Task 5 验证钩子：恢复面板三动作各走一遍真实闭包（simctl 无法点击 UI）。
            // 用法：存在当日 draft 时 `-autoResumeAction resume|discard|later`。
            if let idx = CommandLine.arguments.firstIndex(of: "-autoResumeAction"),
               CommandLine.arguments.indices.contains(idx + 1), sessionStore.pendingDraft != nil {
                switch CommandLine.arguments[idx + 1] {
                case "resume": sessionStore.restorePendingDraft(); onStartTraining()
                case "discard": sessionStore.discardPendingDraft()
                default: sessionStore.pendingDraft = nil
                }
            }
        }
        .sheet(isPresented: Binding(
            get: { sessionStore.pendingDraft != nil },
            // 滑走 = 稍后再说：清提示但保留 draft 文件，下次启动再问（原 alert 同语义）
            set: { if !$0 { sessionStore.pendingDraft = nil } }
        )) {
            // FR-TR9 恢复面板品牌化（Task 5 2026-07-04）：全 App 最后一处原生 action
            // 弹窗收口。三选一与原 alert 逐一等价（恢复接续 flow / 丢弃清 draft /
            // 暂不留 draft 下次启动再问）；销毁行 redeRisk 且不与主操作相邻（中间
            // 隔「稍后再说」防误触）；restore/discard 内部清 pendingDraft，binding
            // 自动收面板，行内无需显式 dismiss。
            RedeChoiceSheet(
                title: s.resumeSessionTitle,
                message: s.resumeSessionMessage,
                options: [
                    RedeChoiceOption(title: s.resumeSessionContinue, emphasis: true, action: {
                        sessionStore.restorePendingDraft()
                        onStartTraining()
                    }),
                    RedeChoiceOption(title: s.resumeSessionLater, action: {
                        sessionStore.pendingDraft = nil
                    }),
                    RedeChoiceOption(title: s.resumeSessionDiscard, role: .destructive, action: {
                        sessionStore.discardPendingDraft()
                    }),
                ],
                onCancel: {}  // 无独立取消行：「稍后再说」已是显式行，滑走同义
            )
        }
        .sheet(isPresented: $showSettings, onDismiss: {
            guard let action = pendingCoachAction else { return }
            pendingCoachAction = nil
            switch action {
            case .openToday:
                break
            case .reviewData:
                onReviewData()
            case .viewProgress:
                onViewProgress()
            }
        }) {
            // 工艺重做（2026-06-10）：内容超半屏，补 .large 档 + 拖拽指示条
            SettingsSheet(
                store: localeStore,
                onCoachAction: { pendingCoachAction = $0 }
            )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: Binding(
            get: {
                initialTodayLoadComplete
                    && appUpdateModel.shouldPresentWhatsNew
                    && !showSettings
                    && sessionStore.pendingDraft == nil
                    && sessionStore.flow == nil
            },
            set: { isPresented in
                if !isPresented { appUpdateModel.markWhatsNewSeen() }
            }
        ), onDismiss: {
            appUpdateModel.markWhatsNewSeen()
        }) {
            AppUpdateWhatsNewSheet(version: appUpdateModel.installedVersion) {
                appUpdateModel.markWhatsNewSeen()
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        // T1 练完态分享入口 → 分享卡预览（与训练小结同一预览视图与隐私链）
        .sheet(item: $sharePreview) { item in
            ShareCardPreviewView(snapshots: item.snapshots)
        }
        // T1/K3：无处方分支出现（练完态翻转 / 休息日进页）即派生最近一场总结 + 下一场预告；
        // 离开该分支清空。绑 id 而非一次性 .task——一次性版本会错过「视图不重建、状态翻转」路径
        //（-autoCompleteSession 实拍暴露：完成后 digest 不加载）。
        .task(id: showsRestBranch) {
            if showsRestBranch { await loadCompletedDigest() } else {
                completedDigest = nil
                recentVolumes = []
                nextSession = nil
                weekVolumeKg = nil
                // K8：分支翻回训练态时收官行改走训练日入口重算（周一才 IO；非周一落 nil）
                await loadWeekReviewIfEligible()
            }
        }
        .sheet(item: $detailTarget) { target in
            exerciseDetailSheet(target)
        }
        // FR-TR12「今天换一天练」品牌选择面板（替代原生 confirmationDialog）：①选训练日 ②单次/永久。
        // 同一 sheet 内就地切两步（pendingDayOverride 决定显哪步），关闭时清待定项防下次直接跳到②步。
        .sheet(isPresented: $showDayPicker, onDismiss: {
            pendingDayOverride = nil
            // 永久分支接力：等本面板真正关掉后再开顺序编辑器（present-after-dismiss，零竞争、无人造延迟）。
            if pendingSequenceEditor { pendingSequenceEditor = false; showSequenceEditor = true }
        }) {
            daySwitchSheet
        }
        // FR-TR12 永久分支：打开训练日顺序编辑器让用户看着完整序列自己拖（不在今日页猜意图）。
        .sheet(isPresented: $showSequenceEditor) {
            PlanDaySequenceEditorView(onApplied: { Task { await sessionStore.loadToday() } })
        }
    }

    // MARK: - 引擎数据投影（纯展示取值）

    private var callCode: String { model?.verdict.call.rawValue ?? "train" }
    private var reasonCode: String { model?.verdict.reason.code ?? "noHistoryCalibration" }
    /// 日级处方理由码（顺延副句等；空处方 = 空集）。
    private var dayReasonCodes: Set<String> {
        Set(model?.prescription?.dayReasons.map(\.code) ?? [])
    }
    private var firstExercise: ExercisePrescriptionPlan? { model?.prescription?.exercises.first }

    private var pillFill: Color {
        if isUnreadable { return .redeT4 }
        switch callCode {
        case "light", "deload": return .redeEmber2
        case "rest": return .redeT4
        default: return .redeRec
        }
    }

    private var pillText: Color {
        if isUnreadable { return .redeT3 }
        switch callCode {
        case "light", "deload": return .redeEmber2
        case "rest": return .redeT3
        default: return .redeRec2
        }
    }

    private var gapDays: Int? {
        guard let signals = model?.verdict.signals else { return nil }
        for signal in signals {
            if case .daysSinceLastSession(let days) = signal { return days }
        }
        return nil
    }

    private var consecutiveDays: Int? {
        guard let signals = model?.verdict.signals else { return nil }
        for signal in signals {
            if case .consecutiveTrainingDays(let days) = signal { return days }
        }
        return nil
    }

    private var changeLineText: String {
        guard let first = firstExercise else { return s.changeLineNone }
        return changeLine(for: first)
    }

    /// 单动作变化行（任意动作复用，wave-12 提炼）：原仅头牌动作内联，现抽出供里程摘要按动作调用。
    private func changeLine(for ex: ExercisePrescriptionPlan) -> String {
        // 辅助毕业 / 负重回退（wave-9/11）：必须**前置**——切换那刻引擎已切自重孪生
        //（loadType=bodyweight），靠 reason 区分，否则被下面 bodyweight 分支吞掉、丢文案。
        if ex.reason == .assistedGraduated {
            return s.changeLineAssistedGraduated(exerciseName: localeStore.exerciseName(ex.exerciseId))
        }
        if ex.reason == .bodyweightPlusDegraded {
            return s.changeLineBodyweightPlusDegraded(exerciseName: localeStore.exerciseName(ex.exerciseId), reps: ex.targetReps)
        }
        if ex.loadType == "bodyweight" || ex.loadType == "band" {
            // 自重/弹力带共用按次数 change 行；弹力带（wave-12）到顶分叉换带提示。
            let isBand = ex.loadType == "band"
            return s.changeLineBodyweight(
                exerciseName: localeStore.exerciseName(ex.exerciseId),
                change: ex.change.rawValue,
                reps: ex.targetReps,
                atCeiling: ex.reason == (isBand ? .bandCeilingReached : .bodyweightCeilingReached),
                isBand: isBand
            )
        }
        if ex.loadType == "assisted" {
            return s.changeLineAssisted(
                exerciseName: localeStore.exerciseName(ex.exerciseId),
                change: ex.change.rawValue,
                fromKg: ex.previousWeightKg.map { LoadDisplay.weight($0, loadType: ex.loadType, equipment: ex.equipment, s) },
                toKg: LoadDisplay.weight(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s)
            )
        }
        if ex.loadType == "bodyweight-plus" {
            return s.changeLineBodyweightPlus(
                exerciseName: localeStore.exerciseName(ex.exerciseId),
                change: ex.change.rawValue,
                fromKg: ex.previousWeightKg.map { LoadDisplay.weight($0, loadType: ex.loadType, equipment: ex.equipment, s) },
                toKg: LoadDisplay.weight(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s)
            )
        }
        return s.changeLine(
            exerciseName: localeStore.exerciseName(ex.exerciseId),
            change: ex.change.rawValue,
            fromKg: ex.previousWeightKg.map { LoadDisplay.weight($0, loadType: ex.loadType, equipment: ex.equipment, s) },
            toKg: LoadDisplay.weight(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s)
        )
    }

    /// 里程摘要（wave-12，owner 拍板 B）：头牌变化行只覆盖当日第一个动作，配件类（弹力带/自重/
    /// 辅助/负重自重）排不到首位，其里程事件（换带/加配重/毕业/回退）会被吞掉。这里扫全表把
    /// **非头牌**且命中里程的动作单列，复用同一变化行文案。只列里程事件、不列普通进阶——避免每个
    /// 配件每场都刷屏（高信号优先）。
    private var milestoneNotes: [String] {
        guard let exercises = model?.prescription?.exercises, exercises.count > 1 else { return [] }
        // 里程事件（到顶/毕业/回退）与换动作教练卡触发同口径——共用 PrescriptionReason 穷举判定，
        // 新增 case 时编译器强制同步（审查：消除跨文件 default:false 无声漂移）。
        return exercises.dropFirst().filter { $0.reason.isCeilingOrGraduationMilestone }.map { changeLine(for: $0) }
    }

    private var dayName: String {
        model?.prescription.map { s.trainingDayName($0.dayCode) } ?? ""
    }

    /// FR-T5 教练卡（切片6b）：引擎已按优先级排序并降频，每屏只取首条（设计 ≤1）。
    private var coachAction: CoachAction? { model?.coachActions.first }

    // MARK: - 今日页（密而干净，2026-06-15 owner 拍板）：状态 + 全天清单 + 依据

    private var todayContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            contextLine
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 4)

            // K8 周一「上周收官」行（contextLine 之下、判断行之上）：单行中性判断句、
            // 零 ember 零交互零 hairline；周二起 weekReview 自动为 nil 消失（无残留状态）。
            if let review = weekReview {
                Text(s.weekReviewLine(
                    days: review.days,
                    volumeText: s.formatVolumeKg(review.volumeKg),
                    deltaPercent: review.deltaPercent))
                    .font(.redeCaption).monospacedDigit()
                    .foregroundStyle(Color.redeT3)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 10)
            }

            // 切片6c 红线：今日页教练写入（采纳/撤销/暂不处理）失败时如实呈现，绝不静默假成功
            //（与 TrainTabView 收尾页同口径：saveFailedLine + 明细；下次教练写入开写自动清空）。
            // 读教练专属 coachSaveErrorText，与全局 saveErrorText 隔离——不抢显训练/设置写失败（审查 MAJOR）。
            if let errorText = sessionStore.coachSaveErrorText {
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.saveFailedLine)
                        .font(.redeCaption).foregroundStyle(Color.redeRisk)
                    Text(errorText)
                        .font(.redeCaption).foregroundStyle(Color.redeT4)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 8)
                .transition(reduceMotion ? .identity : .opacity) // 写失败提示淡入，不硬闪
            }

            if isUnreadable {
                unreadableBlock
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 18)
            } else if let exercises = model?.prescription?.exercises, !exercises.isEmpty {
                verdictLine(count: exercises.count)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 14)

                if !milestoneNotes.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(milestoneNotes.enumerated()), id: \.offset) { _, note in
                            HStack(alignment: .top, spacing: 6) {
                                Rectangle().fill(Color.redeEmber2).frame(width: 3, height: 3)
                                    .padding(.top, 7)
                                Text(note).font(.redeCaption).foregroundStyle(Color.redeT3)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 8)
                }

                if let action = coachAction {
                    coachCard(action)
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, 12)
                        // 教练卡进出（采纳/暂不后随 reload 出现/消失）= 上方滑入 + 淡入，不硬闪。
                        .transition(reduceMotion ? .identity : .opacity.combined(with: .move(edge: .top)))
                }

                RuleDivider()

                ForEach(Array(exercises.enumerated()), id: \.offset) { idx, ex in
                    Button {
                        detailTarget = ExerciseDetailTarget(id: ex.exerciseId)
                    } label: {
                        // 批次 G N2：当前/下一个动作 = hero 层级（同列表内放大，无说明
                        // 小字——放大本身就是焦点语言；owner 零小字红线）
                        Group {
                            if idx == activeExerciseIndex {
                                heroExerciseCard(ex)
                            } else {
                                exerciseRow(ex)
                            }
                        }
                        .contentShape(Rectangle()) // 整行可点（含 Spacer 空白）+ 按压反馈覆盖全行
                    }
                    .buttonStyle(.redePressableRow)
                    .accessibilityHint(s.exerciseDetailHint)
                    .padding(.horizontal, RedeSpace.page)
                }

                summaryLine(exercises: exercises)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 14)

                EmbButton(icon: "play.fill", title: s.startTraining, action: onStartTraining)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 16)

                RuleDivider()

                receiptSection
                    .padding(.horizontal, RedeSpace.page)
            } else {
                restBlock
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 18)

                // T1/K3 最近一场总结（FR-SH3 完成后轻量入口延续到今日页）：练完态显
                // 「今天这场」、休息日/停练回归日显「上一场 · 日期」；零历史/数据缺失
                // 退回上面单句（新用户首练引导已有，不编数据）。
                if let digest = completedDigest {
                    completedSummaryBlock(digest)
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, 24)
                }

                // K3「下一场」预告行（本分支唯一 ember 下一步——裁定 5）；点击跳计划页。
                if let next = nextSession {
                    nextSessionRow(next)
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, completedDigest == nil ? 24 : 14)
                }

                // K4 练完态「本周」合计行（仅今天有场时——休息日无当日增量，不重复周口径）：
                // 天数 = 分段条同源 weekStatuses（严格对账），吨位 = snapshot 周桶（与总结卡同口径）。
                if completedDigest?.dateISO == Self.isoDay(model?.now ?? Date()),
                   let weekVolumeKg, let statuses = weekStatuses {
                    VStack(spacing: 0) {
                        Rectangle().fill(Color.redeHair2).frame(height: 1)
                            .padding(.bottom, 10)
                        Text(s.weekTotalLine(
                            days: statuses.filter { $0 == .trained }.count,
                            volumeText: s.formatVolumeKg(weekVolumeKg)))
                            .font(.redeCaption).monospacedDigit()
                            .foregroundStyle(Color.redeT3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 14)
                }
            }
        }
    }

    // 状态行：可以训练 + 本周分段条（N3a，2026-07-14）。右侧从滚动 7 天的 signalLine 文字
    // 换成日历周 7 格分段条 + 同口径计数——一屏之内只有一种周口径（引擎信号照旧，只动展示）。
    private var contextLine: some View {
        HStack(spacing: 7) {
            Circle().fill(pillFill).frame(width: 7, height: 7)
            Overline(text: isUnreadable ? s.dataUnreadableStatus : s.verdictStatus(call: callCode), color: pillText)
            Spacer(minLength: 10)
            if let statuses = weekStatuses {
                weekStrip(statuses)
            }
        }
    }

    /// 本日历周 7 天训练状态（周一始，ISO 周——与 ContinuityCalendar 月历/周量图同口径）。
    /// 从已在内存的 cleanView.sessions 日期派生（最轻路径：零 IO、不重跑引擎）；unreadable 时
    /// model 为 nil → 不渲染分段条（诚实，不编数据）。
    private var weekStatuses: [ContinuityCalendar.WeekDayStatus]? {
        guard let model else { return nil }
        return ContinuityCalendar.weekStatus(
            todayISO: Self.isoDay(model.now),
            // prefix(10) 归一同月历先例（审查 MINOR：clean 层合法保留长 ISO 串，
            // 引擎/月历全部归一消费——分段条不得独漏）
            trainedDatesISO: Set(model.cleanView.sessions.map { String($0.date.prefix(10)) }))
    }

    /// N3a 周分段条：月历 dayCell 的缩微语法（trained=ember 实心、today 未练=描边、
    /// past/future 空=刻点同档——today 描边已锚定位置，少一档视觉层级更干净）。
    /// 7×7pt 格 + 3pt 间距 = 整条 67pt；整条与计数合成一个 a11y 元素。
    private func weekStrip(_ statuses: [ContinuityCalendar.WeekDayStatus]) -> some View {
        let trainedCount = statuses.filter { $0 == .trained }.count
        return HStack(spacing: 8) {
            HStack(spacing: 3) {
                ForEach(Array(statuses.enumerated()), id: \.offset) { _, status in
                    weekStripCell(status)
                }
            }
            Text(s.weekStripCount(trainedCount))
                .font(.redeCaption).monospacedDigit()
                .foregroundStyle(Color.redeT4)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(s.weekStripA11y(trainedCount))
    }

    @ViewBuilder
    private func weekStripCell(_ status: ContinuityCalendar.WeekDayStatus) -> some View {
        switch status {
        case .trained:
            Circle().fill(Color.redeEmber).frame(width: 7, height: 7)
        case .today:
            Circle().stroke(Color.redeT4, lineWidth: 1).frame(width: 7, height: 7)
        case .past, .future:
            Circle().fill(Color.redeEtch).frame(width: 3, height: 3).frame(width: 7, height: 7)
        }
    }

    /// FR-TR12：今天的处方日 ≠ 轮转本该练的日 = 今天临时换过了。
    private var isDayOverridden: Bool {
        guard let sched = model?.scheduledDayCode, let today = model?.prescription?.dayCode else { return false }
        return sched != today
    }

    // 训练日判断行：「推力 A · N 个动作」+「今天换一天练」入口 + 依据句（顶部，不再用大字号 hero）
    private func verdictLine(count: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                // iOS 26：Text `+` 拼接已弃用，改字符串插值嵌两段各自带色的 Text（两色一行不变）。
                Text("\(Text(dayName).foregroundStyle(Color.redeT1))\(Text(s.verdictExerciseCount(count)).foregroundStyle(Color.redeT3))")
                    .font(.redeSubhead)
                    .monospacedDigit()
                Spacer(minLength: 8)
                // FR-TR12「今天换一天练」入口：仅多于 1 个训练日的分化才有意义；正训练中不给换（避免改了正在练的）。
                if (model?.daySequence.count ?? 0) > 1, sessionStore.flow == nil {
                    Button(s.swapDayEntry) { showDayPicker = true }
                        .font(.redeCaption).foregroundStyle(Color.redeEmber2)
                        .buttonStyle(.redePressable)
                }
            }
            // 今天临时换过 → 头标提示（次日自动恢复，撤销走浮条）。
            if isDayOverridden {
                Text(s.dayOverrideHeader(day: dayName))
                    .font(.redeCaption).foregroundStyle(Color.redeEmber2)
            }
            // 顺延透明化（2026-07-08）：解释「上周的 X 顺延到今天」并指路换天
            if dayReasonCodes.contains("carriedOverFromLastWeek") {
                Text(s.carriedOverHeader(day: dayName))
                    .font(.redeCaption).foregroundStyle(Color.redeT3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(s.receiptConclusion(call: callCode, reasonCode: reasonCode, gapDays: gapDays))
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// FR-TR12「今天换一天练」品牌面板：同一 sheet 内分两步——pendingDayOverride==nil 选训练日，
    /// 选了某天后切到单次/永久。选项点击负责关闭/推进，避免两层原生弹窗的视觉与品牌断裂。
    @ViewBuilder private var daySwitchSheet: some View {
        if let day = pendingDayOverride {
            // ②单次/永久：首要项=只换今天（ember），次要项=永久（打开顺序编辑器让用户看着完整序列拖）。
            RedeChoiceSheet(
                title: s.swapDayPickerTitle,
                options: [
                    RedeChoiceOption(
                        title: s.swapDayScopeOnce(displaced: s.trainingDayName(model?.scheduledDayCode ?? "")),
                        emphasis: true,
                        action: { showDayPicker = false; Task { await applyDayOverride(day) } }
                    ),
                    RedeChoiceOption(
                        title: s.swapDayScopeAlways,
                        action: { pendingSequenceEditor = true; showDayPicker = false }  // onDismiss 接力开编辑器 + 清待定项
                    ),
                ],
                cancelLabel: s.commonCancel,
                onCancel: { showDayPicker = false }
            )
        } else {
            // ①选训练日：列本分化里今天没在练的其它训练日；点一项进入②步（就地切，不另弹层）。
            RedeChoiceSheet(
                title: s.swapDayPickerTitle,
                options: (model?.daySequence ?? [])
                    .filter { $0 != model?.prescription?.dayCode }
                    .map { day in RedeChoiceOption(title: s.trainingDayName(day), action: { pendingDayOverride = day }) },
                cancelLabel: s.commonCancel,
                onCancel: { showDayPicker = false }
            )
        }
    }

    /// FR-TR12 执行「只换今天」：写临时训练日覆盖 + 撤销浮条（明示明天补回被跳过的那天）。
    private func applyDayOverride(_ dayCode: String) async {
        let displaced = s.trainingDayName(model?.scheduledDayCode ?? "")
        if await sessionStore.applyOneTimeDayOverride(dayCode: dayCode) {
            commitPulse += 1
            undoBanner = UndoBanner(
                kind: .dayOverride,
                text: (model?.weeklyCycleRestart ?? false)
                    ? s.swapDayAdoptedToastWeekly(chosen: s.trainingDayName(dayCode))
                    : s.swapDayAdoptedToast(chosen: s.trainingDayName(dayCode), displaced: displaced)
            )
        }
    }

    /// 今日清单橙色条跟随实时训练进度（owner 2026-06-15）：训练进行中标当前动作，
    /// 无会话/已收尾退回首个（=下一个要练的）。flow.plan 由本处方 expand，下标一一对应
    /// （TrainTabView「动作 N/总」同源）；换动作就地替换不改下标，故按 index 对位仍准。
    private var activeExerciseIndex: Int {
        guard let flow = sessionStore.flow, flow.phase != .summary else { return 0 }
        return flow.exerciseIndex
    }

    /// Hero 动作卡（批次 G N2）：当前/下一个动作的放大层级——动作名 headline、
    /// 目标大字（monospaced 数字，练完态总结卡同款重量层级）、meta 副行、上次上下文。
    /// 结构仍是列表条目（橙条加粗 + 同款 hairline 收尾），非独立卡片（整面板公理，
    /// 不引入描边盒子不占 ForgedCard 预算）。点击行为与普通行一致。
    private func heroExerciseCard(_ ex: ExercisePrescriptionPlan) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                Rectangle().fill(Color.redeEmber)
                    .frame(width: 4)
                    .padding(.vertical, 2)
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text(localeStore.exerciseName(ex.exerciseId))
                            .font(.redeHeadline)
                            .tracking(RedeTracking.headline)
                            .foregroundStyle(Color.redeT1)
                        if swapOriginalId(for: ex.exerciseId) != nil {
                            Overline(text: s.exerciseSwappedBadge, color: .redeEmber2)
                        } else if oneTimeOriginalId(for: ex.exerciseId) != nil {
                            Overline(text: s.exerciseSwappedOnceBadge, color: .redeEmber2)
                        }
                    }
                    Text(targetSummary(ex))
                        .font(.redeTitle).monospacedDigit()
                        .tracking(RedeTracking.title)
                        .foregroundStyle(Color.redeT1)
                        .lineLimit(1).minimumScaleFactor(0.6)   // 大字号可访问性下收缩不截断
                    HStack(spacing: 10) {
                        Text(s.exerciseMetaLine(sets: ex.sets, restSeconds: ex.restSeconds, rir: ex.targetRir))
                            .font(.redeCaption).monospacedDigit()
                            .foregroundStyle(Color.redeT4)
                        lastChangeView(ex)
                    }
                }
                Spacer()
                // chevron 垂直居中（与普通行/进展历史行同节奏——审查 NIT）
                VStack { Spacer(); Image(systemName: "chevron.right")
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
                    .accessibilityHidden(true); Spacer() }
            }
            .padding(.vertical, 16)
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
    }

    // 单动作行：名称 / 组数·休息·RIR / 目标 / 跟上次比。
    // isCurrent 橙条已由 hero 卡取代（批次 G N2）——参数删除，普通行不再点亮。
    private func exerciseRow(_ ex: ExercisePrescriptionPlan) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                Rectangle().fill(Color.clear)
                    .frame(width: 3, height: 18)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(localeStore.exerciseName(ex.exerciseId))
                            .font(.redeSubhead)
                            .foregroundStyle(Color.redeT1)
                        // 切片6c：该动作是某到顶动作的替代 → 微标（长存、读落库 map）；点行进 detail 可换回。
                        // FR-TR6：永久替代显「已换」；今天临时替代显「今天换」（提示次日自动恢复）。
                        if swapOriginalId(for: ex.exerciseId) != nil {
                            Overline(text: s.exerciseSwappedBadge, color: .redeEmber2)
                        } else if oneTimeOriginalId(for: ex.exerciseId) != nil {
                            Overline(text: s.exerciseSwappedOnceBadge, color: .redeEmber2)
                        }
                    }
                    Text(s.exerciseMetaLine(sets: ex.sets, restSeconds: ex.restSeconds, rir: ex.targetRir))
                        .font(.redeCaption).monospacedDigit()
                        .foregroundStyle(Color.redeT4)
                }
                Spacer()
                // chevron 与右侧目标/升降列居中对齐（不随外层 .top 顶对齐而偏高，与进展历史行一致）。
                HStack(alignment: .center, spacing: 8) {
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(targetSummary(ex))
                            .font(.redeCallout).monospacedDigit()
                            .foregroundStyle(Color.redeT2)
                        lastChangeView(ex)
                    }
                    // 可点线索（affordance 三件套之一）：整行可点开动作详情，尾部 chevron 明示。
                    Image(systemName: "chevron.right")
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT4)
                        .accessibilityHidden(true) // 装饰性线索；行的可点性已由 Button + hint 表达
                }
            }
            .padding(.vertical, 11)
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
    }

    /// 行级「首练」徽标是否整列隐藏。与顶部副标题「首次训练，全部动作从轻起步」
    /// 同源（TodayEngineCopy case ("train","noHistoryCalibration")）：只有那句总括真的在
    /// 屏上时徽标才冗余。不用「处方全 .start」判定——老用户换入全新动作组合时处方
    /// 也全是 .start，但顶部无总括句，那时逐行徽标是准确且必要的信息（审查 MAJOR）。
    private var firstBadgeRedundant: Bool {
        callCode == "train" && reasonCode == "noHistoryCalibration"
    }

    private func targetSummary(_ ex: ExercisePrescriptionPlan) -> String {
        // §8 显示吸附：目标重量先落「器械×显示单位」真实梯子，再格式化（禁裸换算）。
        s.targetLine(loadType: ex.loadType,
                     weightKg: LoadDisplay.snap(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s),
                     reps: ex.targetReps)
    }

    @ViewBuilder
    private func lastChangeView(_ ex: ExercisePrescriptionPlan) -> some View {
        let isRep = ex.loadType == "bodyweight" || ex.loadType == "band"
        // 上次值同有同无（审查 [4]）由 lastRefLine 内部 guard 保证，缺任一→nil 不显示
        let prevText = s.lastRefLine(
            loadType: ex.loadType,
            prevWeightKg: ex.previousWeightKg.map { LoadDisplay.snap($0, loadType: ex.loadType, equipment: ex.equipment, s) },
            prevReps: ex.previousTopReps)
        HStack(spacing: 6) {
            if let prevText {
                Text(prevText).font(.redeCaption).monospacedDigit().foregroundStyle(Color.redeT4)
            }
            switch ex.change.rawValue {
            case "increase":
                // 幅度取绝对值（审查 [5]）：assisted 进阶=辅助↓（target<prev），直减会出负号；
                // 无重量轴或缺上次值则只给箭头。
                // 增量 = 吸附后目标 − 吸附后上次（两端同梯子，差才是真实可配增量）；箭头用 SFSymbol
                let amount: String = (isRep || ex.previousWeightKg == nil)
                    ? ""
                    : " \(s.formatKg(abs(LoadDisplay.snap(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s) - LoadDisplay.snap(ex.previousWeightKg ?? 0, loadType: ex.loadType, equipment: ex.equipment, s))))"
                Text("\(Image(systemName: "arrow.up"))\(amount)").font(.redeCaption).monospacedDigit().foregroundStyle(Color.redeEmber)
            case "ease":
                Text(Image(systemName: "arrow.down")).font(.redeCaption).foregroundStyle(Color.redeEmber2)
            case "hold":
                Text(s.holdShort).font(.redeCaption).foregroundStyle(Color.redeT4)
            default:
                // 顶部副标题总括「全部动作从轻起步」时逐行「首练」×N 纯重复，整列隐藏；
                // 其余场景（如换入个别新动作）徽标保留区分价值。
                if !firstBadgeRedundant {
                    Text(s.firstTimeShort).font(.redeCaption).foregroundStyle(Color.redeT4)
                }
            }
        }
    }

    private func summaryLine(exercises: [ExercisePrescriptionPlan]) -> some View {
        let totalSets = exercises.reduce(0) { $0 + $1.sets }
        return Text(s.dailySummaryLine(totalSets: totalSets, exerciseCount: exercises.count))
            .font(.redeCaption).monospacedDigit()
            .foregroundStyle(Color.redeT4)
    }

    // MARK: - T1/K3 最近一场总结（练完态 = 今天这场；休息日/回归日 = 上一场）

    /// 无处方分支判定（restBlock 可见）：digest/下一场的加载触发与渲染共用此口径。
    /// unreadable → model nil → false（unreadableBlock 独占，不掺总结）。
    private var showsRestBranch: Bool {
        model != nil && (model?.prescription?.exercises.isEmpty ?? true)
    }

    /// 从已落盘历史派生最近一场总结（snapshot 链与进度页同口径；dayCode/时长按 sessionId
    /// 从 canonical 补）+ 「下一场」投影。任何一环缺失 → 对应块不渲染（诚实兜底、不编数据）。
    private func loadCompletedDigest() async {
        guard showsRestBranch else { return }
        // 下一场（现成只读投影；练完态含今日场 → 轮转已推进到下一日，与计划页排期同源）
        nextSession = await Task.detached { SessionStore.loadPlanProjection().first?.first }.value
        let outcome = await ProgressModel.loadOutcomeAsync()
        guard case let .ready(pm) = outcome else { return }
        // K8：周一收官行与本 digest 同批取自同一 snapshot（禁新增独立 IO 链路）；
        // 在 history 空守卫之前算——零历史时 computeWeekReview 自会落 nil。
        computeWeekReview(snapshot: pm.snapshot)
        guard let latest = pm.snapshot.history.first else { return }
        // N3b：同一 snapshot 顺手带出近 5 场总体量（history[0]=最新 → 反转成旧→新），不二次 IO。
        recentVolumes = pm.snapshot.history.prefix(5).reversed().map { CGFloat($0.totalVolumeKg) }
        // K4：本周合计取 snapshot.weeklyVolume 当前 ISO 周桶（与总结卡总量同一 snapshot
        // 口径——同屏「总量」与「本周合计」必对账；周锚 WeekAnchor 与补量卡/分段条同源）。
        let weekStart = WeekAnchor.isoWeekStart(model?.now ?? Date())
        weekVolumeKg = pm.snapshot.weeklyVolume.first { $0.weekStartISO == weekStart }?.totalVolumeKg
        let record = pm.statsRecords.first { $0.id == latest.sessionId }
        let sid = latest.sessionId
        let facts = await Task.detached { SessionStore.loadCompletedFacts(sessionId: sid) }.value
        // patterns 同训练小结口径（SessionShareSnapshotBuilder）：catalog 查动作模式
        let catalog = ExerciseCatalog.minimal
        let patterns = (record?.exercises ?? []).compactMap { catalog.entry(id: $0.exerciseId)?.movementPattern }
        completedDigest = TodayCompletedDigestBuilder.digest(
            latest: latest, record: record,
            dayCode: facts?.dayCode, durationMinutes: facts?.durationMinutes, patterns: patterns)
    }

    private static func isoDay(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = .current
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: date)
    }

    // MARK: - K8 周一「上周收官」（PRD-4 周初叙事雏形，free 单行；付费深度版留 FR-SUB1）

    /// 截图钩子（沿 -expandTodayReason 先例）：-forceWeekReview 非周一也渲染供实拍/审计。
    private var weekReviewForced: Bool {
        ProcessInfo.processInfo.arguments.contains("-forceWeekReview")
    }

    /// 仅本地日历周一全天显示（weekday==2；周二起条件自然翻假 → 行消失，无残留状态）。
    private var isLocalMonday: Bool {
        guard let now = model?.now else { return false }
        return Calendar.current.component(.weekday, from: now) == 2
    }

    /// 训练日分支入口：周一（或钩子）才做一次 snapshot IO；休息/练完分支不走这里
    ///（归 loadCompletedDigest 同批链，避免同屏双载）。
    private func loadWeekReviewIfEligible() async {
        guard isLocalMonday || weekReviewForced else { weekReview = nil; return }
        if weekReview != nil { return }   // 幂等（审查 NIT：训练日主 .task 与 task(id:) 双链并发时省一次 snapshot IO）
        let outcome = await ProgressModel.loadOutcomeAsync()
        guard case let .ready(pm) = outcome else { weekReview = nil; return }
        computeWeekReview(snapshot: pm.snapshot)
    }

    /// 上周完整周桶 vs 上上周（FR-PR3 周对比同口径：ISO 周、整数吨位）；天数 = cleanView
    /// 上周日期去重（prefix(10) 归一，单位=天——裁定 3/5）。上周零训练 → nil 整行不显示
    ///（不恐吓，回归语境归 verdict）；上上周无桶或零吨位 → 无对比只报事实。
    private func computeWeekReview(snapshot: ProgressSnapshot) {
        guard isLocalMonday || weekReviewForced, let model else { weekReview = nil; return }
        let calendar = Calendar.current
        guard let lastWeekDay = calendar.date(byAdding: .day, value: -7, to: model.now),
              let prevWeekDay = calendar.date(byAdding: .day, value: -14, to: model.now) else {
            weekReview = nil
            return
        }
        // 周锚 WeekAnchor 与分段条/K4 同源；异常日期返回空串 → 如实不渲染
        let thisMonday = WeekAnchor.isoWeekStart(model.now)
        let lastMonday = WeekAnchor.isoWeekStart(lastWeekDay)
        let prevMonday = WeekAnchor.isoWeekStart(prevWeekDay)
        guard !thisMonday.isEmpty, !lastMonday.isEmpty else { weekReview = nil; return }
        // yyyy-MM-dd 零填充字典序 = 时间序，闭开区间 [上周一, 本周一) 即上周整周
        let lastWeekDays = Set(
            model.cleanView.sessions.map { String($0.date.prefix(10)) }
                .filter { $0 >= lastMonday && $0 < thisMonday }
        ).count
        guard lastWeekDays > 0,
              let lastBucket = snapshot.weeklyVolume.first(where: { $0.weekStartISO == lastMonday }) else {
            weekReview = nil // 上周零训练：整行不显示
            return
        }
        let prevVolume = snapshot.weeklyVolume.first { $0.weekStartISO == prevMonday }?.totalVolumeKg
        let delta: Int? = prevVolume.flatMap { prev in
            prev > 0 ? Int(((lastBucket.totalVolumeKg - prev) / prev * 100).rounded()) : nil
        }
        weekReview = WeekReview(days: lastWeekDays, volumeKg: lastBucket.totalVolumeKg, deltaPercent: delta)
    }

    /// 总结块（surface 原语，非 ForgedCard——今日页 0 铭牌现状不动）：
    /// 区头 + 训练日名 → 总量大数字 → 动作·组·时长 meta 行 → 分享入口（有可分享内容时）。
    private func completedSummaryBlock(_ digest: TodayCompletedDigest) -> some View {
        // K3 区头分流：场次日期 == 今天 → 「今天这场」（练完态语义不变）；
        // 否则「上一场 · 日期」（休息日/回归日，日期用 s.shortDate——不编成今天）。
        let isTodaySession = digest.dateISO == Self.isoDay(model?.now ?? Date())
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Overline(text: isTodaySession
                            ? s.todayDoneSummaryHeader
                            : s.lastSessionSummaryHeader(dateText: s.shortDate(fromISO: digest.dateISO)),
                         color: .redeT3)
                if digest.prCount > 0 {
                    Text(s.shareCardPRBadge)
                        .font(.redeOverline).tracking(RedeTracking.overline)
                        .foregroundStyle(Color.redeEmber2)
                }
                Spacer()
                if let day = digest.dayCode {
                    Text(s.trainingDayName(day))
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeEmber2)
                }
            }
            HStack(spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(s.formatVolumeKg(digest.totalVolumeKg))
                        .font(.redeTitle).tracking(RedeTracking.title).monospacedDigit()
                        .foregroundStyle(Color.redeT1)
                    Text("\(s.unitLabel) · \(s.todayDoneVolumeLabel)")
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                }
                Spacer(minLength: 8)
                // N3b：近 5 场总体量走势（几何同周期页 trendRow）；<2 场不渲染、a11y 隐藏
                //（吨位数字已读，折线是同一事实的形状）。零新增文字。
                if recentVolumes.count >= 2 {
                    MiniSparkline(values: recentVolumes)
                        .frame(width: 64, height: 22)
                        .accessibilityHidden(true)
                }
            }
            Text(metaLine(digest))
                .font(.redeCallout).monospacedDigit()
                .foregroundStyle(Color.redeT2)
            if !digest.shareSnapshots.isEmpty {
                Button {
                    sharePreview = SharePreviewItem(snapshots: digest.shareSnapshots)
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "square.and.arrow.up").font(.redeCaption)
                        Text(s.todayDoneShareAction)
                        Spacer()
                        Image(systemName: "chevron.right").font(.redeCaption).foregroundStyle(Color.redeT4)
                    }
                    .font(.redeCallout)
                    .foregroundStyle(Color.redeEmber2)
                    .frame(minHeight: RedeShape.controlHeight)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.redePressableRow)
            }
        }
        .padding(RedeSpace.card)
        .background(RoundedRectangle(cornerRadius: RedeShape.cardRadius).fill(Color.redeSurface))
        .overlay(RoundedRectangle(cornerRadius: RedeShape.cardRadius).stroke(Color.redeHair, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }

    /// K3「下一场」预告行：ember 竖标 + 训练日名 · 动作数 + chevron，点击跳计划页。
    /// 数据 = PlanDayProjection（与计划页排期同源投影，永不分叉）。
    private func nextSessionRow(_ day: PlanDayProjection) -> some View {
        Button(action: onGoPlan) {
            HStack(spacing: 10) {
                Rectangle().fill(Color.redeEmber).frame(width: 3, height: 14)
                Overline(text: s.nextSessionLabel, color: .redeT3)
                Text("\(s.trainingDayName(day.dayCode)) · \(s.planDayExercises(day.exerciseCount))")
                    .font(.redeCallout).monospacedDigit()
                    .foregroundStyle(Color.redeT1)
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
                    .accessibilityHidden(true) // 装饰性 affordance；行 Button 已承载动作
            }
            .frame(minHeight: RedeShape.controlHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
        .accessibilityElement(children: .combine)
    }

    /// 「5 动作 · 22 组 · 60–90 分」——时长档缺失时省略该段（不编数据）。
    private func metaLine(_ digest: TodayCompletedDigest) -> String {
        var parts = [
            "\(digest.exerciseCount) \(s.shareCardStatExercises)",
            "\(digest.setCount) \(s.shareCardStatSets)",
        ]
        if let band = digest.durationBand {
            let label = ShareCardModel.bandLabel(band)
            parts.append("\(s.shareCardDurationBandValue(label)) \(s.shareCardDurationUnit)")
        }
        return parts.joined(separator: " · ")
    }

    // 仅 rest/light/deload 等无动作清单态调用（isUnreadable 已被 unreadableBlock 独占，审查 [2]）
    private var restBlock: some View {
        Text(s.verdictHeadline(
            call: callCode, reasonCode: reasonCode,
            dayName: dayName, gapDays: gapDays, consecutiveDays: consecutiveDays))
            .font(.redeHeadline)
            .tracking(RedeTracking.headline)
            .lineSpacing(22 * 0.3)
            .foregroundStyle(Color.redeT1)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var unreadableBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(s.dataUnreadableHeadline)
                .font(.redeHeadline).tracking(RedeTracking.headline)
                .foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)
            Text(s.dataUnreadableReceipt)
                .font(.redeBody).foregroundStyle(Color.redeT3)
        }
    }

    // Receipt 渐进披露
    private var receiptSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                selectPulse += 1
                // reduce-motion 守卫，与训练页/设置页折叠动画口径一致（无障碍）
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) { reasonExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Text(reasonExpanded ? s.todayHideReason : s.todayWhyThisCall)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 15))
                        .rotationEffect(.degrees(reasonExpanded ? 180 : 0))
                }
                .font(.redeBody)
                .foregroundStyle(Color.redeT3)
                .frame(minHeight: RedeShape.controlHeight)
                .contentShape(Rectangle())
            }
            .buttonStyle(.redePressable)
            .accessibilityHint(reasonExpanded ? s.a11yCollapse : s.a11yExpand)

            if reasonExpanded {
                // 「信号」已在顶部状态行（contextLine）一眼可见——依据里不再重复同一句（owner 拍板 A），
                // 只留「变化」。「控制」宣示行已删（N4，2026-07-14）：控制权由真实按钮表达
                // （换一天练 / 教练卡 / 动作行可点），静态能力清单 = 教学小字，owner 红线。
                HStack(alignment: .top, spacing: 14) {
                    Overline(text: s.receiptChange).padding(.top, 3)
                    Text(changeLineText)
                        .font(.redeCallout).monospacedDigit()
                        .foregroundStyle(Color.redeT2)
                }
                .padding(.top, 6)
                // 自动均衡（批次 E，owner 拍板「不要建议直接自动改」「不要小字」）：
                // 解释只放这里——用户主动点开才见；未知 rawValue 如实跳过
                if let boostedRaws = model?.prescription?.dayReasons.compactMap({ reason -> [String]? in
                    if case .musclePriorityBoosted(let raws) = reason { return raws }
                    return nil
                }).first {
                    let names = boostedRaws.compactMap { raw in
                        MuscleGroupLabel(rawValue: raw).map { s.muscleGroupName($0) }
                    }
                    if !names.isEmpty {
                        Text(s.musclePriorityBoostedLine(names: names))
                            .font(.redeCaption).foregroundStyle(Color.redeT3)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 8)
                    }
                }
            }
        }
    }

    // MARK: - 教练卡（FR-T5 切片6b；首个用户可见教练动作 — 只读卡 + 暂不处理）

    /// 教练卡：信号+影响双语句 + 「暂不处理」（降频入口）。采纳/撤销在切片6c 接。
    /// 视觉用 redeSurface 子面，不用 ForgedCard——保留 hero 判断牌的整面板公理预算（budget 1）。
    /// 仅在有处方的分支渲染：6b 能出的两类卡（换动作=源自处方到顶 reason、补量=仅 train/light）
    /// 都以"今日有处方"为前提，故 rest/无处方/unreadable 分支不渲染卡 = 设计取舍，非遗漏（审查 MINOR-2）。
    private func coachCard(_ action: CoachAction) -> some View {
        let exName = action.exerciseId.map { localeStore.exerciseName($0) } ?? ""
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 9) {
                Image(systemName: coachIcon(action.kind))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.redeT3) // ember 收敛：图标是分类标识非"下一步"，橙留给采纳 CTA（§1.3）
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 3) {
                    Text(s.coachCardTitle(reasonCode: action.reasonCode, exerciseName: exName))
                        .font(.redeSubhead)
                        .foregroundStyle(Color.redeT1)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(s.coachCardBody(reasonCode: action.reasonCode, exerciseName: exName, count: action.count))
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack {
                coachAdoptButton(action, exerciseName: exName)
                Spacer()
                Button(s.coachDismissLabel) {
                    selectPulse += 1
                    Task { await sessionStore.dismissCoachAction(actionKey: action.actionKey) }
                }
                .font(.redeCaption)
                .foregroundStyle(Color.redeT4)
                .buttonStyle(.redePressable)
                .disabled(sessionStore.isSaving)
            }
        }
        // 整面板公理：去通用圆角描边盒子，蚀刻在 base 上——顶部一条发丝线收边、内容直落底面
        //（owner UX 反馈"卡片描边=AI 味"，§12.1 禁通用圆角描边框）。下方既有 RuleDivider 收尾。
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
    }

    private func coachIcon(_ kind: CoachActionKind) -> String {
        switch kind {
        case .dataReview: return "checklist"
        case .exerciseSwap: return "arrow.triangle.2.circlepath"
        case .volumeBoost: return "plus.circle"
        }
    }

    /// 采纳类强调按钮统一样式（卡主 CTA + 撤销条共用）；写进行中 .disabled 给诚实反馈，不静默吞点击。
    private func adoptCTA(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.redeCaption.weight(.semibold))
            .foregroundStyle(Color.redeEmber2)
            .buttonStyle(.redePressable)
            .disabled(sessionStore.isSaving)
    }

    /// 采纳主 CTA（切片6c）：换动作→打开替代列表（detail sheet 换动作意图）；补量→直接记一次。
    @ViewBuilder
    private func coachAdoptButton(_ action: CoachAction, exerciseName: String) -> some View {
        switch action.kind {
        case .exerciseSwap:
            // 引擎保证：exerciseSwap 的 exerciseId 恒非 nil（CoachActionEngine 从 [String] stalledExerciseIds 构造）。
            // 故此 if-let 不会落空成"无采纳 CTA 的半残卡"；保留可选解包仅为类型安全（审查 NIT）。
            if let exerciseId = action.exerciseId {
                adoptCTA(s.coachAdoptSwapLabel) {
                    detailTarget = ExerciseDetailTarget(id: exerciseId, swapIntent: true)
                }
            }
        case .volumeBoost:
            // 诚实：采纳=记录本周已承认补量（不加训练、不改处方）→ 引擎本周抑制本卡。
            // 用 Date()（当场取时）而非 model.now（加载时快照）算本周锚点——避免跨午夜/跨周会话存活时
            // 写错周 key、reload 后卡立刻重弹（审查 MINOR）。撤销用同一 week（存进 banner）保持一致。
            adoptCTA(s.coachAdoptVolumeLabel) {
                let week = WeekAnchor.isoWeekStart(Date())
                Task {
                    if await sessionStore.applyVolumeBoost(weekStartISO: week) {
                        commitPulse += 1
                        undoBanner = UndoBanner(kind: .volume(weekStartISO: week), text: s.volumeAckToast)
                    }
                }
            }
        case .dataReview:
            // 修数据「去核对」= 跨页导航到进展页数据质量区（不改状态、不假报）；可疑数据修好后卡自然消失。
            adoptCTA(s.coachAdoptReviewLabel) { onReviewData() }
        }
    }

    /// 采纳后撤销条：正文 + 「撤销」（反向 gated 写）；约 5s 自动淡出，写进行中禁用撤销。
    private func undoBannerView(_ banner: UndoBanner) -> some View {
        HStack(spacing: 12) {
            Text(banner.text)
                .font(.redeCaption).foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            adoptCTA(s.coachUndoLabel) {
                Task { await undoAdoption(banner) }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 11)
        // 浮层 toast 需背景才可读，故保留 raised 填充；但去掉描边框（§12.1 禁通用圆角描边框）。
        .background(
            RoundedRectangle(cornerRadius: RedeShape.cardRadius, style: .continuous)
                .fill(Color.redeRaised)
        )
        .padding(.horizontal, RedeSpace.page)
        .padding(.bottom, RedeSpace.bottomBar + 8)
        .transition(.opacity)
        .task(id: banner.id) {
            try? await Task.sleep(for: .seconds(5))
            // 撤销写进行中（isSaving）不自毁——否则 5s 定时器会与撤销写竞争，写失败后撤销条已消失、
            // 用户失去重试入口（补量撤销无持久兜底，审查 MAJOR）。撤销失败时撤销条留存供再试。
            if undoBanner?.id == banner.id, !sessionStore.isSaving { undoBanner = nil }
        }
    }

    private func undoAdoption(_ banner: UndoBanner) async {
        let ok: Bool
        switch banner.kind {
        case .swap(let originalId): ok = await sessionStore.removeExerciseSubstitution(originalId: originalId)
        case .swapOneTime(let originalId): ok = await sessionStore.removeOneTimeSubstitution(originalId: originalId)
        case .dayOverride: ok = await sessionStore.removeOneTimeDayOverride()
        case .volume(let week): ok = await sessionStore.removeVolumeBoost(weekStartISO: week)
        }
        // 撤销写失败保留撤销条（错误面已如实呈现），用户可再试——尤其补量撤销无持久兜底入口（审查 MAJOR）。
        if ok {
            commitPulse += 1
            undoBanner = nil
        }
    }

    /// 该动作当前是哪个到顶动作的**永久**替代（actualId→originalId 反查落库覆盖 map）；非替代返回 nil。
    private func swapOriginalId(for exerciseId: String) -> String? {
        model?.substitutions.first { $0.value == exerciseId }?.key
    }

    /// 该动作当前是哪个动作的**今天临时**替代（FR-TR6「只换这次」）；非临时替代返回 nil。
    private func oneTimeOriginalId(for exerciseId: String) -> String? {
        model?.oneTimeSubstitutions.first { $0.value == exerciseId }?.key
    }

    // MARK: - 动作详情（FR-EX2；只读元数据 + 同族替代，主界面不堆元数据）

    private struct ExerciseDetailTarget: Identifiable {
        let id: String              // id = exerciseId
        var swapIntent: Bool = false // 切片6c：教练卡「换个动作」入口 = true → 替代列表升级为可点采纳
    }

    /// 切片6c：采纳后撤销条。kind 携带反向写所需 key；id 供动画/自毁去重。
    private struct UndoBanner: Identifiable {
        enum Kind {
            case swap(originalId: String)
            case swapOneTime(originalId: String)   // FR-TR6「只换这次」：撤销路由到 removeOneTimeSubstitution
            case dayOverride                        // FR-TR12「今天换一天练」：撤销路由到 removeOneTimeDayOverride
            case volume(weekStartISO: String)
        }
        let id = UUID()
        let kind: Kind
        let text: String
    }

    /// FR-TR6 待定换动作：点了替代项、等用户在「只换这次/以后都换」二选一时携带写入所需信息。
    private struct PendingSwap: Identifiable {
        let id = UUID()
        let rootOriginal: String    // 覆盖写在的根 originalId（root-collapse 后）
        let altId: String           // 换成的替代动作
        let altName: String         // 替代动作显示名（toast 用）
        let fromExerciseId: String  // 被换走的当前展示动作（诚实校验：换后处方是否真换出）
    }

    /// FR-TR6 执行换动作：oneTime=true→只换今天（次日自动恢复）；false→以后都换（永久）。诚实：换后若处方
    /// 仍含被换动作（替代非本槽合法候选、plan() 优雅回退）→ 清掉死覆盖、不假报；否则给撤销条。
    private func applySwap(_ swap: PendingSwap, oneTime: Bool) async {
        let ok: Bool
        if oneTime {
            ok = await sessionStore.applyOneTimeSubstitution(originalId: swap.rootOriginal, actualId: swap.altId)
        } else {
            // 「以后都换」覆盖同 key 的「只换这次」：先清临时项，否则临时优先会遮蔽刚写的永久项、
            // 诚实校验误判把永久项又删掉（审查 MAJOR-2）。仅当确有临时项才清，避免多一次空写盘。
            if model?.oneTimeSubstitutions[swap.rootOriginal] != nil {
                _ = await sessionStore.removeOneTimeSubstitution(originalId: swap.rootOriginal)
            }
            ok = await sessionStore.applyExerciseSubstitution(originalId: swap.rootOriginal, actualId: swap.altId)
        }
        guard ok else { return }
        detailTarget = nil
        // model 为 nil（无法确认）时默认 false：倾向**保留**刚写盘的覆盖、不误删（审查 MAJOR）。
        let stillHasOriginal = model?.prescription?.exercises.contains { $0.exerciseId == swap.fromExerciseId } ?? false
        if stillHasOriginal {
            if oneTime { _ = await sessionStore.removeOneTimeSubstitution(originalId: swap.rootOriginal) }
            else { _ = await sessionStore.removeExerciseSubstitution(originalId: swap.rootOriginal) }
        } else {
            commitPulse += 1
            undoBanner = UndoBanner(
                kind: oneTime ? .swapOneTime(originalId: swap.rootOriginal) : .swap(originalId: swap.rootOriginal),
                text: oneTime ? s.swapOnceAdoptedToast(exerciseName: swap.altName) : s.swapAdoptedToast(exerciseName: swap.altName)
            )
        }
    }

    // K2（2026-07-16）：信息主体抽到共享 ExerciseDetailSheet（动作库/训练中复用）；
    // 今日页专属的「换回原动作」CTA 与替代动作区经注入槽保留在此——行为逐字节不变。
    private func exerciseDetailSheet(_ target: ExerciseDetailTarget) -> some View {
        let exerciseId = target.id
        let entry = ExerciseCatalog.minimal.entry(id: exerciseId)
        // 该动作若是某到顶动作的替代 → 顶部露「换回原动作」撤销入口（持久，与即时 toast 互补）。
        // 永久替代走 removeExerciseSubstitution；FR-TR6 今天临时替代走 removeOneTimeSubstitution（文案标明明天自动恢复）。
        let revertOriginalId = swapOriginalId(for: exerciseId)
        let oneTimeRevertOriginalId = oneTimeOriginalId(for: exerciseId)
        return ExerciseDetailSheet(exerciseId: exerciseId) {
            if let originalId = revertOriginalId {
                adoptCTA(s.swapRevertHint(originalName: localeStore.exerciseName(originalId))) {
                    Task {
                        if await sessionStore.removeExerciseSubstitution(originalId: originalId) { detailTarget = nil }
                    }
                }
            } else if let originalId = oneTimeRevertOriginalId {
                adoptCTA(s.swapOnceRevertHint(originalName: localeStore.exerciseName(originalId))) {
                    Task {
                        if await sessionStore.removeOneTimeSubstitution(originalId: originalId) { detailTarget = nil }
                    }
                }
            }
        } alternativesSection: {
            if let entry {
                VStack(alignment: .leading, spacing: 6) {
                    // 换动作意图：标题换成选择提示，替代项升级为可点采纳行（选中即写，撤销兜底，无二次确认）。
                    Overline(text: target.swapIntent ? s.swapPickerHint : s.exerciseDetailAlternatives)
                    let alts = alternatives(for: entry)
                    if alts.isEmpty {
                        Text(s.exerciseDetailNoAlternatives)
                            .font(.redeBody).foregroundStyle(Color.redeT3)
                    } else if target.swapIntent {
                        ForEach(alts, id: \.self) { altId in
                            Button {
                                // root-collapse：若当前动作本身是某动作的（永久或临时）替代，覆盖写在**根 originalId** 上，
                                // 不建 B→C 链（避免 key 语义错位；撤销也回到根，审查 MINOR）。
                                let rootOriginal = swapOriginalId(for: exerciseId) ?? oneTimeOriginalId(for: exerciseId) ?? exerciseId
                                // FR-TR6：先弹「只换这次 / 以后都换」二选一（见 .confirmationDialog），选完才写。
                                pendingSwap = PendingSwap(
                                    rootOriginal: rootOriginal, altId: altId,
                                    altName: localeStore.exerciseName(altId), fromExerciseId: exerciseId
                                )
                            } label: {
                                HStack {
                                    Text(localeStore.exerciseName(altId))
                                        .font(.redeBody).foregroundStyle(Color.redeT1)
                                    Spacer()
                                    Image(systemName: "arrow.left.arrow.right")
                                        .font(.redeCaption).foregroundStyle(Color.redeEmber2)
                                }
                                .frame(minHeight: RedeShape.controlHeight)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.redePressableRow)
                            .disabled(sessionStore.isSaving)
                        }
                    } else {
                        ForEach(alts, id: \.self) { altId in
                            Text(localeStore.exerciseName(altId))
                                .font(.redeBody).foregroundStyle(Color.redeT2)
                        }
                    }
                }
            }
        }
        // FR-TR6：点替代项后弹「只换这次 / 以后都换」品牌面板（替代原生 confirmationDialog），选完才写。
        // 嵌在动作详情 sheet 之上（保留动作上下文，同原 action sheet 浮于其上的口径）。
        .sheet(item: $pendingSwap) { swap in
            RedeChoiceSheet(
                title: s.swapScopeTitle,
                message: s.swapScopeMessage(exerciseName: swap.altName),
                options: [
                    RedeChoiceOption(title: s.swapScopeOnce, emphasis: true,
                                     action: { pendingSwap = nil; Task { await applySwap(swap, oneTime: true) } }),
                    RedeChoiceOption(title: s.swapScopeAlways,
                                     action: { pendingSwap = nil; Task { await applySwap(swap, oneTime: false) } }),
                ],
                cancelLabel: s.commonCancel,
                onCancel: { pendingSwap = nil }
            )
        }
    }

    /// 替代动作候选——用 `swapCandidates`：**只列引擎真会接受的**（同 pattern + 守该槽 equipment 偏好 +
    /// 守场景 + 排除已用）。否则会列出引擎换不成的动作（如 lower 日复合深蹲槽要 machine 却列了杠铃/哑铃深蹲），
    /// 用户点了悄无声息回退、看着像「没实现」。确保点了就换得成。
    private func alternatives(for entry: ExerciseCatalogEntry) -> [String] {
        guard let dayCode = model?.prescription?.dayCode else { return [] }
        let currentIds = model?.prescription?.exercises.map(\.exerciseId) ?? []
        return TodayPrescriptionEngine.swapCandidates(
            for: entry.id, dayCode: dayCode, currentIds: currentIds,
            equipmentScenario: model?.equipmentScenario
        )
        .prefix(6)
        .map { $0 }
    }

}

#Preview {
    TodayTabView(onStartTraining: {})
        .environment(LocaleStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
