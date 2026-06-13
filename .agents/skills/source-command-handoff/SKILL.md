---
name: "source-command-handoff"
description: "产出可交付的任务收尾报告，让下一位接手者 / 下一个会话能零起点继续。"
---

# source-command-handoff

Use this skill when the user asks to run the migrated source command `handoff`.

## Command Template

# /handoff — 任务交接报告

目的：把刚完成的任务整理成一份**清晰、可交接、可审计**的总结。下游（用户本人 / 下一个 Codex 会话 / PR reviewer）应该不用再回头追问就能继续工作。

## 共享 Rede 规则（每个命令都遵守）

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
  xcodebuild -project ios/Rede.xcodeproj -scheme Rede -destination 'generic/platform=iOS Simulator' build
  git diff --check
  ```
- 合并后若影响发布行为：走 TestFlight/App Store 发布清单；禁止从此仓触发 Vercel 发布。
- 涉及 iOS UI/运行时：必要时做 iPhone 模拟器或真机冒烟。
- 训练逻辑、推荐逻辑、未来云同步、存储、AppData、Settings、Focus Mode、iOS UI 改动 → 必须做全仓搜索；高风险时再做多 Agent 复审。
- 不要用单文件窄补丁解决复杂 bug。

## 必输字段（缺一不可）

1. **root cause** — 一句话写清根因（不是症状）。
2. **changed files** — 实际改动的文件清单（路径 + 一句说明）。
3. **tests added/updated** — 新增 / 修改的测试（文件 + 名称 + 它在防御什么 bug）。
4. **validation commands and results** — 实际跑过的命令和结果：
   - Swift package tests under `ios/packages/*`
   - `xcodebuild -project ios/Rede.xcodeproj -scheme Rede -destination 'generic/platform=iOS Simulator' build`
   - retired Web/PWA runtime residual scan
   - `git status --short`
   - `git diff --check`
5. **iOS smoke**（若相关）— iPhone 模拟器或真机上跑过的验证；不相关时显式写 “N/A — 改动不触及 UI/runtime”。
6. **retired Web runtime statement** — 是否重新引入 PWA/Node/Vite/TS/browser/cloud-runtime 残留；应明确没有重新引入。
7. **data safety statement** — 是否触碰 AppData / local JSON store / future cloud / 训练历史 / TrainingSession schema；是否有覆盖 / 删除 / 跨账户污染风险；如果都没有，明确写 “未触及任何持久化数据”。
8. **iOS build statement** — Swift package tests / Xcode build 是否通过；如果未跑，写明原因。
9. **PR number** — PR 编号 + 链接（如已开）。
10. **merge status** — 未合 / 已合 / 等审。
11. **deployment status** — 是否需要 TestFlight/App Store 发布；如未发布，写明原因。
12. **known limitations** — 已知没解决的 / 故意延后的 / 需要后续观察的。
13. **next recommended task** — 下一步建议（可以是 `/to-issues` 拆出的具体任务，或更上层动作）。
14. **exact commands run** — 关键命令原文，方便 reviewer 复现。

## 硬约束

- 任意必输字段缺失：**视为未完成**，不允许 handoff。
- 不允许把“看起来应该没问题”当成 validation 结果——必须有实际跑过的命令输出。
- data safety statement 不允许写“可能没问题”这种模糊措辞。
- 如果 PR 未开，必须说明原因（例如：仅本地 spike、未 push、用户未授权 push）。

## 输出结构

```
# Handoff: <任务名>

Root cause: …

Changed files:
- ios/...
- ios/packages/...

Tests added/updated:
- …

Validation:
- swift package tests: …
- Xcode build: …
- retired Web runtime scan: …
- git status reviewed: …
- git diff --check: …

iOS smoke: …（或 N/A 并说明原因）

Data safety: …
Retired Web runtime: …

PR: #… <URL>
Merge: …
Deploy: …

Known limitations:
- …

Next recommended task:
- …

Exact commands run:
- …
```
