import SwiftUI
import RedeL10n

// 语言 + 单位状态（M0-3 语言 → M5-2 增单位与持久化）。
// 默认：语言跟随系统、单位 kg；启动时由 RootTabView 从 AppData profile
// 读取持久化偏好覆盖（写路径经写闸，本层不做 IO）。

@Observable
final class LocaleStore {
    var locale: RedeLocale
    var unit: RedeUnit = .kg

    var strings: RedeStrings { RedeStrings(locale: locale, unit: unit) }

    init() {
        let systemCode = Locale.current.language.languageCode?.identifier
        locale = RedeLocale.resolve(fromLanguageCode: systemCode)
    }

    /// 启动时应用 AppData 里的持久化偏好；缺失项保持当前默认（不猜）。
    func applyPersisted(unitRaw: String?, localeRaw: String?) {
        if let unitRaw { unit = RedeUnit.resolve(unitRaw) }
        if let localeRaw, let persisted = RedeLocale(rawValue: localeRaw) { locale = persisted }
    }
}
