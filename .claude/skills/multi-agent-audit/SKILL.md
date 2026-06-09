---
name: multi-agent-audit
description: 多 Agent 独立审计：Root Cause / Architecture / UI / Data Safety / Recommendation / Regression / Implementation。读完后调用 `/multi-agent-audit`。
---

# Skill: multi-agent-audit

## Clean rewrite guard
- Audit for conflicts between living docs, clean rewrite target, and legacy/reference inventory.
- Treat legacy `ios/` code as evidence, not product truth.
- Flag any attempt to restore PWA/Web runtime or use website validation as repo runtime.

## 何时使用（命中以下任一项 → 强制使用）
- 训练 / 推荐 / 未来云同步 / 存储 / AppData / Settings / Focus Mode / iOS UI。
- 单文件补丁可能不够，需要多视角并行审计。
- `/global-scan` 发现 source-of-truth 冲突时必须升级到本命令。

## 主入口
`.claude/commands/multi-agent-audit.md` 是权威定义。
直接使用：在 Claude Code 里输入 `/multi-agent-audit`。

## Agent 列表（独立 pass）
1. Root Cause Agent
2. Architecture Impact Agent
3. UI Integration Agent
4. Data Safety Agent
5. Recommendation/Domain Agent（训练/推荐任务必上）
6. Regression Agent
7. Implementation Agent（**必须最后**）

支持并行 subagent 时优先并行调起前 6 个 Agent；不支持时模拟独立 pass。

## 每个 Agent 必输
- exact searches performed
- files inspected
- impacted modules
- non-impacted modules verified
- risks
- proposed fix
- test matrix
- post-implementation re-review

## IronPath 推荐系统特别规则
- 不允许打补丁式只改一个组件。
- 必须先用 `/global-scan` 做 inventory。
- 多个 recommendation source 给出冲突结论时 → **先合并为单一 source-of-truth，再动 UI**。

## 硬约束
- Implementation Agent 必须最后跑；前 6 个 Agent 任一缺席禁止实施。
- Blocking risk（数据丢失 / 跨账户污染 / schema 不兼容）必须先解决。
- 不允许跳过 non-impacted modules verified。

## 推荐衔接
`/global-scan` → `/multi-agent-audit` → `/to-issues` → `/tdd` → `/handoff`。
