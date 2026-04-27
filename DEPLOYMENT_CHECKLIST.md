# IronPath Deployment Checklist

## 本地检查

- [ ] typecheck 通过
- [ ] test 通过
- [ ] build 通过
- [ ] build:size-check 通过
- [ ] PWA manifest 存在
- [ ] icons 存在
- [ ] vercel.json 存在
- [ ] .gitignore 正确

## GitHub 检查

- [ ] 未提交 node_modules
- [ ] 未提交 dist
- [ ] 未提交 .env
- [ ] 未提交 .vercel
- [ ] README 已更新
- [ ] package-lock.json 与 package.json 匹配

## Vercel 检查

- [ ] Framework Preset = Vite
- [ ] Build Command = npm run build
- [ ] Output Directory = dist
- [ ] 首次部署成功
- [ ] Preview URL 可访问

## iPhone 检查

- [ ] Safari 可打开
- [ ] Add to Home Screen 正常
- [ ] 主屏幕图标正常
- [ ] Focus Mode 可记录
- [ ] rest timer 正常
- [ ] 刷新后 activeSession 可恢复
- [ ] 导出/导入备份正常
