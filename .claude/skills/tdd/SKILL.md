---
name: tdd
description: 测试驱动的实施流程：失败测试先行 → 最小修复 → 完整验证 → 回归测试。读完后调用 `/tdd`。
---

# Skill: tdd

## 何时使用
- 已经诊断清楚根因，准备开始动代码。
- 需要确保改动有真测试覆盖、不会回归。
- 涉及训练 / 推荐 / 未来云同步 / 存储 / AppData / iOS UI：尤其要走 TDD。

## 主入口
`.claude/commands/tdd.md` 是权威定义。
直接使用：在 Claude Code 里输入 `/tdd`。

## 关键产出
- failing test（确认因正确理由失败）
- smallest fix
- focused tests + full validation
- regression test for the original bug
- data safety statement

## 硬约束
- 没有失败测试不允许改代码。
- 不允许弱化断言让红变绿。
- 不允许删除现有失败覆盖（除非用户明确批准）。
- 不允许跳过完整验证流程。

## 推荐衔接
`/diagnose` → `/grill-with-docs` → `/tdd` → `/handoff`。
