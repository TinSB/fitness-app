import SwiftUI

// Plan — 按 rede-app.html #s-plan 复原。
// 时间线:done 降级暗色,today 内嵌锻面卡为该屏重心,next 空心点;controls 钢色开关。

struct PlanTabView: View {
    let onStartTraining: () -> Void

    @State private var holdPlan = false
    @State private var lockBench = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: "Plan", subtitle: "Hypertrophy · Week 3 of 5", trailingIcon: "slider.horizontal.3")

                // 周期点条: 5 周,前 2 ember
                HStack(spacing: 5) {
                    ForEach(0..<5, id: \.self) { i in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(i < 2 ? Color.redeEmber : Color.redeNextDot)
                            .frame(height: 4)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 16)

                timeline
                    .padding(.top, 20)

                RuleDivider()

                controlsSection
                    .padding(.horizontal, RedeSpace.page)
            }
            .padding(.bottom, 78)
        }
        .background(Color.redeBase)
    }

    private var timeline: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Mon · done
            timelineRow(topLine: .clear, dot: AnyView(Circle().fill(Color.redeT4).frame(width: 13, height: 13)), bottomLine: .redeEmber) {
                VStack(alignment: .leading, spacing: 3) {
                    Overline(text: "Mon · done")
                    Text("Push A")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.redeT3)
                    Text("14.2k lb · 1 PR")
                        .font(.redeCaption)
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT3)
                }
                .padding(.bottom, 18)
            }

            // Wed · done
            timelineRow(topLine: .redeEmber, dot: AnyView(Circle().fill(Color.redeT4).frame(width: 13, height: 13)), bottomLine: .redeEmber) {
                VStack(alignment: .leading, spacing: 3) {
                    Overline(text: "Wed · done")
                    Text("Pull A")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.redeT3)
                    Text("11.8k lb")
                        .font(.redeCaption)
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT3)
                }
                .padding(.bottom, 18)
            }

            // Fri · today(内嵌锻面卡 = 该屏重心)
            timelineRow(topLine: .redeEmber, dot: AnyView(RingDot()), bottomLine: .redeHair) {
                VStack(alignment: .leading, spacing: 8) {
                    Overline(text: "Fri · today", color: .redeEmber2)
                    ForgedCard(emberBarInset: 14) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Push B")
                                .font(.system(size: 19, weight: .semibold))
                                .foregroundStyle(Color.redeT1)
                            Text("Overhead eased · 6 lifts · Bench 185 next")
                                .font(.redeCaption)
                                .monospacedDigit()
                                .foregroundStyle(Color.redeT3)
                                .padding(.top, 4)
                            EmbButton(icon: "play.fill", title: "Start training", iconSize: 14, fontSize: 13, action: onStartTraining)
                                .padding(.top, 12)
                        }
                        .padding(.leading, 11)
                        .padding(14)
                    }
                }
                .padding(.bottom, 18)
            }

            // Sun · next
            timelineRow(topLine: .redeHair, dot: AnyView(
                Circle().fill(Color.redeBase)
                    .frame(width: 13, height: 13)
                    .overlay(Circle().stroke(Color.redeNextDot, lineWidth: 2))
            ), bottomLine: .clear) {
                VStack(alignment: .leading, spacing: 3) {
                    Overline(text: "Sun · next")
                    Text("Legs")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.redeT2)
                    Text("Squat · RDL · Calf · 5 lifts")
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                }
                .padding(.bottom, 6)
            }
        }
    }

    private func timelineRow(topLine: Color, dot: AnyView, bottomLine: Color, @ViewBuilder content: () -> some View) -> some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 0) {
                Rectangle().fill(topLine).frame(width: 2).frame(minHeight: 8)
                dot.padding(.vertical, 2)
                Rectangle().fill(bottomLine).frame(width: 2).frame(maxHeight: .infinity)
            }
            .frame(width: 16)
            content()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, RedeSpace.page)
        .fixedSize(horizontal: false, vertical: true)
    }

    private var controlsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Overline(text: "Your controls")
                .padding(.bottom, 6)

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Hold the plan")
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT1)
                    Text("Stop auto-adjusting this week")
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                }
                Spacer()
                SteelToggle(isOn: $holdPlan)
            }
            .padding(.vertical, 6)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.redeHair2).frame(height: 1)
            }

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Lock bench +5/week")
                        .font(.redeBody)
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT1)
                    Text("Drive one lift on a fixed climb")
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                }
                Spacer()
                SteelToggle(isOn: $lockBench)
            }
            .padding(.vertical, 6)
        }
    }
}

#Preview {
    PlanTabView(onStartTraining: {})
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
