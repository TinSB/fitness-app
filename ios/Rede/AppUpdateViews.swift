import Foundation
import SwiftUI
import RedeL10n

/// Today 的非阻断更新信号。保持开放行结构，不把版本提醒做成促销卡或强制弹窗。
struct AppUpdateSignalStrip: View {
    let version: String

    @Environment(LocaleStore.self) private var localeStore
    @Environment(AppUpdateModel.self) private var appUpdateModel
    @Environment(\.openURL) private var openURL

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Overline(text: s.appUpdateSignalOverline(version: version), color: .redeEmber2)

            Text(s.appUpdateSignalTitle)
                .font(.redeHeadline)
                .tracking(RedeTracking.headline)
                .foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 20) {
                    viewUpdateAction
                    laterAction
                }
                VStack(alignment: .leading, spacing: 2) {
                    viewUpdateAction
                    laterAction
                }
            }
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Color.redeEmber)
                .frame(width: 3)
                .padding(.vertical, 14)
        }
        .overlay(alignment: .top) {
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("app-update-signal")
    }

    private var viewUpdateAction: some View {
        Button {
            openURL(RedeAppUpdateRuntime.appStoreURL)
        } label: {
            HStack(spacing: 7) {
                Text(s.appUpdateViewUpdate)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .semibold))
                    .accessibilityHidden(true)
            }
            .font(.redeSubhead)
            .foregroundStyle(Color.redeEmber2)
            .frame(minHeight: RedeShape.controlHeight, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressable)
        .accessibilityIdentifier("app-update-view-update")
    }

    private var laterAction: some View {
        Button {
            appUpdateModel.snoozeAvailableUpdate()
        } label: {
            Text(s.appUpdateLater)
                .font(.redeBody)
                .foregroundStyle(Color.redeT2)
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
