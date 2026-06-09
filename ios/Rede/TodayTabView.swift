import SwiftUI

// Today — 按 rede-app.html #s-today 复原。
// 静态展示数据(D-B:判断句独占 hero,Load Plate 降为 20px 次级预览);M2 接引擎真数据,视觉不变。

struct TodayTabView: View {
    let onStartTraining: () -> Void

    @State private var reasonExpanded = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: "Today", subtitle: "Sat · Jun 8 · Week 3", trailingIcon: "gearshape")

                heroCard
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 20)

                receiptSection
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)

                RuleDivider()

                progressRail
                    .padding(.horizontal, RedeSpace.page)
            }
            .padding(.bottom, 78)
        }
        .background(Color.redeBase)
    }

    // HERO = 判断块(判断句唯一最大元素 + ember 左缘唯一口音)
    private var heroCard: some View {
        ForgedCard(emberBarInset: 18, showReg: true) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 7) {
                    Circle().fill(Color.redeRec).frame(width: 7, height: 7)
                    Overline(text: "Ready to train", color: .redeRec2)
                }

                Text("Train today. Push A stays, pressing volume capped.")
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .lineSpacing(22 * 0.3)
                    .foregroundStyle(Color.redeT1)
                    .lineLimit(3)
                    .padding(.top, 11)

                // Load Plate(20px 次级读数)
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 0) {
                        Overline(text: "Start here", color: .redeEmber2)
                        Text("Bench press")
                            .font(.redeSubhead)
                            .foregroundStyle(Color.redeT1)
                            .padding(.top, 7)
                        HStack(alignment: .bottom, spacing: 6) {
                            Text("185")
                                .font(.system(size: 20, weight: .semibold))
                                .monospacedDigit()
                                .foregroundStyle(Color.redeT1)
                            Text("lb · ×5 · RIR 2")
                                .font(.redeCallout)
                                .monospacedDigit()
                                .foregroundStyle(Color.redeT3)
                                .padding(.bottom, 3)
                        }
                        .padding(.top, 5)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 8) {
                        Text("then Incline DB")
                            .font(.redeCaption)
                            .monospacedDigit()
                            .foregroundStyle(Color.redeT3)
                        HStack(spacing: 5) {
                            Rectangle().fill(Color.redeNeu).frame(width: 16, height: 2)
                            Text("then Cable fly")
                                .font(.redeCaption)
                                .monospacedDigit()
                                .foregroundStyle(Color.redeT3)
                        }
                    }
                }
                .padding(.top, RedeSpace.section)
                .overlay(alignment: .top) {
                    Rectangle().fill(Color.redeHair).frame(height: 1)
                        .padding(.top, 10)
                }

                EmbButton(icon: "play.fill", title: "Start training", action: onStartTraining)
                    .padding(.top, 16)
            }
            .padding(.leading, 13)
            .padding(.vertical, 18)
            .padding(.horizontal, RedeSpace.card)
        }
    }

    // Receipt 渐进披露
    private var receiptSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Overline(text: "Rede training receipt")
                Spacer()
                Overline(text: "Today").monospacedDigit()
            }

            Text("Pressing volume is capped this week.")
                .font(.redeBody)
                .lineSpacing(14 * 0.45)
                .foregroundStyle(Color.redeT1)
                .padding(.top, 8)

            Button {
                withAnimation(.easeInOut(duration: 0.25)) { reasonExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Text(reasonExpanded ? "Hide reason" : "Why this call")
                    Image(systemName: "chevron.down")
                        .font(.system(size: 15))
                        .rotationEffect(.degrees(reasonExpanded ? 180 : 0))
                }
                .font(.redeBody)
                .foregroundStyle(Color.redeT3)
                .frame(minHeight: RedeShape.controlHeight)
            }
            .buttonStyle(.plain)

            if reasonExpanded {
                Grid(alignment: .topLeading, horizontalSpacing: 14, verticalSpacing: 8) {
                    GridRow {
                        Overline(text: "Signal").padding(.top, 3)
                        Text("Last overhead felt heavy · sleep 6.2h")
                            .font(.redeCallout).monospacedDigit()
                            .foregroundStyle(Color.redeT2)
                    }
                    GridRow {
                        Overline(text: "Change").padding(.top, 3)
                        Text("Overhead 95→85 lb · bench holds")
                            .font(.redeCallout).monospacedDigit()
                            .foregroundStyle(Color.redeT2)
                    }
                    GridRow {
                        Overline(text: "Control").padding(.top, 3)
                        HStack(spacing: 7) {
                            controlChip("Apply")
                            controlChip("Hold")
                            controlChip("Swap")
                        }
                    }
                }
                .padding(.top, 6)
            }
        }
    }

    private func controlChip(_ title: String) -> some View {
        Text(title)
            .font(.redeCaption)
            .foregroundStyle(Color.redeT2)
            .padding(.horizontal, 14)
            .frame(minHeight: RedeShape.controlHeight)
            .overlay(
                RoundedRectangle(cornerRadius: 8).stroke(Color.redeHair, lineWidth: 1)
            )
    }

    // Progress Rail: last → today → next
    private var progressRail: some View {
        VStack(alignment: .leading, spacing: 14) {
            Overline(text: "Bench · last to next")
            ZStack(alignment: .top) {
                GeometryReader { geo in
                    Rectangle()
                        .fill(Color.redeHair)
                        .frame(width: geo.size.width * 0.84, height: 2)
                        .offset(x: geo.size.width * 0.08, y: 7)
                }
                .frame(height: 16)

                HStack(alignment: .top, spacing: 0) {
                    railNode(dot: AnyView(Circle().fill(Color.redeT4).frame(width: 14, height: 14)),
                             value: "180×5", valueColor: .redeT3,
                             label: "Jun 5", labelColor: .redeT4)
                    railNode(dot: AnyView(RingDot()),
                             value: "185×5", valueColor: .redeT1,
                             label: "Today", labelColor: .redeEmber2)
                    railNode(dot: AnyView(
                        Circle().fill(Color.redeSurface)
                            .frame(width: 14, height: 14)
                            .overlay(Circle().stroke(Color.redeNextDot, lineWidth: 2))),
                             value: "190×5", valueColor: .redeT3,
                             label: "Next", labelColor: .redeT4)
                }
            }
        }
    }

    private func railNode(dot: AnyView, value: String, valueColor: Color, label: String, labelColor: Color) -> some View {
        VStack(spacing: 8) {
            dot.frame(height: 14)
            Text(value)
                .font(.redeCallout)
                .monospacedDigit()
                .foregroundStyle(valueColor)
            Overline(text: label, color: labelColor)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    TodayTabView(onStartTraining: {})
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
