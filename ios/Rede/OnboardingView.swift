import SwiftUI
import UIKit
import RedeL10n
import RedeTrainingDecision

// Onboarding — M5-1 首启引导（FR-ON1/2/3；方向 B「仪表卡步进」拍板 2026-06-10，
// 设计真相 rede-11b-onboarding-step.html）。
// 一题一屏锻面卡原地形变；顶部四格刻线进度（当前格 ember，已答格可点回跳）；
// 选完自动推进（reduced-motion 瞬切）；答完写闸落盘 → 结果卡读真实首练处方。
// 防向导味：无 Next/Back 按钮、无 Step x of y；结果是判断卡不是庆祝页。

struct OnboardingView: View {
    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let onFinish: () -> Void

    private enum Step: Int, CaseIterable {
        case goal = 0, days, equipment, level
    }

    @State private var step: Int = 0           // 0...3 = 问题；4 = 结果卡
    @State private var goal: String?
    @State private var days: Int?
    @State private var equipment: String?
    @State private var level: String?
    @State private var saving = false
    @State private var writeFailed = false
    @State private var selectionPulse = 0
    /// 只在写盘真正成功后递增（打磨 2026-06-10：原在 await 前发——失败也先震「成功」）。
    @State private var successPulse = 0
    /// 写盘失败触感（.error）；只在真失败时递增，对齐成功路径的 success。
    @State private var errorPulse = 0
    /// 上次成功落盘的四答快照：回看结果卡不改答案时跳过冗余覆盖写。
    @State private var savedAnswers: [String]?

