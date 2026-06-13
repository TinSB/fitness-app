---
name: "source-command-to-issues"
description: "把审计结论拆成一批独立可执行的实施任务。"
---

# source-command-to-issues

Use this skill when the user asks to run the migrated source command `to-issues`.

## Command Template

# /to-issues — 把审计结论转成 issues / tasks

目的：把诊断 / 拉远 / 多 Agent 审计的发现，拆成**互相独立、可单独 PR、可单独验收**的任务列表。**本命令只产出任务清单，不实现。**

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

## 必须执行的步骤

1. **接收输入**
   - 来源通常是 `/diagnose` / `/zoom-out` / `/grill-with-docs` / `/multi-agent-audit` 的输出。
   - 如果输入不完整或没有审计结论，先停下并要求用户补充。

2. **分类发现**
   分四类：
   - **blockers**（必须先解决，否则其它都不安全）
   - **fixes**（核心修复）
   - **follow-ups**（可以延后但要登记）
   - **non-goals**（明确不在本批次范围内的；写出原因避免反复讨论）

3. **每个任务必须独立**
   - 不要把不相关的修复打包在一个任务里。
   - 不要把“顺手清理”塞进 bug fix 任务。
   - 如果两个任务之间有顺序依赖，明确写出 “depends on #X”。

4. **每个任务模板**
   ```
   ### Task <序号>: <标题>
   - scope: 这次到底要做什么 / 不做什么
   - files likely affected: 路径列表（含 producer / consumer / storage / UI / test）
   - acceptance criteria: 一句话写清“做完了什么样”
   - tests: 要新增或修改的测试（unit / package / Xcode build / simulator or device smoke）
   - validation: 要跑的命令（swift test / Xcode build / residual scan / git diff --check）
   - data safety boundaries: 是否触碰 AppData / local JSON store / future cloud / training history；是否需要明确用户批准
   - merge/deploy requirements: 是否需要 TestFlight/App Store 发布、是否需要真机 iPhone 冒烟、是否需要多 Agent 复审
   - depends on: #X（如有）
   ```

5. **冲突与重复检查**
   - 如果两个任务都会改同一文件且都改同一段，标记冲突并建议合并或排序。
   - 如果某个 follow-up 实际上是 blocker，升级它。

## 硬约束

- **本命令不实现任何代码**。
- 不允许把多个不相关 bug 塞进一个任务。
- 不允许漏掉 data safety boundaries 字段（Rede 的高危项）。
- 不允许把 schema 变更和 UI tweak 放在同一个任务。
- 没有 acceptance criteria 的任务一律打回。

## 输出结构

```
Blockers
- Task 1: …
- Task 2: …

Fixes
- Task 3: …
- Task 4: …

Follow-ups
- Task 5: …

Non-goals (本次明确不做)
- …

依赖图：
- Task 3 depends on Task 1
- …
```
