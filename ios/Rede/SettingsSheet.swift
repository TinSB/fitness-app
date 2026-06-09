import SwiftUI
import RedeL10n

// 设置(M0-3 临时 sheet):只承载语言切换;完整 Profile/Settings 由 M5-2 接管。

struct SettingsSheet: View {
    @Bindable var store: LocaleStore
    @Environment(\.dismiss) private var dismiss

    private var s: RedeStrings { store.strings }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(s.settingsTitle)
                    .font(.redeSubhead)
                    .foregroundStyle(Color.redeT1)
                Spacer()
                Button(s.settingsDone) { dismiss() }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.redeT2)
                    .frame(minHeight: RedeShape.controlHeight)
                    .buttonStyle(.plain)
            }
            .padding(.horizontal, RedeSpace.page)
            .padding(.top, 8)

            Overline(text: s.settingsLanguage)
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, RedeSpace.section)
                .padding(.bottom, 8)

            HStack(spacing: 8) {
                ForEach(RedeLocale.allCases, id: \.self) { option in
                    SteelButton(title: option.displayName, isOn: store.locale == option) {
                        store.locale = option
                    }
                }
            }
            .padding(.horizontal, RedeSpace.page)

            Text(s.settingsComingSoon)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, RedeSpace.section)

            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
    }
}

#Preview {
    SettingsSheet(store: LocaleStore())
}