    private var s: RedeStrings { localeStore.strings }
    private var answeredCount: Int { [goal != nil, days != nil, equipment != nil, level != nil].filter { $0 }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            tickRail
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 12)
            ZStack(alignment: .topLeading) {
                if step < Step.allCases.count {
                    questionCard(Step(rawValue: step) ?? .goal)
                        .transition(cardTransition)
                        .id(step)
                } else {
                    resultCard
                        .transition(cardTransition)
                }
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, 16)
            // 结果卡隐藏页脚（11b：obMeta 在 result 态隐藏——「四个回答」是过期信息）
            if step < Step.allCases.count {
                Text(s.onbFooterNote)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 12)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.redeBase)
        .sensoryFeedback(.selection, trigger: selectionPulse)
        .sensoryFeedback(.success, trigger: successPulse)
        .sensoryFeedback(.error, trigger: errorPulse)
    }

    private var cardTransition: AnyTransition {
        reduceMotion
            ? .identity
            : .asymmetric(
                insertion: .opacity.combined(with: .scale(scale: 0.99)),
                removal: .opacity
            )
    }

    // MARK: - 头部 + 刻线进度

    private var header: some View {
        HStack {
            Text("REDE")
                .font(.system(size: 13, weight: .semibold))
                .tracking(2.2)
                .foregroundStyle(Color.redeT1)
            Spacer()
            Overline(text: s.onbHeaderTag)
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, 14)
    }

    /// 四格刻线（S2 语义）：当前格 ember、已答格中性、未答格 hairline；已答格可点回跳。
    private var tickRail: some View {
        HStack(spacing: 6) {
            ForEach(0..<4, id: \.self) { index in
                let answered = index < answeredCount
                let isCurrent = index == step
                Button(action: {
                    // 保存进行中不许回跳（审查 MINOR-2：防写入窗口内二次 submit）
                    guard answered, !saving, index < step || step == Step.allCases.count else { return }
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { step = index }
                    announceStep(index)
                }) {
                    Rectangle()
                        .fill(isCurrent ? Color.redeEmber : (answered ? Color.redeNeu : Color.redeHair2))
                        .frame(height: 3)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 44) // 命中区
                        .contentShape(Rectangle())
                }
                .buttonStyle(.redePressableRow)
                // a11y 对齐 11b：题名 + 状态（原仅「1/4」，VO 用户不知道跳到哪题）
                .accessibilityLabel(tickLabel(index, answered: answered, current: isCurrent))
                .accessibilityHidden(!answered && !isCurrent)
            }
        }
        .frame(height: 44)
    }

    private var stepLabels: [String] { [s.onbGoalLabel, s.onbDaysLabel, s.onbEquipLabel, s.onbLevelLabel] }

    private func tickLabel(_ index: Int, answered: Bool, current: Bool) -> String {
        var parts = [stepLabels[index]]
        if current { parts.append(s.onbA11yCurrent) } else if answered { parts.append(s.onbA11yAnswered) }
        return parts.joined(separator: " · ")
    }

    /// VO 播报步进切换（380ms 自动推进对 VO 用户原本完全静默）。
    private func announceStep(_ index: Int) {
        guard UIAccessibility.isVoiceOverRunning else { return }
        let title = index < Step.allCases.count ? stepLabels[index] : s.onbReadyTag
        UIAccessibility.post(notification: .screenChanged, argument: title)
    }

    // MARK: - 问题卡

    private func questionCard(_ q: Step) -> some View {
        ForgedCard(emberBarInset: 18) {
            VStack(alignment: .leading, spacing: 0) {
                switch q {
                case .goal:
                    Overline(text: s.onbGoalLabel)
                    questionTitle(s.onbGoalQuestion)
                    OnbOptionRows(codes: ["hypertrophy", "strength", "general"],
                                  selected: goal, option: s.onbGoalOption) { pick($0) }
                case .days:
                    Overline(text: s.onbDaysLabel)
                    questionTitle(s.onbDaysQuestion)
                    // 防高估副注（打磨 2026-06-10：直选带需要文字对冲「理想周」偏差）
                    Text(s.onbDaysNote)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT4)
                        .padding(.top, 4)
                    OnbDaysBand(selected: days, daysLabel: s.settingsDaysValue) { pickDays($0) }
                case .equipment:
                    Overline(text: s.onbEquipLabel)
                    questionTitle(s.onbEquipQuestion)
                    OnbOptionRows(codes: ["commercial-gym", "home-dumbbell", "minimal"],
                                  selected: equipment, option: s.onbEquipOption) { pick($0) }
                case .level:
                    Overline(text: s.onbLevelLabel)
                    questionTitle(s.onbLevelQuestion)
                    Text(s.onbLevelNote)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT4)
                        .padding(.top, 4)
                    OnbOptionRows(codes: ["beginner", "intermediate", "advanced"],
                                  selected: level, option: s.onbLevelOption) { pick($0) }
                }
            }
            .padding(.leading, 13)
            .padding(.vertical, 20)
            .padding(.horizontal, RedeSpace.card)
            .frame(maxWidth: .infinity, minHeight: 470, alignment: .topLeading)
        }
    }

    private func questionTitle(_ text: String) -> some View {
        Text(text)
            .font(.redeHeadline)
            .foregroundStyle(Color.redeT1)
            .padding(.top, 8)
    }

    // 选项行与天数带抽为文件级共享组件（设置单题编辑复用），见文件底部。

    // MARK: - 选择与推进

    private func pick(_ code: String) {
        switch Step(rawValue: step) {
        case .goal: goal = code
        case .equipment: equipment = code
        case .level: level = code
        default: break
        }
        selectionPulse += 1
        advance()
    }

    private func pickDays(_ n: Int) {
        days = n
        selectionPulse += 1
        advance()
    }

    private func advance() {
        let origin = step
        // 打磨 2026-06-10（对齐 11b nextState）：四答齐全时直返结果卡——
        // 从结果卡回改一题后不再被迫重走后续所有题
        let target = answeredCount == Step.allCases.count ? Step.allCases.count : step + 1
        let go = {
            // 守卫过时闭包（审查 MAJOR-1）：380ms 内用户已回跳/改步 → 放弃本次推进
            guard step == origin else { return }
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) { step = target }
            announceStep(target)
            if target == Step.allCases.count { submit() }
        }
        if reduceMotion {
            go()
        } else {
            // 380ms 确认拍：让选中态先被看见，再形变推进（设计真相节奏）
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.38, execute: go)
        }
    }

    private func submit() {
        guard !saving else { return } // 幂等（审查 MINOR-1）：防双发误闪「保存失败」
        guard let goal, let days, let equipment, let level else { return }
        let key = [goal, String(days), equipment, level]
        // 回看结果卡未改答案 → 跳过冗余覆盖写（OnboardingWrite 覆盖写合同不动）。
        // 审查 MINOR-1：改回已落盘的原答案时必须清旧失败标记，否则假错误死锁
        guard savedAnswers != key else {
            writeFailed = false
            return
        }
        saving = true
        writeFailed = false
        Task {
            let ok = await sessionStore.completeOnboarding(OnboardingAnswers(
                primaryGoal: goal, weeklyDays: days, equipmentScenario: equipment, trainingLevel: level
            ))
            saving = false
            writeFailed = !ok
            if ok {
                savedAnswers = key
                // 成功触觉只在写盘真正成功后发（打磨：原失败也先震「成功」）
                successPulse += 1
            } else {
                errorPulse += 1 // 写盘失败 = error 触感（原本静默）
            }
        }
    }

    // MARK: - 结果卡（FR-ON3：真实首练处方）

    private var resultCard: some View {
        let template = currentTemplate
        let first = sessionStore.todayModel?.prescription?.exercises.first
        return ForgedCard(emberBarInset: 18) {
            VStack(alignment: .leading, spacing: 0) {
                // 绿点+「计划就绪」只在写盘成功后亮（打磨：原与失败红字同屏矛盾）
                if !saving && !writeFailed {
                    HStack(spacing: 7) {
                        Circle().fill(Color.redeRec).frame(width: 7, height: 7)
                        Overline(text: s.onbReadyTag, color: .redeRec2)
                    }
                }
                Text(s.onbVerdict(
                    splitCode: template?.splitType ?? "upper-lower",
                    days: template?.daysPerWeek ?? days ?? 3,
                    goalCode: goal ?? "general"
                ))
                .font(.redeHeadline)
                .foregroundStyle(Color.redeT1)
                .padding(.top, 10)

                // 器械回声行（11b equipLine——四答里唯一没被回读的回答，打磨补齐）
                if let equipment {
                    Text(s.onbEquipEcho(equipment))
                        .font(.redeCallout)
                        .foregroundStyle(Color.redeT3)
                        .padding(.top, 8)
                }

                if saving {
                    Text("…")
                        .font(.redeCallout)
                        .foregroundStyle(Color.redeT3)
                        .padding(.top, 14)
                } else if writeFailed {
                    Text(s.onbWriteFailed)
                        .font(.redeCallout)
                        .foregroundStyle(Color.redeRisk)
                        .padding(.top, 14)
                    if let detail = sessionStore.saveErrorText {
                        Text(detail)
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT4)
                            .lineLimit(2)
                            .padding(.top, 2)
                    }
                    SteelButton(title: s.onbRetry, action: submit)
                        .padding(.top, 12)
                } else {
                    if let first {
                        Overline(text: s.onbFirstSession)
                            .padding(.top, 18)
                        Text(localeStore.exerciseName(first.exerciseId))
                            .font(.redeSubhead)
                            .foregroundStyle(Color.redeT1)
                            .padding(.top, 6)
                        HStack(alignment: .bottom, spacing: 6) {
                            Text(s.formatKg(first.targetWeightKg))
                                .font(.system(size: 20, weight: .semibold))
                                .monospacedDigit()
                                .foregroundStyle(Color.redeT1)
                            Text(s.trainLoadSuffix(targetReps: first.targetReps, targetRir: first.targetRir))
                                .font(.redeCallout)
                                .monospacedDigit()
                                .foregroundStyle(Color.redeT3)
                                .padding(.bottom, 2)
                        }
                        .padding(.top, 3)
                    }
                    HStack(spacing: 6) {
                        Rectangle().fill(Color.redeNeu).frame(width: 11, height: 2)
                        Text(s.onbPriorNote(level ?? "intermediate"))
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT3)
                    }
                    .padding(.top, 14)
                    EmbButton(icon: "arrow.right", title: s.onbOpenToday, action: onFinish)
                        .padding(.top, 16)
                }
            }
            .padding(.leading, 13)
            .padding(.vertical, 20)
            .padding(.horizontal, RedeSpace.card)
            .frame(maxWidth: .infinity, minHeight: 470, alignment: .topLeading)
        }
    }

    private var currentTemplate: ProgramTemplateInit? {
        guard let goal, let days, let equipment, let level else { return nil }
        return OnboardingPlanInit.template(for: OnboardingAnswers(
            primaryGoal: goal, weeklyDays: days, equipmentScenario: equipment, trainingLevel: level
        ))
    }
}

