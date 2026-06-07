---
description: 用 docs / 测试 / 架构 / 安全契约去拷问一个提议的修复方案。
---

# /grill-with-docs — 用文档与契约拷问方案

目的：在动手实现之前，把提议的修复方案放在**真实的 docs、tests、架构、安全契约**面前严格审问，找出矛盾、漏洞、和系统性问题被当成局部 bug 来处理的迹象。

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
- 代码改动后的标准验证流程：
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

1. **采集证据材料**
   - 读 `docs/` 下相关设计文档（特别是与此功能相关的最近 PR doc）。
   - 读相关 tests（unit / integration / smoke / regression）。
   - 读相关 architecture / contract 文件（schema、type、storage adapter、sync 协议、recommendation 接口）。
   - 必要时读最近相关 PR 的 commit message，了解决策历史。

2. **逐条拷问提议**
   对方案的每一条主张，验证：
   - 是否与 docs 一致？
   - 是否被现有测试覆盖？是否会让现有测试失败？
   - 是否破坏 storage / sync / schema 契约？
   - 是否假设了一些**实际上不成立**的前提（例如假设“UI 是唯一 consumer”但其实有后台 sync 也消费）？

3. **找出三类高危信号**
   - **矛盾**：方案 ↔ 文档/契约/测试 之间的不一致。
   - **缺失测试**：修复后没有任何测试能在回归时报警。
   - **不安全假设**：例如“缓存总是新的”、“只有一处写入 AppData”、“云端永远是真值”——逐一打破假设并验证。

4. **判断是否“局部补丁假装系统修复”**
   - 如果同一 bug 的成因横跨多个模块（producer 多处、consumer 多处、source-of-truth 不唯一），单文件补丁是错误答案。
   - 触发条件：训练 / 推荐 / 未来云同步 / 存储 / AppData / Settings / Focus Mode / iOS UI。
   - 命中则要求升级到 `/zoom-out` 或 `/multi-agent-audit`，并在 verdict 中明确写出来。

5. **输出 verdict（必须三选一）**
   - `approve`：方案与文档/测试/架构/安全契约一致，可以进入实现。
   - `revise`：方案方向正确，但需要补测试 / 修边界 / 收紧契约；列出**具体要改什么**。
   - `reject`：方案错误或会造成回归；说明**为什么** + **建议的替代路径**。

## 硬约束

- **除非用户明确说“开始实现”，不允许编辑代码**。本命令只做评审。
- 不允许在没有读过 docs/tests 的前提下给 verdict。
- 不允许把“看起来合理”当成 approve 的理由——必须引用具体文件 / 测试 / 契约。
- 如果发现 docs 与代码本身就矛盾，单独列出，不要悄悄选边。

## 输出结构

```
Verdict: approve | revise | reject

证据：
- 读过的 docs：…
- 读过的 tests：…
- 读过的 contracts/architecture：…

发现：
- 矛盾：…
- 缺失测试：…
- 不安全假设：…
- 是否系统性问题：是 / 否（理由 + 是否升级到 /zoom-out 或 /multi-agent-audit）

下一步：
- 如果 approve：进入 /tdd
- 如果 revise：具体修改清单
- 如果 reject：替代路径
```
