import SwiftUI
import UIKit
import UserNotifications

@main
struct RedeApp: App {
    // FR-NT1/2：注册 AppDelegate 以设置通知 delegate（前台呈现 + 启动即接管）。
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            RootTabView()
        }
    }
}

/// 通知 delegate：默认 iOS 在 App **前台**时静默丢弃本地通知 banner——必须实现 `willPresent`
/// 显式返回 banner/sound，休息结束/每周提醒在前台才会真正弹出（owner 真机反馈"没收到通知"根因）。
/// 启动即设 delegate（早于任何调度），保证全程生效。
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        // 当前两类通知（rest-end / weekly）都该前台呈现。若将来新增不需前台弹窗的类型（如静默刷新），
        // 在此按 notification.request.identifier 前缀分流，别无差别返回 banner。
        [.banner, .list, .sound]
    }
}