// MARK: - 共享题卡组件（首启引导 + 设置单题编辑复用；工艺对齐 11b 拍板稿）

/// 选项行：标题 + 副注，64pt 行高；选中 = 钢色左缘 + 钢色底 0.13 + 副注提亮；
/// 行间 hairline 分隔（末行不画）。ember 不出现（口音只给下一步）。
struct OnbOptionRows: View {
    let codes: [String]
    let selected: String?
    let option: (String) -> (title: String, caption: String)
    let action: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(codes.enumerated()), id: \.element) { index, code in
                let pair = option(code)
                let isOn = selected == code
                Button(action: { action(code) }) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(pair.title)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(isOn ? Color.redeT1 : Color.redeT2)
                        Text(pair.caption)
                            .font(.redeCaption)
                            .foregroundStyle(isOn ? Color.redeT3 : Color.redeT4)
                    }
                    .padding(.vertical, 11)
                    .padding(.leading, 10)
                    .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
                    .overlay(alignment: .leading) {
                        if isOn { Rectangle().fill(Color.redeSteel).frame(width: 2) }
                    }
                    .background(isOn ? Color.redeSteel.opacity(0.13) : Color.clear)
                    .overlay(alignment: .bottom) {
                        if index < codes.count - 1 {
                            Rectangle().fill(Color.redeHair2).frame(height: 1).padding(.leading, 10)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.redePressableRow)
                .accessibilityAddTraits(isOn ? .isSelected : [])
            }
        }
        .padding(.top, 10)
    }
}

