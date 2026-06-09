---
description: 在动手改代码之前找到真正的根因（不是症状）。
---

# /diagnose — 根因诊断

目的：在写任何代码之前，先确认 bug 的**真正根因**，分清根因与症状，并把影响面圈出来。

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

1. **复现或模拟 bug**
   - 写出复现路径（点击/数据/状态序列）。
   - 如果不能直接复现，描述要在哪些条件下会出现，并给出可观测的副作用（日志、UI、网络、存储）。

2. **定位失败的状态转移**
   - 找到“在哪一步、谁、把什么状态从 X 改成了 Y”，而不仅仅是哪一行报错。
   - 区分**产生者**（producer）、**消费者**（consumer）、**存储归属**（storage owner）、**UI 表面**（surface）。

3. **全仓搜索（不能只看报错那个文件）**
   - 使用 `rg` / `git grep` 用**语义化关键词 + 函数名 + 中英文 UI 文案**做广义搜索。
   - 至少列出：所有 producers、所有 consumers、所有 storage owners（AppData / local JSON store / HealthKit adapter / App Group widget snapshot / future cloud）、所有 UI surfaces、所有相关测试。

4. **区分根因和症状**
   - 根因：上游决策 / 数据流 / schema / state 真正出错的位置。
   - 症状：UI 闪一下、值不一致、显示空白等表层现象。
   - 如果一个改动会让症状消失但根因仍在，标记为 ❌ 不可接受。

5. **输出诊断报告（必须包含）**
   - `root cause`：一句话写清根因。
   - `impacted files`：受影响文件清单（路径 + 角色：producer / consumer / storage / UI / test）。
   - `non-impacted files checked`：检查过但确认无关的文件（证明你看过）。
   - `data safety risks`：是否触碰 AppData / local JSON store / future cloud / 训练历史 / TrainingSession schema；是否有覆盖、丢失、跨账户污染风险。
   - `UI risks`：是否触发其他 surface 的回归（Settings / Focus Mode / Today / Recommendation / Sync 等）。
   - `test plan`：建议的失败优先测试（unit / package / Xcode build / simulator or device smoke）。

## 硬约束

- **不允许在诊断完成前编辑代码**。
- 如果根因不确定，**停止**并直接说“不确定”，列出还需要哪些信息或哪些进一步搜索。
- 不允许用“先改试试看”的方式代替诊断。
- 如果发现是系统性问题（多组件冲突），**升级到 `/zoom-out` 或 `/multi-agent-audit`**，不要继续单点诊断。

## 完成标志

用户拿到诊断报告后，下一步通常是 `/grill-with-docs` 验证方案，或 `/to-issues` 拆分任务，或 `/tdd` 进入实现。
