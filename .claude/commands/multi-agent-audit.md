---
description: 严格的多 Agent 独立审计流程，覆盖根因 / 架构 / UI / 数据安全 / 推荐 / 回归 / 实施。
---

# /multi-agent-audit — 多 Agent 独立审计

目的：对高风险改动（训练 / 推荐 / 未来云同步 / 存储 / AppData / Settings / Focus Mode / iOS UI）执行**多 Agent 独立审计**：每个 Agent 独立做一次 pass，互不偷看，全部报告完成后才允许进入实施。

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

## Agent 列表与职责（独立 pass，互不偷看）

每个 Agent 独立运行一次审计，先各自出报告，不允许在出报告前互相对齐结论。

1. **Root Cause Agent**
   - 任务：还原 bug 的真实成因，区分根因 vs 症状。
   - 输出：根因陈述、复现路径、最小触发条件。

2. **Architecture Impact Agent**
   - 任务：评估改动对模块边界 / 数据流 / source-of-truth 的影响。
   - 输出：受影响模块清单、before/after 数据流、是否破坏现有契约。

3. **UI Integration Agent**
   - 任务：枚举所有受影响的 UI surface（含中英文文案）。
   - 输出：哪些 surface 会变、哪些不应该变但有风险、是否需要 a11y / iPhone 模拟器或真机冒烟。

4. **Data Safety Agent**
   - 任务：检查 local JSON store / AppData / App Group snapshot / future cloud / 训练历史 / TrainingSession schema 是否被触碰。
   - 输出：是否有删除 / 覆盖 / 跨账户污染风险；是否需要明确用户批准。

5. **Recommendation/Domain Agent**（任务涉及训练 / 推荐时必上）
   - 任务：检查 recommendation 多 source 是否会给出冲突结论；evaluate 训练周期 / fineTune / conservative prescription 等领域逻辑。
   - 输出：是否存在多个 recommendation source；是否需要先合并为单一 source-of-truth 再改 UI。

6. **Regression Agent**
   - 任务：识别历史上踩过的坑（参考最近 PR、CHANGELOG、docs/、Swift tests），评估本次会不会撞回去。
   - 输出：历史回归点清单、本次需要的 regression test 矩阵。

7. **Implementation Agent**（必须最后才上）
   - 任务：在以上 6 个 Agent 都出过报告后，给出实施计划与测试矩阵。
   - 输出：拆分到任务级别的实施步骤、test plan、validation 命令、回归 test 矩阵、部署计划。

## 执行方式

- 如果当前 Claude 会话支持并行 subagent，**优先并行调起前 6 个 Agent**，等全部报告完成再调 Implementation Agent。
- 如果不支持并行，**模拟独立 pass**：依次做每个 Agent 的工作，但每段输出之间不允许提前对齐结论；Implementation Agent 仍然必须最后。

## 每个 Agent 报告必须包含

- **exact searches performed**：用了什么 `rg` / `git grep` / 关键词、文案（中英）、schema 名。
- **files inspected**：读过的文件路径。
- **impacted modules**：受影响模块清单。
- **non-impacted modules verified**：检查过但确认无关的模块（证明你看过）。
- **risks**：数据 / UI / 架构 / 部署风险。
- **proposed fix**：该 Agent 视角下的修复建议。
- **test matrix**：建议的测试组合（unit / package / Xcode build / simulator or device smoke / regression）。
- **post-implementation re-review**：实施完后需要重做哪些验证。

## IronPath 推荐系统特别规则

对训练 / 推荐相关任务，**强制**：

1. 不允许打补丁式只改一个组件。
2. 先用 `/global-scan` 把所有 recommendation-related 组件做成 inventory。
3. 如果多个组件给出**冲突的建议**，**先合并为单一 source-of-truth**，再动 UI。
4. Recommendation/Domain Agent 必须在报告里显式回答：
   - 当前有几个 recommendation source？
   - 它们是否一致？
   - 是否需要 consolidation 工作做在本次之前？

## 硬约束

- Implementation Agent 必须最后跑——前 6 个 Agent 任一缺席，**禁止实施**。
- 任一 Agent 提出 blocking risk（数据丢失、跨账户污染、schema 不兼容）→ 必须先解决，不允许靠后续 PR 补救。
- 报告中只写“可能没问题”一律打回。
- 不允许跳过 non-impacted modules verified（这是 IronPath 多次踩过坑的位置）。

## 输出结构

```
== Root Cause Agent ==
…

== Architecture Impact Agent ==
…

== UI Integration Agent ==
…

== Data Safety Agent ==
…

== Recommendation/Domain Agent ==（如适用）
…

== Regression Agent ==
…

(以上全部完成后)

== Implementation Agent ==
- 实施步骤：…
- 测试矩阵：…
- Validation 命令：…
- 部署计划：…
- post-implementation re-review：…
```

完成实施后，建议接 `/tdd` 推进具体编码，再用 `/handoff` 产出交接报告。
