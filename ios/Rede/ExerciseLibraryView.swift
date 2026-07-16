import SwiftUI
import RedeL10n
import RedeTrainingDecision

// ExerciseLibraryView — K2 动作库浏览器（2026-07-16，本批唯一组件投资）。
// 165 条目录此前 ~88% 内容永久不可见（详情只能从处方行/换动作/计划编辑器点进）——
// 本页给全量目录一个浏览入口：按主肌群契约组分组的行式清单（纯清单非卡片墙，
// 组件语法沿 FR-PL6 加动作 picker 的分组列表），行点开共享 FR-EX2 详情 sheet。
// 入口只在计划页（系统逻辑 §7：大型动作浏览禁入 Train——冲突裁定 1）。
// 只读目录、零写入、零 ember（浏览不是「下一步」）。

struct ExerciseLibraryView: View {
    @Environment(LocaleStore.self) private var localeStore
    @State private var detail: ExerciseDetailItem?

    private var s: RedeStrings { localeStore.strings }

    /// 分组清单：10 契约组按 MuscleGroupID 声明序（与 MLE 发展块同序）；
    /// 无契约归宿的少数动作（前臂类）按原始肌群码尾部单列——「全量可见」优先，
    /// 不硬塞进契约组（编造归属）也不丢弃（内容蒸发）。组内保持目录策展序。
    private var sections: [(title: String, entries: [ExerciseCatalogEntry])] {
        let all = ExerciseCatalog.minimal.entries.filter { !$0.deprecated }
        var byGroup: [String: [ExerciseCatalogEntry]] = [:]
        var unmappedOrder: [String] = []
        var unmapped: [String: [ExerciseCatalogEntry]] = [:]
        for entry in all {
            if let group = MuscleGroupMapping.group(forCatalogMuscle: entry.primaryMuscle) {
                byGroup[group.rawValue, default: []].append(entry)
            } else {
                if unmapped[entry.primaryMuscle] == nil { unmappedOrder.append(entry.primaryMuscle) }
                unmapped[entry.primaryMuscle, default: []].append(entry)
            }
        }
        var result: [(String, [ExerciseCatalogEntry])] = []
        for group in MuscleGroupID.allCases {
            guard let entries = byGroup[group.rawValue], !entries.isEmpty else { continue }
            // 契约组名走 MLE 同源 muscleGroupName（RedeL10n 镜像枚举，rawValue 对齐）。
            let title = MuscleGroupLabel(rawValue: group.rawValue).map(s.muscleGroupName) ?? group.rawValue
            result.append((title, entries))
        }
        for raw in unmappedOrder.sorted() {
            result.append((s.muscleLabel(raw), unmapped[raw] ?? []))
        }
        return result
    }

    var body: some View {
        let sections = self.sections
        let total = sections.reduce(0) { $0 + $1.entries.count }
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                Text(s.exerciseLibraryTitle)
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .foregroundStyle(Color.redeT1)
                Text(s.planDayExercises(total))
                    .font(.redeCaption).monospacedDigit()
                    .foregroundStyle(Color.redeT4)
                    .padding(.top, 4)

                ForEach(Array(sections.enumerated()), id: \.offset) { _, section in
                    Overline(text: section.title)
                        .padding(.top, RedeSpace.section)
                        .padding(.bottom, 4)
                    ForEach(section.entries, id: \.id) { entry in
                        row(entry)
                    }
                }
            }
            .padding(RedeSpace.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .presentationBackground(Color.redeBase)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .sheet(item: $detail) { item in
            ExerciseDetailSheet(exerciseId: item.id)
        }
        // K2 截图钩子（同 -autoOpenPlanEditor 先例）：-autoOpenLibraryDetail <exerciseId>
        // 自动点开库内某动作详情（simctl 无法点击 UI）。
        .task {
            let args = CommandLine.arguments
            if let i = args.firstIndex(of: "-autoOpenLibraryDetail"), args.indices.contains(i + 1) {
                detail = ExerciseDetailItem(id: args[i + 1])
            }
        }
    }

    /// 开放行：动作名 + 器械 · 主肌群（细粒度，组头之下再给一层定位）+ chevron。
    private func row(_ entry: ExerciseCatalogEntry) -> some View {
        Button { detail = ExerciseDetailItem(id: entry.id) } label: {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(localeStore.exerciseName(entry.id))
                            .font(.redeBody)
                            .foregroundStyle(Color.redeT1)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("\(s.equipmentLabel(entry.equipment)) · \(s.muscleLabel(entry.primaryMuscle))")
                            .font(.redeCaption)
                            .foregroundStyle(Color.redeT4)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.redeT4)
                        .accessibilityHidden(true) // 装饰性 affordance；行 Button 已承载动作
                }
                .padding(.vertical, 8)
                .frame(minHeight: RedeShape.controlHeight)
                Rectangle().fill(Color.redeHair2).frame(height: 1)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
        .accessibilityElement(children: .combine)
        .accessibilityHint(s.exerciseDetailHint)
    }
}

#Preview {
    Color.redeBase.sheet(isPresented: .constant(true)) {
        ExerciseLibraryView()
            .environment(LocaleStore())
    }
    .preferredColorScheme(.dark)
}
