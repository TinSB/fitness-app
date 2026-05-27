---
name: diagnose
description: 在动手改代码前找到真正的根因（不是症状）。读完后调用 `/diagnose` 启动完整流程。
---

# Skill: diagnose

## 何时使用
- 出现 bug 但还没动手改。
- 怀疑“看起来的问题点”只是症状不是根因。
- 报错信息指向某个文件，但你怀疑真正的源头在别处。

## 主入口
`.claude/commands/diagnose.md` 是权威定义，本文件只是导航。
直接使用：在 Claude Code 里输入 `/diagnose`。

## 关键产出
- root cause（一句话）
- impacted files（按角色分：producer / consumer / storage / UI / test）
- non-impacted files checked（证明你看过）
- data safety risks
- UI risks
- test plan

## 硬约束
- 诊断完成前不允许改代码。
- 根因不确定就停下并说明。
- 系统性问题升级到 `/zoom-out` 或 `/multi-agent-audit`。

## 推荐衔接
`/diagnose` → `/grill-with-docs` → `/to-issues` → `/tdd` → `/handoff`
