import SwiftUI
import RedeL10n

// 语言状态(M0-3):默认跟随系统语言,App 内可切换。
// 暂不持久化——语言偏好的持久化随 M5-2 进 AppData profile(unit/locale scalar edit),
// 不引入 UserDefaults 真相存储。

@Observable
final class LocaleStore {
    var locale: RedeLocale

    var strings: RedeStrings { RedeStrings(locale: locale) }

    init() {
        let systemCode = Locale.current.language.languageCode?.identifier
        locale = RedeLocale.resolve(fromLanguageCode: systemCode)
    }
}
