---
name: grill-with-docs
description: 用 docs / tests / 架构 / 安全契约严格拷问一个提议的修复方案。读完后调用 `/grill-with-docs`。
---

# Skill: grill-with-docs

## Clean rewrite guard
- Grill against the living docs as target truth, not against polluted legacy runtime behavior.
- If a plan depends on old `ios/` code, require an explicit rewrite slice and reuse review.
- Website paid-intent validation must stay separate from repo runtime.

## 何时使用
- 已经有一个修复方案，但还没实施。
- 怀疑“看起来合理”的方案其实违反了某条契约 / 测试 / 架构原则。
- 不确定方案是局部补丁还是系统级修复。

## 主入口
`.claude/commands/grill-with-docs.md` 是权威定义。
直接使用：在 Claude Code 里输入 `/grill-with-docs`。

## 关键产出
- Verdict: `approve` / `revise` / `reject`
- 引用：读过的 docs / tests / contracts
- 矛盾 / 缺失测试 / 不安全假设
- 是否系统性问题（命中则升级到 `/zoom-out` 或 `/multi-agent-audit`）

## 硬约束
- 只做评审，**不实现代码**（除非用户明确说开始实现）。
- 没读过 docs / tests 不允许给 verdict。
- “看起来合理”不是 approve 理由。

## 推荐衔接
通常在 `/diagnose` 之后、`/tdd` 之前。
