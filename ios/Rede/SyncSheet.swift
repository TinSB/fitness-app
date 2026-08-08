// SyncSheet — 云端同步页（FR-ACC1）。
//
// 视觉纪律（设计语言 §12 整面板公理）：本页**不使用 ForgedCard**。铭牌卡是训练现场
// 的语言（角标、颗粒、ember 左缘），给一件系统杂务用会让页面凭空多出一个 hero。
// 页面由三种形态各司其职：SyncGauge 回答状态、两列摘要给实感、44pt 行承载操作。
//
// 状态呈现的铁律：只要两个数字不等，就不显示「一致」。连不上时云端那侧显示破折号
// 而非上次的数字——连不上就是不知道，不能拿旧数冒充现在。

import AuthenticationServices
import CryptoKit
import RedeL10n
import SwiftUI

// MARK: - 双端对照

/// 同步只有一个真问题：两边一不一致。
///
/// 这个问题天然有两个数，所以给它双读数的形态——列表行表达不了「相等」与「差 3」
/// 的区别。中间那根线被刻断，断口里放状态符号；读数比例沿用 StatStrip
/// （小标签 + 大数值 + 小单位），刻线沿用 EngraveDivider 的语言。
struct SyncGauge: View {
    enum Status {
        case matched, fetching, behind, unclean, offline

        var symbol: String {
            switch self {
            case .matched: "arrow.left.arrow.right"
            case .fetching: "arrow.trianglehead.clockwise"
            case .behind: "exclamationmark.triangle"
            case .unclean: "exclamationmark.circle"
            case .offline: "icloud.slash"
            }
        }

        var tint: Color {
            switch self {
            case .matched: .redeRec2
            case .fetching: .redeSteel
            case .behind: .redeCaution
            case .unclean, .offline: .redeRisk
            }
        }
    }

    let localCount: Int
    /// nil = 不知道（连不上）。刻意不接受「用上次的数字兜底」。
    let remoteCount: Int?
    let status: Status
    let s: RedeStrings

