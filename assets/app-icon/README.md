# App 图标资产源

- `make_icon.swift` — 图标唯一生成源（方向 A · 刻度轨，owner 拍板 2026-06-10）。
- 重新生成：仓库根目录运行 `swift assets/app-icon/make_icon.swift`，
  输出直接覆盖 `ios/Rede/Assets.xcassets/AppIcon.appiconset/AppIcon1024.png`。
- 改图标 = 改脚本再生成，不手改 PNG。
