---
description: 在改代码前先画出更大的系统图，防止隧道视野。
---

# /zoom-out — 拉远视角，先画系统图

目的：阻止只盯着一个文件改 bug。先把整条数据流和所有 surface 画清楚，再判断这到底是局部 bug 还是架构问题。

## 共享 IronPath 规则（每个命令都遵守）

- 仓库路径：`~/Developer/ironpath`
- 默认从最新 `main` 开始，除非用户明确指示其他分支。
- 如果 worktree 有未提交改动，**先停止并报告**，不要把本次任务和无关清理混在一起（除非任务本身就是清理）。
- 假设环境：MacBook / macOS。
- 不要使用 `--admin`，不要绕过分支保护。
- 不允许重新引入 `package.json`、Node/npm/Vite 配置或任何 Web lockfile；如果扫描到，先停下说明原因。
- `package-lock.json`、`yarn.lock`、`pnpm-lock.yaml` 必须保持不存在。
- 永远不要泄露 token、env 值、service-role key、API key、cookie、原始 AppData 或任何用户隐私数据。
- 永远不要删除本机 JSON/AppData、训练历史、HealthKit 派生数据或未来云端数据，除非用户明确批准。
- 永远不要静默覆盖本机 canonical AppData 或未来云端数据。
- 不要在没有明确批准的情况下修改 AppData 或 TrainingSession schema。
- Clean rewrite 阶段：living docs 是目标真源；旧 `ios/` 实现是 legacy/reference inventory。旧实现任务默认只读审计，除非有明确 rewrite slice 批准复用。
- 外部官网 / 付费意向验证在仓库 runtime 之外；不得恢复 PWA/Web runtime。
- 验证流程按变更类型选择：
  ```bash
  git diff --check
  ```
  runtime slice 代码改动后再跑：
  ```bash
  for package in ios/packages/*; do
    if [ -f "$package/Package.swift" ]; then
      (cd "$package" && swift test) || exit 1
    fi
  done
  xcodebuild -project ios/IronPath.xcodeproj -scheme IronPath -destination 'generic/platform=iOS Simulator' build
  git diff --check
  ```
- 合并后若影响发布行为：走 TestFlight/App Store 发布清单；禁止从此仓触发 Vercel 发布。
- 涉及 iOS UI/运行时：必要时做 iPhone 模拟器或真机冒烟。
- 训练逻辑、推荐逻辑、未来云同步、存储、AppData、Settings、Focus Mode、iOS UI 改动 → 必须做全仓搜索；高风险时再做多 Agent 复审。
- 不要用单文件窄补丁解决复杂 bug。

## 必须执行的步骤

1. **列出周边模块**
   - 找出与目标功能相关的：modules、consumers、producers、adapters、presenters、tests、docs。
   - 不要只搜函数名——同时用中英文 UI 文案、行为关键词、相关 schema 字段名。

2. **画 before/after 数据流**
   - **Before**：当前数据是怎么从 source 流到 UI 的？经过哪些写入点 / 缓存 / sync？
   - **After**：你提议的修改后，这条流会怎么走？谁是新的 source-of-truth？谁会跟着变？

3. **分类问题性质**
   判断这是哪一种 bug（可多选并标注）：
   - `local bug` — 单文件、单 surface 的小问题
   - `architecture bug` — 多模块协作错误
   - `stale UI` — 数据正确但 UI 没刷新
   - `state management bug` — 多份 state 不一致
   - `storage bug` — local JSON store / AppData / App Group snapshot 写入或读取错位
   - `cloud sync bug` — 云端 ↔ 本地一致性出错
   - `retired web residue` — PWA/Service Worker/Node/Vite/TS/browser 残留被误当当前实现
   - `recommendation inconsistency` — 多个 recommendation source 给出冲突结论

4. **输出系统影响图（System Impact Map）**
   建议用一个简表 + 一段 ASCII 数据流：
   ```
   Producer → Storage → Adapter → Presenter → UI Surface(s) → Test(s)
   ```
   并标出：
   - 哪些 surface 会跟着改动一起变？
   - 哪些 surface 不应该变但有风险变？
   - 哪些测试覆盖了这条流，哪些缺失？

5. **如果命中以下任意一项，必须升级**
   - 推荐 / 训练 / 未来云同步 / 存储 / AppData / Settings / Focus Mode / iOS UI。
   - → 直接切换到 `/multi-agent-audit`，不要在 `/zoom-out` 里继续改。

## 硬约束

- **画图阶段不允许编辑代码**。
- 不允许只列“相关文件”就结束——必须明确每个文件的角色（producer / consumer / storage / surface / test）。
- 不允许跳过 before/after 数据流。
- 如果两条 surface 显示同一数据但来源不同，必须明确指出 source-of-truth 冲突。

## 输出结构

```
System Impact Map
- Producers: …
- Storage owners: …
- Adapters/Presenters: …
- UI Surfaces (含中英文文案): …
- Tests: …

Dataflow (Before):
…

Dataflow (After):
…

Bug class: local / architecture / stale-UI / state / storage / cloud-sync / pwa-cache / recommendation-inconsistency

Risk surfaces (会跟着变 + 不应该变但风险高):
…

下一步：/diagnose / /grill-with-docs / /to-issues / /multi-agent-audit / /tdd
```