/// 天数直选带：2-6 仪表数字（76pt 格），选中 = 数字下独立 12×2 钢 tick；
/// 格间 S2 刻线（redeEtch）分隔。
struct OnbDaysBand: View {
    let selected: Int?
    /// VO 标签（"每周 n 天"），由调用方注入 L10n。
    let daysLabel: (Int) -> String
    let action: (Int) -> Void

    var body: some View {
        HStack(spacing: 0) {
            ForEach(2...6, id: \.self) { n in
                if n > 2 { Rectangle().fill(Color.redeEtch).frame(width: 1, height: 10) }
                Button(action: { action(n) }) {
                    VStack(spacing: 8) {
                        Text("\(n)")
                            .font(.system(size: 26, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(selected == n ? Color.redeT1 : Color.redeT3)
                        Rectangle()
                            .fill(selected == n ? Color.redeSteel : Color.clear)
                            .frame(width: 12, height: 2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 76)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.redePressableRow)
                .accessibilityLabel(daysLabel(n))
                .accessibilityAddTraits(selected == n ? .isSelected : [])
            }
        }
        .padding(.top, 14)
    }
}

#Preview {
    OnboardingView(onFinish: {})
        .environment(LocaleStore())
        .environment(SessionStore())
        .preferredColorScheme(.dark)
}
