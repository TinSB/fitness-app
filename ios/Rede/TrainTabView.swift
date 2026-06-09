import SwiftUI

// Train — 按 rede-app.html #s-train 复原(静态 set 态)。
// Rest morph、Hold 交互、Finish confirm/summary/share overlay 属 M3 训练流;M3 接入时视觉不变。

private struct SetRow: Identifiable {
    let id: Int
    let weight: Int
    let reps: Int
    let rir: Int
    let done: Bool
    let active: Bool
}

struct TrainTabView: View {
    private let sets: [SetRow] = [
        SetRow(id: 1, weight: 185, reps: 5, rir: 2, done: true, active: false),
        SetRow(id: 2, weight: 185, reps: 4, rir: 0, done: true, active: false),
        SetRow(id: 3, weight: 180, reps: 5, rir: 2, done: false, active: true),
        SetRow(id: 4, weight: 180, reps: 5, rir: 2, done: false, active: false),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header

                // session 进度条(42%)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2).fill(Color(redeHex: 0x1B1813))
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.redeNeu)
                            .frame(width: geo.size.width * 0.42)
                    }
                }
                .frame(height: 3)
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 14)

                heroCard
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)

                setTable
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)
            }
            .padding(.bottom, 78)
        }
        .background(Color.redeBase)
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Push A")
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .foregroundStyle(Color.redeT1)
                Overline(text: "Exercise 1 of 6 · Set 3 of 4").monospacedDigit()
            }
            Spacer()
            Text("Finish")
                .font(.system(size: 13))
                .foregroundStyle(Color.redeT3)
                .padding(.horizontal, 12)
                .frame(minHeight: RedeShape.controlHeight)
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, 8)
    }

    // HERO = 仪表读数(display 54 大数字)
    private var heroCard: some View {
        ForgedCard(emberBarInset: 18, showReg: true) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Bench press")
                    .font(.redeSubhead)
                    .foregroundStyle(Color.redeT1)

                HStack(alignment: .bottom, spacing: 9) {
                    Text("180")
                        .font(.redeDisplay)
                        .tracking(RedeTracking.display)
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT1)
                    Text("lb · × 5 · RIR 2")
                        .font(.redeBody)
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT3)
                        .padding(.bottom, 8)
                }
                .padding(.top, 8)

                HStack {
                    Text("Eased from 185 after a slow set 2")
                        .font(.redeCaption)
                        .monospacedDigit()
                        .lineSpacing(12 * 0.45)
                        .foregroundStyle(Color.redeT3)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    SteelButton(title: "Hold 185", action: {})
                }
                .padding(.top, 16)
                .overlay(alignment: .top) {
                    Rectangle().fill(Color.redeHair).frame(height: 1)
                        .padding(.top, 3)
                }

                HStack(spacing: 8) {
                    EmbButton(icon: "checkmark", title: "Log set", action: {})
                    HStack(spacing: 5) {
                        Image(systemName: "clock").font(.system(size: 15))
                        Text("2:00").monospacedDigit()
                    }
                    .font(.redeCallout)
                    .foregroundStyle(Color.redeT3)
                    .padding(.horizontal, 15)
                    .frame(minHeight: RedeShape.controlHeight)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10).stroke(Color.redeNextDot, lineWidth: 1)
                    )
                }
                .padding(.top, 16)
            }
            .padding(.leading, 13)
            .padding(.vertical, 18)
            .padding(.horizontal, RedeSpace.card)
            .frame(minHeight: 245, alignment: .topLeading)
        }
    }

    // set 表
    private var setTable: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 0) {
                Overline(text: "Set").frame(width: 34, alignment: .leading)
                Overline(text: "Weight").frame(maxWidth: .infinity, alignment: .leading)
                Overline(text: "Reps").frame(width: 44)
                Overline(text: "RIR").frame(width: 34)
                Spacer().frame(width: 16)
            }
            .padding(.bottom, 8)

            ForEach(sets) { row in
                setRowView(row)
            }

            Text("Next · Incline DB press · 3 × 8")
                .font(.redeCaption)
                .monospacedDigit()
                .foregroundStyle(Color.redeT3)
                .padding(.top, 14)
        }
    }

    private func setRowView(_ row: SetRow) -> some View {
        let color: Color = row.done ? .redeT2 : (row.active ? .redeT1 : .redeT4)
        return HStack(spacing: 0) {
            Text("\(row.id)").frame(width: 34, alignment: .leading)
            Text("\(row.weight) lb").frame(maxWidth: .infinity, alignment: .leading)
            Text("\(row.reps)").frame(width: 44)
            Text("\(row.rir)").frame(width: 34)
            Group {
                if row.done {
                    Image(systemName: "checkmark")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.redeT4)
                } else if row.active {
                    Circle().fill(Color.redeEmber).frame(width: 7, height: 7)
                } else {
                    Color.clear
                }
            }
            .frame(width: 16, alignment: .trailing)
        }
        .font(.redeCallout)
        .monospacedDigit()
        .foregroundStyle(color)
        .padding(.vertical, 9)
        .padding(.leading, row.active ? 8 : 0)
        .overlay(alignment: .leading) {
            if row.active {
                Rectangle().fill(Color.redeEmber).frame(width: 2)
                    .padding(.vertical, 6)
            }
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
    }
}

#Preview {
    TrainTabView()
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