    private var remoteTint: Color {
        guard let remoteCount else { return .redeT3 }
        return remoteCount > localCount ? status.tint : .redeT1
    }

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            side(label: s.syncSideLocal, value: "\(localCount)", tint: .redeT1, alignment: .leading)
            link
            side(
                label: s.syncSideCloud,
                value: remoteCount.map(String.init) ?? "—",
                tint: remoteTint,
                alignment: .trailing
            )
        }
        .padding(.top, 22)
        .padding(.bottom, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(s.syncSideLocal) \(localCount)，\(s.syncSideCloud) \(remoteCount.map(String.init) ?? "—")"
        )
    }

    private func side(label: String, value: String, tint: Color, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 6) {
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .tracking(1.6)
                .textCase(.uppercase)
                .foregroundStyle(Color.redeT4.opacity(0.9))
                .lineLimit(1)
            Text(value)
                .font(.system(size: 31, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(tint)
            Text(s.syncUnitSessions)
                .font(.system(size: 11))
                .foregroundStyle(Color.redeT4)
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }

    private var link: some View {
        ZStack {
            HStack(spacing: 0) {
                Rectangle().fill(Color.redeEtch).frame(width: 19, height: 1)
                Spacer(minLength: 0)
                Rectangle().fill(Color.redeEtch).frame(width: 19, height: 1)
            }
            Image(systemName: status.symbol)
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(status.tint)
                .accessibilityHidden(true)
        }
        .frame(width: 74, height: 46)
        .padding(.top, 14)
    }
}

// MARK: - 页面

struct SyncSheet: View {
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.dismiss) private var dismiss
    @Bindable var store: LocaleStore

    @Environment(SyncService.self) private var service
    @State private var showDeleteConfirm = false
    @State private var deleteConfirmText = ""
    @State private var currentNonce: String?

    private var s: RedeStrings { RedeStrings(locale: store.locale) }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if service.isSignedIn {
                        signedInBody(service)
                    } else {
                        signedOutBody
                    }
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.bottom, 24)
            }
        }
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
        .task {
            await service.refreshSignedInState()
        }
        .sheet(isPresented: $showDeleteConfirm) { deleteSheet }
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 4) {
                Overline(text: s.syncPanelOverline)
                Text(s.syncTitle)
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .foregroundStyle(Color.redeT1)
            }
            Spacer()
            Button(s.settingsDone) { dismiss() }
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.redeT2)
                .frame(minWidth: 44, minHeight: 44, alignment: .bottomTrailing)
                .buttonStyle(.redePressable)
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Color.redeHair2).frame(height: 1) }
    }

    // MARK: 未开启

    private var signedOutBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(systemName: "icloud.and.arrow.up")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(Color.redeT3)
                .padding(.top, 22)
                .padding(.bottom, 14)
                .accessibilityHidden(true)

            Text(s.syncIntroTitle)
                .font(.system(size: 21, weight: .semibold))
                .foregroundStyle(Color.redeT1)
                .padding(.bottom, 14)

            // 把抽象的风险变成具体的量：128 场、14 个月。
            HStack(alignment: .firstTextBaseline, spacing: 7) {
                Text("\(service.localSessionCount)")
                    .font(.system(size: 27, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT1)
                Text(s.syncAtRisk(count: service.localSessionCount))
                    .font(.system(size: 12.5))
                    .foregroundStyle(Color.redeT3)
            }
            .padding(.bottom, 4)

            appleButton
                .padding(.top, 34)

            errorLine
        }
    }

    private var appleButton: some View {
        SignInWithAppleButton(.signIn) { request in
            let raw = Self.randomNonce()
            currentNonce = raw
            request.requestedScopes = []          // 只要身份，不要姓名邮箱
            request.nonce = Self.sha256(raw)      // Apple 收哈希，Supabase 收原文
        } onCompletion: { result in
            handleAppleResult(result)
        }
        .signInWithAppleButtonStyle(.black)
        .frame(height: 47)
        .clipShape(RoundedRectangle(cornerRadius: RedeShape.buttonRadius, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: RedeShape.buttonRadius, style: .continuous)
                .stroke(Color.redeSteel.opacity(0.45), lineWidth: 1)  // 深底上保证可见
        }
    }

    // MARK: 已开启

    @ViewBuilder
    private func signedInBody(_ service: SyncService) -> some View {
        let report = service.lastReport
        let status: SyncGauge.Status = {
            if service.isSyncing { return .fetching }
            // 只有真的网络不可达才用「连不上」那套图标与文案；服务端拒绝
            // （4xx/5xx）走 .unclean，否则会让用户去查 WiFi 而问题在别处。
            if service.errorText != nil { return service.isOffline ? .offline : .unclean }
            if let report {
                if report.blockedByNewerSchema > 0 { return .behind }
                if report.rejectedUncleanCount > 0 { return .unclean }
            }
            return .matched
        }()

        VStack(alignment: .leading, spacing: 0) {
            SyncGauge(
                localCount: service.localSessionCount,
                // 直接用真值，**不拿本地数兜底**——兜底会让「还没同步过」和「连不上」
                // 都显示成两边相等，而这个组件存在的全部意义就是显示真实差异。
                remoteCount: service.remoteSessionCount,
                status: status,
                s: s
            )

            verdictLine(service, status: status)

            if let detail = statusDetail(service, status: status) {
                Text(detail)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
                    .lineSpacing(2)
                    .padding(.top, 6)
            }

            if status == .behind {
                actionRow(title: s.syncUpdateApp, systemImage: "arrow.up.circle", tint: .redeEmber2) {
                    if let url = URL(string: "https://apps.apple.com/app/id6748996381") {
                        UIApplication.shared.open(url)
                    }
                }
                .padding(.top, 8)
            }

            EngraveDivider()

            actionRow(title: s.syncAccount, systemImage: "person.circle", tint: .redeT2, trailing: s.syncAccountApple)
            Rectangle().fill(Color.redeHair2).frame(height: 1)
            actionRow(title: s.syncNow, systemImage: "arrow.trianglehead.clockwise", tint: .redeT2) {
                Task { await service.syncNow() }
            }
            .disabled(service.isSyncing)

            Text(s.syncAutoFootnote)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .padding(.top, 6)

            errorLine

            EngraveDivider().padding(.top, 28)

            actionRow(title: s.syncSignOut, systemImage: "rectangle.portrait.and.arrow.right", tint: .redeT2) {
                Task { await service.signOut() }
            }
            Rectangle().fill(Color.redeHair2).frame(height: 1)
            actionRow(title: s.syncDeleteAccount, systemImage: "trash", tint: .redeRisk) {
                deleteConfirmText = ""
                showDeleteConfirm = true
            }
            Text(s.syncSignOutFootnote)
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .padding(.top, 6)
        }
    }

    private func verdictLine(_ service: SyncService, status: SyncGauge.Status) -> some View {
        let (text, tint): (String, Color) = {
            switch status {
            case .fetching: return (s.syncVerdictFetching, .redeT3)
            case .offline:  return (s.syncReasonOffline, .redeRisk)
            case .behind:
                let n = service.lastReport?.blockedByNewerSchema ?? 0
                return ("\(s.syncShortBy(n))　\(s.syncReasonNewerVersion)", .redeCaution)
            case .unclean:
                // 同一图标下两种来源：远端脏记录（有 report）与服务端拒绝（有 errorText）。
                if service.errorText != nil, service.lastReport?.rejectedUncleanCount ?? 0 == 0 {
                    return (s.syncReasonRejected, .redeRisk)
                }
                let n = service.lastReport?.rejectedUncleanCount ?? 0
                return ("\(s.syncShortBy(n))　\(s.syncReasonUnclean)", .redeRisk)
            case .matched:
                guard let at = service.lastSyncedAt else { return (s.syncNeverSynced, .redeT3) }
                return ("\(s.syncVerdictMatched)　\(Self.timeText(at))", .redeRec2)
            }
        }()
        return Text(text)
            .font(.system(size: 11.5))
            .monospacedDigit()
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity, alignment: .center)
    }

    private func statusDetail(_ service: SyncService, status: SyncGauge.Status) -> String? {
        switch status {
        case .behind:   return s.syncBlockedDetail(service.lastReport?.blockedByNewerSchema ?? 0)
        case .unclean:
            return service.errorText != nil && service.lastReport?.rejectedUncleanCount ?? 0 == 0
                ? s.syncRejectedDetail : s.syncUncleanDetail
        case .offline:  return s.syncOfflineDetail
        case .fetching: return s.syncFirstFetchNote
        case .matched:  return nil
        }
    }

    // MARK: 行 / 错误

    private func actionRow(
        title: String,
        systemImage: String,
        tint: Color,
        trailing: String? = nil,
        action: (() -> Void)? = nil
    ) -> some View {
        Button(action: { action?() }) {
            HStack(spacing: 9) {
                Image(systemName: systemImage)
                    .font(.redeCaption)
                    .foregroundStyle(tint == .redeRisk ? Color.redeRisk : Color.redeT4)
                    .accessibilityHidden(true)
                Text(title)
                    .font(.redeBody)
                    .foregroundStyle(tint)
                Spacer()
                if let trailing {
                    Text(trailing)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.redeT3)
                }
            }
            .frame(minHeight: RedeShape.controlHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
        .allowsHitTesting(action != nil)
    }

    @ViewBuilder
    private var errorLine: some View {
        if let text = service.errorText {
            Text(text)
                .font(.redeCaption)
                .foregroundStyle(Color.redeRisk)
                .lineSpacing(2)
                .padding(.top, 10)
        }
    }

    // MARK: 删号

    private var deleteSheet: some View {
        let word = s.syncDeleteConfirmWord
        return VStack(alignment: .leading, spacing: 0) {
            Text(s.syncDeleteAccount)
                .font(.system(size: 15.5, weight: .semibold))
                .foregroundStyle(Color.redeT1)
                .padding(.bottom, 8)
            Text(s.syncDeleteBody(count: service.remoteSessionCount ?? service.localSessionCount, word: word))
                .font(.system(size: 12))
                .foregroundStyle(Color.redeT3)
                .lineSpacing(3)
                .padding(.bottom, 14)

            TextField(word, text: $deleteConfirmText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.system(size: 13.5))
                .foregroundStyle(Color.redeT1)
                .padding(.horizontal, 12)
                .frame(minHeight: 42)
                .background(
                    RoundedRectangle(cornerRadius: RedeShape.steelRadius, style: .continuous)
                        .fill(Color.redeSegBase)
                        .overlay {
                            RoundedRectangle(cornerRadius: RedeShape.steelRadius, style: .continuous)
                                .stroke(Color.redeHair, lineWidth: 1)
                        }
                )
                .padding(.bottom, 11)

            // 输对之前点不动——采纳 Hevy 的打字确认。
            Button {
                Task {
                    if await service.deleteCloudAccount() { showDeleteConfirm = false }
                }
            } label: {
                Text(s.syncDeleteAccount)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(deleteConfirmText == word ? Color.redeRisk : Color.redeT4)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(
                        RoundedRectangle(cornerRadius: RedeShape.buttonRadius, style: .continuous)
                            .stroke(deleteConfirmText == word ? Color.redeRisk : Color.redeHair, lineWidth: 1)
                    )
            }
            .buttonStyle(.redePressable)
            .disabled(deleteConfirmText != word)

            Button(s.syncCancel) { showDeleteConfirm = false }
                .font(.system(size: 13.5))
                .foregroundStyle(Color.redeT3)
                .frame(maxWidth: .infinity, minHeight: 42)
                .buttonStyle(.redePressable)
                .padding(.top, 4)
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, 19)
        .padding(.bottom, 22)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.redeBase)
        .presentationDetents([.height(280)])
        .preferredColorScheme(.dark)
    }

    // MARK: Sign in with Apple

    private func handleAppleResult(_ result: Result<ASAuthorization, Error>) {
        guard case .success(let auth) = result,
              let credential = auth.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8)
        else { return }
        let nonce = currentNonce
        Task { await service.signIn(identityToken: token, rawNonce: nonce) }
    }

    /// Apple 收 nonce 的 SHA256，Supabase 收原文并自行比对。传错会得到语焉不详的 400。
    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    static func timeText(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = Calendar.current.isDateInToday(date) ? "HH:mm" : "M/d HH:mm"
        return f.string(from: date)
    }
}
