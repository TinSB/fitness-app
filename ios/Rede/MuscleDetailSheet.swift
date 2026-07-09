import SwiftUI
import RedeLocalSnapshot
import RedeL10n

// 肌群详情页（钻取层 2026-07-09，owner 拍板「详情页承载，效果优先」）——
// 头部大块等级 + 部位构成（back=背阔/上背/斜方、shoulders=前中后束，其余肌群无
// 子层只显依据）+ 依据区（原 Development 行内展开迁入此处）。子层纯展示：
// 不进 tier/balance/决策（防子块低置信污染整体判断）。未来趋势图预留此页。

struct MuscleDetailItem: Identifiable {
    let id: String                     // muscleId rawValue
    let estimate: MuscleLevelEstimate
    let subLevels: [MuscleSubLevel]
}

struct MuscleDetailSheet: View {
    let item: MuscleDetailItem

    @Environment(LocaleStore.self) private var localeStore
    private var s: RedeStrings { localeStore.strings }

    private var muscleName: String {
        MuscleGroupLabel(rawValue: item.id).map(s.muscleGroupName) ?? item.id
    }

    private var decisionLabel: String? {
        switch item.estimate.decision {
        case .prioritize: return s.muscleDecisionLabel(.prioritize)
        case .recover:
            return item.estimate.trend == .detraining
                ? s.muscleDecisionEaseBackIn : s.muscleDecisionLabel(.recover)
        default: return nil
        }
    }

    private var evidenceLines: [String] {
        var seen = Set<String>()
        var lines: [String] = []
        for code in item.estimate.evidence.map(\.code) + item.estimate.limitations.map(\.code) {
            guard seen.insert(code).inserted,
                  let label = MuscleEvidenceLabel(rawValue: code) else { continue }
            lines.append(s.muscleEvidenceLine(label))
        }
        return lines
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // 头部：大块等级（同 Development 行语义，字号放大）
                VStack(alignment: .leading, spacing: 10) {
                    Overline(text: s.developmentTitle, color: .redeT3)
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(muscleName)
                            .font(.redeHeadline)
                            .tracking(RedeTracking.headline)
                            .foregroundStyle(Color.redeT1)
                        Text(s.developmentLevel(item.estimate.currentLevel))
                            .font(.system(size: 28, weight: .bold)).monospacedDigit()
                            .foregroundStyle(Color.redeEmber2)
                        if item.estimate.trend == .rising {
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.redeEmber2)
                        } else if item.estimate.trend == .declining {
                            Image(systemName: "arrow.down.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.redeT3)
                        }
                    }
                    if let decisionLabel {
                        Text(decisionLabel)
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT3)
                    }
                    Capsule()
                        .fill(Color.redeT3.opacity(0.18))
                        .frame(height: 5)
                        .overlay(alignment: .leading) {
                            GeometryReader { geo in
                                Capsule()
                                    .fill(Color.redeEmber)
                                    .frame(width: geo.size.width
                                        * min(max(item.estimate.levelProgress, 0), 1))
                            }
                        }
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 26)

                // 部位构成（仅 back/shoulders 有子层）
                if !item.subLevels.isEmpty {
                    RuleDivider().padding(.top, 22)
                    VStack(alignment: .leading, spacing: 13) {
                        Overline(text: s.muscleDetailSubTitle)
                        ForEach(item.subLevels, id: \.muscleRaw) { sub in
                            subRow(sub)
                        }
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 18)
                }

                // 依据（原 Development 行内展开迁入）
                if !evidenceLines.isEmpty {
                    RuleDivider().padding(.top, 22)
                    VStack(alignment: .leading, spacing: 8) {
                        Overline(text: s.muscleDetailEvidenceTitle)
                        ForEach(evidenceLines, id: \.self) { line in
                            Text(line)
                                .font(.redeBody)
                                .foregroundStyle(Color.redeT3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 18)
                }

                Spacer(minLength: 32)
            }
        }
        .presentationBackground(Color.redeBase)
        .presentationDragIndicator(.visible)
        .presentationDetents([.medium, .large])
    }

    private func subRow(_ sub: MuscleSubLevel) -> some View {
        let name = MuscleSubGroupLabel(rawValue: sub.muscleRaw)
            .map(s.muscleSubGroupName) ?? sub.muscleRaw
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(name)
                .font(.redeBody)
                .foregroundStyle(Color.redeT1)
            Text(s.developmentLevel(sub.level))
                .font(.redeBody.weight(.semibold)).monospacedDigit()
                .foregroundStyle(sub.weeklyEffectiveAvg > 0 ? Color.redeEmber2 : Color.redeT4)
            Text(s.muscleSubWeeklySets(sub.weeklyEffectiveAvg))
                .font(.redeCaption)
                .foregroundStyle(Color.redeT4)
            Spacer(minLength: 12)
            Capsule()
                .fill(Color.redeT3.opacity(0.18))
                .frame(width: 64, height: 4)
                .overlay(alignment: .leading) {
                    Capsule()
                        .fill(sub.weeklyEffectiveAvg > 0 ? Color.redeEmber : Color.clear)
                        .frame(width: 64 * min(max(sub.progress, 0), 1), height: 4)
                }
        }
        .accessibilityElement(children: .combine)
    }
}
