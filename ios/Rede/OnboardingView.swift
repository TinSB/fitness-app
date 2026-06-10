import SwiftUI
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
    /// 只在抵达结果卡提交时递增（审查 NIT-1：Bool 触发器回跳也会响）。
    @State private var successPulse = 0

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
            Text(s.onbFooterNote)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT4)
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 12)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.redeBase)
        .sensoryFeedback(.selection, trigger: selectionPulse)
        .sensoryFeedback(.success, trigger: successPulse)
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
                }) {
                    Rectangle()
                        .fill(isCurrent ? Color.redeEmber : (answered ? Color.redeNeu : Color.redeHair2))
                        .frame(height: 3)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 44) // 命中区
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(index + 1)/4")
            }
        }
        .frame(height: 44)
    }

    // MARK: - 问题卡

    private func questionCard(_ q: Step) -> some View {
        ForgedCard(emberBarInset: 18) {
            VStack(alignment: .leading, spacing: 0) {
                switch q {
                case .goal:
                    Overline(text: s.onbGoalLabel)
                    questionTitle(s.onbGoalQuestion)
                    optionRows(codes: ["hypertrophy", "strength", "general"],
                               selected: goal, option: s.onbGoalOption) { pick($0) }
                case .days:
                    Overline(text: s.onbDaysLabel)
                    questionTitle(s.onbDaysQuestion)
                    daysBand
                case .equipment:
                    Overline(text: s.onbEquipLabel)
                    questionTitle(s.onbEquipQuestion)
                    optionRows(codes: ["commercial-gym", "home-dumbbell", "minimal"],
                               selected: equipment, option: s.onbEquipOption) { pick($0) }
                case .level:
                    Overline(text: s.onbLevelLabel)
                    questionTitle(s.onbLevelQuestion)
                    Text(s.onbLevelNote)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT4)
                        .padding(.top, 4)
                    optionRows(codes: ["beginner", "intermediate", "advanced"],
                               selected: level, option: s.onbLevelOption) { pick($0) }
                }
            }
            .padding(.leading, 13)
            .padding(.vertical, 20)
            .padding(.horizontal, RedeSpace.card)
            .frame(maxWidth: .infinity, minHeight: 380, alignment: .topLeading)
        }
    }

    private func questionTitle(_ text: String) -> some View {
        Text(text)
            .font(.redeHeadline)
            .foregroundStyle(Color.redeT1)
            .padding(.top, 8)
    }

    /// 选项行：标题 + 弱化副注，≥44pt 命中区；选中 = 钢色左缘 + 提亮（ember 只给下一步）。
    private func optionRows(
        codes: [String],
        selected: String?,
        option: @escaping (String) -> (title: String, caption: String),
        action: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(codes, id: \.self) { code in
                let pair = option(code)
                let isOn = selected == code
                Button(action: { action(code) }) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(pair.title)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(isOn ? Color.redeT1 : Color.redeT2)
                        Text(pair.caption)
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT4)
                    }
                    .padding(.vertical, 11)
                    .padding(.leading, 10)
                    .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
                    .overlay(alignment: .leading) {
                        if isOn { Rectangle().fill(Color.redeSteel).frame(width: 2) }
                    }
                    .background(isOn ? Color.redeHair.opacity(0.35) : Color.clear)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 10)
    }

    /// 天数直选带：2-6 大号仪表数字，刻线分隔。
    private var daysBand: some View {
        HStack(spacing: 0) {
            ForEach(2...6, id: \.self) { n in
                if n > 2 { Rectangle().fill(Color.redeHair2).frame(width: 1, height: 10) }
                Button(action: { pickDays(n) }) {
                    Text("\(n)")
                        .font(.system(size: 26, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(days == n ? Color.redeT1 : Color.redeT4)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .overlay(alignment: .bottom) {
                            if days == n { Rectangle().fill(Color.redeSteel).frame(width: 16, height: 2) }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 14)
    }

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
        let next = step + 1
        let go = {
            // 守卫过时闭包（审查 MAJOR-1）：380ms 内用户已回跳/改步 → 放弃本次推进
            guard step == next - 1 else { return }
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) { step = next }
            if next == Step.allCases.count { submit() }
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
        successPulse += 1
        saving = true
        writeFailed = false
        Task {
            let ok = await sessionStore.completeOnboarding(OnboardingAnswers(
                primaryGoal: goal, weeklyDays: days, equipmentScenario: equipment, trainingLevel: level
            ))
            saving = false
            writeFailed = !ok
        }
    }

    // MARK: - 结果卡（FR-ON3：真实首练处方）

    private var resultCard: some View {
        let template = currentTemplate
        let first = sessionStore.todayModel?.prescription?.exercises.first
        return ForgedCard(emberBarInset: 18) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 7) {
                    Circle().fill(Color.redeRec).frame(width: 7, height: 7)
                    Overline(text: s.onbReadyTag, color: .redeRec2)
                }
                Text(s.onbVerdict(
                    splitCode: template?.splitType ?? "upper-lower",
                    days: template?.daysPerWeek ?? days ?? 3,
                    goalCode: goal ?? "general"
                ))
                .font(.redeHeadline)
                .foregroundStyle(Color.redeT1)
                .padding(.top, 10)

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
                        Text(s.exerciseName(first.exerciseId))
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
            .frame(maxWidth: .infinity, minHeight: 380, alignment: .topLeading)
        }
    }

    private var currentTemplate: ProgramTemplateInit? {
        guard let goal, let days, let equipment, let level else { return nil }
        return OnboardingPlanInit.template(for: OnboardingAnswers(
            primaryGoal: goal, weeklyDays: days, equipmentScenario: equipment, trainingLevel: level
        ))
    }
}

#Preview {
    OnboardingView(onFinish: {})
        .environment(LocaleStore())
        .environment(SessionStore())
        .preferredColorScheme(.dark)
}
