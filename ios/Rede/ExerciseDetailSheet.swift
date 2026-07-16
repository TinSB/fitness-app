import SwiftUI
import RedeL10n
import RedeTrainingDecision

// ExerciseDetailSheet — FR-EX2 动作详情共享 sheet（K2 2026-07-16 从 TodayTabView 抽出）。
// 93 条含双语技术要点/退阶进阶/安全注意/循证 URL 的内容此前只能从处方行点进——
// 抽成共享件后动作库浏览器（计划页）与训练中当前动作（K2c）复用同一详情面。
// 行为契约：信息主体（标题→技术要点→调整难度→注意事项→元数据→循证）与原实现
// 逐字节一致；今日页专属的「换回原动作」CTA 与替代动作区经两个注入槽保留在
// TodayTabView（headerAccessory / alternativesSection），本文件零业务写入、只读目录。

/// `.sheet(item:)` 用的最小 Identifiable 包装（训练中/动作库共用；id = exerciseId）。
struct ExerciseDetailItem: Identifiable { let id: String }

struct ExerciseDetailSheet<HeaderAccessory: View, AlternativesSection: View>: View {
    let exerciseId: String
    @ViewBuilder var headerAccessory: () -> HeaderAccessory
    @ViewBuilder var alternativesSection: () -> AlternativesSection

    @Environment(LocaleStore.self) private var localeStore

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        let entry = ExerciseCatalog.minimal.entry(id: exerciseId)
        return ScrollView {
            VStack(alignment: .leading, spacing: RedeSpace.section) {
                Text(localeStore.exerciseName(exerciseId))
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .foregroundStyle(Color.redeT1)

                headerAccessory()

                if let entry {
                    // FR-EX2 技术要点（双语自由 prose；缺则不显示）——放元数据前，最有用内容优先。
                    if let cues = (s.locale == .zh ? entry.techniqueCuesZh : entry.techniqueCuesEn), !cues.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Overline(text: s.exerciseDetailTechnique)
                            ForEach(Array(cues.enumerated()), id: \.offset) { _, cue in
                                HStack(alignment: .top, spacing: 7) {
                                    Text("·").font(.redeBody).foregroundStyle(Color.redeT3)
                                    Text(cue).font(.redeBody).foregroundStyle(Color.redeT2)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }

                    // FR-EX2 调整难度（退阶/进阶；任一缺则不显示该行，零回归）——紧接技术要点，最有用的「怎么调」。
                    let regression = s.locale == .zh ? entry.regressionZh : entry.regressionEn
                    let progression = s.locale == .zh ? entry.progressionZh : entry.progressionEn
                    if regression?.isEmpty == false || progression?.isEmpty == false {
                        VStack(alignment: .leading, spacing: 6) {
                            Overline(text: s.exerciseDetailScaling)
                            if let r = regression, !r.isEmpty { scalingRow(s.exerciseDetailRegression, r) }
                            if let p = progression, !p.isEmpty { scalingRow(s.exerciseDetailProgression, p) }
                        }
                    }

                    // FR-EX2 注意事项（保守安全提示；§7.1 fitness≠medical，中性呈现不施压；缺则不显示）。
                    if let safety = (s.locale == .zh ? entry.safetyNoteZh : entry.safetyNoteEn), !safety.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Overline(text: s.exerciseDetailSafety)
                            Text(safety).font(.redeBody).foregroundStyle(Color.redeT2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    detailRow(s.exerciseDetailType, s.exerciseKindLabel(entry.kind))
                    detailRow(s.exerciseDetailPattern, s.movementPatternLabel(entry.movementPattern))
                    detailRow(s.exerciseDetailPrimary, s.muscleLabel(entry.primaryMuscle))
                    if !entry.secondaryMuscles.isEmpty {
                        detailRow(s.exerciseDetailSecondary, s.muscleListLabel(entry.secondaryMuscles))
                    }
                    detailRow(s.exerciseDetailEquipment, s.equipmentLabel(entry.equipment))

                    alternativesSection()

                    // FR-EX2 循证依据（真实可核验来源；缺则不显示）——置底作引用脚注，可点开真实出处。
                    if let tag = entry.evidenceTag, !tag.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Overline(text: s.exerciseDetailEvidence)
                            Text(tag).font(.redeCaption).foregroundStyle(Color.redeT3)
                                .fixedSize(horizontal: false, vertical: true)
                            // URL 失败（理论不达，来源已核验 https）则优雅降级：只显引用文本、无链接（graceful degradation）。
                            if let urlString = entry.evidenceUrl, let url = URL(string: urlString) {
                                Link(s.exerciseDetailViewSource, destination: url)
                                    .font(.redeCaption).foregroundStyle(Color.redeEmber2)
                                    .accessibilityLabel(s.exerciseDetailViewSource + "：" + tag) // VoiceOver 带来源上下文
                            }
                        }
                    }
                }
            }
            .padding(RedeSpace.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        // 整面板公理：sheet = 掀开的 base 锻面（同历史明细 sheet 口径）。
        .presentationBackground(Color.redeBase)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Overline(text: label)
            Text(value).font(.redeBody).foregroundStyle(Color.redeT1)
        }
    }

    // FR-EX2 退阶/进阶行：行内小标签（退阶/进阶）+ 双语 prose。
    private func scalingRow(_ label: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 7) {
            Text(label)
                .font(.redeCaption).foregroundStyle(Color.redeT3)
                .lineLimit(1)
                .frame(minWidth: 30, alignment: .leading)
            Text(text)
                .font(.redeBody).foregroundStyle(Color.redeT2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// 无注入槽的纯只读详情（动作库 / 训练中当前动作）。
extension ExerciseDetailSheet where HeaderAccessory == EmptyView, AlternativesSection == EmptyView {
    init(exerciseId: String) {
        self.init(exerciseId: exerciseId,
                  headerAccessory: { EmptyView() },
                  alternativesSection: { EmptyView() })
    }
}

#Preview {
    Color.redeBase.sheet(isPresented: .constant(true)) {
        ExerciseDetailSheet(exerciseId: "bench-press")
            .environment(LocaleStore())
    }
    .preferredColorScheme(.dark)
}
