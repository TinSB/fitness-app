import Foundation
import SwiftUI
import RedeL10n

/// Today 的非阻断更新信号（2026-07-20 收敛：三层块 → 单行开放行、移页底运维位）。
/// 「新版本 X.Y · 查看 · 稍后」量级——仅「查看」用 ember2（ember 只标训练下一步的
/// 唯一豁免动作），其余中性；7 天稍后语义与两个动作保留，a11y label 沿用完整文案。
struct AppUpdateSignalStrip: View {
    let version: String

    @Environment(LocaleStore.self) private var localeStore
    @Environment(AppUpdateModel.self) private var appUpdateModel
    @Environment(\.openURL) private var openURL

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 16) {
                titleText
                Spacer(minLength: 8)
                viewUpdateAction
                laterAction
            }
            // 大字号/窄屏：事实句单独一行，动作保持并排可点。
            VStack(alignment: .leading, spacing: 2) {
                titleText
                HStack(spacing: 20) {
                    viewUpdateAction
                    laterAction
                }
            }
        }
        .padding(.horizontal, RedeSpace.page)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.redeHair2).frame(height: 1)
                .padding(.horizontal, RedeSpace.page)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("app-update-signal")
    }

    private var titleText: some View {
        Text(s.appUpdateRowTitle(version: version))
            .font(.redeCaption)
            .monospacedDigit()
            .foregroundStyle(Color.redeT3)
            .fixedSize(horizontal: false, vertical: true)
            .frame(minHeight: RedeShape.controlHeight)
    }

    private var viewUpdateAction: some View {
        Button {
            openURL(RedeAppUpdateRuntime.appStoreURL)
        } label: {
            HStack(spacing: 5) {
                Text(s.appUpdateViewShort)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 10, weight: .semibold))
                    .accessibilityHidden(true)
            }
            .font(.redeCallout)
            .foregroundStyle(Color.redeEmber2)
            .frame(minHeight: RedeShape.controlHeight, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressable)
        .accessibilityLabel(s.appUpdateViewUpdate)
        .accessibilityIdentifier("app-update-view-update")
    }

    private var laterAction: some View {
        Button {
            appUpdateModel.snoozeAvailableUpdate()
        } label: {
            Text(s.appUpdateLater)
                .font(.redeCallout)
                .foregroundStyle(Color.redeT3)
                .frame(minHeight: RedeShape.controlHeight, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.redePressable)
        .accessibilityIdentifier("app-update-later")
    }
}

/// 内置、按版本冻结的叙事面。远端查询只能给版本号，不能向这里注入标题或营销文案。
struct AppUpdateWhatsNewSheet: View {
    let version: String
    var onComplete: () -> Void = {}

    @Environment(LocaleStore.self) private var localeStore
    @Environment(\.dismiss) private var dismiss

    private var s: RedeStrings { localeStore.strings }
    private var highlights: [String] { s.appUpdateHighlights(version: version) }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Overline(text: s.appUpdateSignalOverline(version: version), color: .redeEmber2)
                Spacer()
                Button(action: completeAndDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.redeT2)
                        .frame(width: RedeShape.controlHeight, height: RedeShape.controlHeight)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.redePressable)
                .accessibilityLabel(s.settingsDone)
                .accessibilityIdentifier("app-update-whats-new-close")
            }
            .padding(.leading, RedeSpace.page)
            .padding(.trailing, 8)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Color.redeHair2).frame(height: 1)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Overline(text: s.appUpdateWhatsNew)
                        .padding(.top, 30)

                    Text(version)
                        .font(.redeDisplay)
                        .tracking(RedeTracking.display)
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT1)
                        .padding(.top, 7)
                        .padding(.bottom, 22)
                        .accessibilityLabel("Rede \(version)")

                    Rectangle().fill(Color.redeHair).frame(height: 1)

                    ForEach(Array(highlights.enumerated()), id: \.offset) { index, title in
                        HStack(alignment: .firstTextBaseline, spacing: 16) {
                            Text(String(format: "%02d", index + 1))
                                .font(.redeOverline)
                                .tracking(RedeTracking.overline)
                                .monospacedDigit()
                                .foregroundStyle(Color.redeEmber2)
                                .accessibilityHidden(true)
                            Text(title)
                                .font(.redeHeadline)
                                .tracking(RedeTracking.headline)
                                .foregroundStyle(Color.redeT1)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.vertical, 22)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityElement(children: .combine)

                        Rectangle().fill(Color.redeHair2).frame(height: 1)
                    }
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.bottom, 24)
            }

            EmbButton(icon: "arrow.right", title: s.appUpdateContinue, action: completeAndDismiss)
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 12)
                .padding(.bottom, 12)
                .background(Color.redeBase)
                .accessibilityIdentifier("app-update-whats-new-continue")
        }
        .background {
            ZStack {
                Color.redeBase
                ForgedGrain(intensity: 0.33)
            }
            .ignoresSafeArea()
        }
        .preferredColorScheme(.dark)
        .accessibilityIdentifier("app-update-whats-new")
    }

    private func completeAndDismiss() {
        onComplete()
        dismiss()
    }
}
