import SwiftUI
import AuthenticationServices
import CryptoKit
import RedeL10n

// 引导内的「登录恢复」面板（2026-08-12）。
//
// 为什么需要它：云端同步的卖点是「换手机，训练记录跟着走」，而它唯一被兑现的时刻
// 就是新机首启。在这个面板出现之前，那条路是——先答完整套问卷 → 进 App →
// 自己摸到 设置 → 数据 → 云端同步 → 登录 → 记录才回来；而刚答完的那份配置
// 因为 updatedAt 更新，还会在整块 last-writer-wins 里覆盖掉云端那份
//（SyncMergeEngine 配置区）。白答一遍问卷，还丢配置。
//
// 放在引导里就绕开了这两件事：登录发生在本地配置被写出来之前，云端配置自然获胜。
//
// 三个终态都如实说：取回了多少场 / 这个账号下没有记录 / 失败了。
// 绝不在没取回任何东西时假装成功——那会让用户以为历史丢了。
struct OnboardingRestoreSheet: View {
    /// 取回成功且确实有内容时调用：由引导层收尾（关引导、落到今日）。
    let onRestored: () -> Void

    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(SyncService.self) private var syncService
    @Environment(\.dismiss) private var dismiss

    private enum Phase: Equatable {
        case idle
        case working
        case done(sessions: Int)
        case empty
        case failed
    }

    @State private var phase: Phase = .idle
    @State private var currentNonce: String?

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Overline(text: s.syncPanelOverline)
                .padding(.top, 22)
            Text(s.onbRestoreTitle)
                .font(.redeHeadline)
                .tracking(RedeTracking.headline)
                .foregroundStyle(Color.redeT1)
                .padding(.top, 6)
            Text(s.onbRestoreBody)
                .font(.redeCallout)
                .foregroundStyle(Color.redeT3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)

            Spacer(minLength: 18)
            content
            Spacer(minLength: 0)
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.bottom, 22)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .idle, .failed:
            VStack(alignment: .leading, spacing: 12) {
                if phase == .failed {
                    Text(s.onbRestoreFailed)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeRisk)
                        .fixedSize(horizontal: false, vertical: true)
                }
                appleButton
                Button(s.onbRestoreCancel) { dismiss() }
                    .font(.redeCallout)
                    .foregroundStyle(Color.redeT3)
                    .frame(minHeight: RedeShape.controlHeight)
                    .buttonStyle(.redePressable)
            }

        case .working:
            HStack(spacing: 10) {
                ProgressView().controlSize(.small).tint(Color.redeT3)
                Text(s.onbRestoreWorking)
                    .font(.redeCallout)
                    .foregroundStyle(Color.redeT3)
            }
            .frame(minHeight: RedeShape.controlHeight)

        case .done(let sessions):
            VStack(alignment: .leading, spacing: 12) {
                Text(s.onbRestoreDone(sessions: sessions))
                    .font(.redeSubhead)
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT1)
                EmbButton(icon: "arrow.right", title: s.onbRestoreDoneAction) {
                    dismiss()
                    onRestored()
                }
            }

        case .empty:
            // 登录成功但云端没有这个账号的记录。不假装取回了什么，也不把用户堵在这里——
            // 直接给「继续设置」，回引导答问题。
            VStack(alignment: .leading, spacing: 12) {
                Text(s.onbRestoreEmpty)
                    .font(.redeCallout)
                    .foregroundStyle(Color.redeT2)
                    .fixedSize(horizontal: false, vertical: true)
                EmbButton(icon: "arrow.right", title: s.onbRestoreEmptyAction) { dismiss() }
            }
        }
    }

    private var appleButton: some View {
        SignInWithAppleButton(.signIn) { request in
            let raw = SyncSheet.randomNonce()
            currentNonce = raw
            request.requestedScopes = []              // 只要身份，不要姓名邮箱
            request.nonce = SyncSheet.sha256(raw)     // Apple 收哈希，Supabase 收原文
        } onCompletion: { result in
            handleAppleResult(result)
        }
        .signInWithAppleButtonStyle(.black)
        .frame(height: 47)
        .clipShape(RoundedRectangle(cornerRadius: RedeShape.buttonRadius, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: RedeShape.buttonRadius, style: .continuous)
                .stroke(Color.redeSteel.opacity(0.45), lineWidth: 1)   // 深底上保证可见
        }
    }

    private func handleAppleResult(_ result: Result<ASAuthorization, Error>) {
        guard case .success(let auth) = result,
              let credential = auth.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8)
        else { return }   // 用户取消：停在 idle，不报错
        let nonce = currentNonce
        phase = .working
        Task { await restore(token: token, nonce: nonce) }
    }

    private func restore(token: String, nonce: String?) async {
        await syncService.signIn(identityToken: token, rawNonce: nonce)
        guard syncService.isSignedIn else { phase = .failed; return }

        await syncService.syncNow(force: true)
        if syncService.errorText != nil { phase = .failed; return }

        // 判定「有没有取回东西」只看落盘后的真实结果，不看同步报告——
        // 报告可能因为本地空而算作成功但零变化。
        await sessionStore.loadToday()
        let sessions = sessionStore.completedSessionCount
        let stillNeedsOnboarding = await Task.detached { SessionStore.needsOnboarding() }.value
        phase = (sessions > 0 || !stillNeedsOnboarding) ? .done(sessions: sessions) : .empty
    }
}
