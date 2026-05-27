---
name: to-issues
description: 把审计 / 诊断结论拆成一批独立可执行的实施任务。读完后调用 `/to-issues`。
---

# Skill: to-issues

## 何时使用
- `/diagnose` / `/zoom-out` / `/grill-with-docs` / `/multi-agent-audit` 给出了一堆发现。
- 需要把它们拆成可单独 PR、可单独验收的任务。
- 任务之间有依赖关系，需要排序。

## 主入口
`.claude/commands/to-issues.md` 是权威定义。
直接使用：在 Claude Code 里输入 `/to-issues`。

## 关键产出
- blockers / fixes / follow-ups / non-goals 四类清单
- 每个任务含 scope / files / acceptance / tests / validation / data safety / merge & deploy / dependencies
- 任务依赖图

## 硬约束
- **不实现任何代码**。
- 不允许把不相关的修复打包。
- 缺 acceptance criteria 一律打回。
- 必须填 data safety boundaries 字段。

## 推荐衔接
通常在审计完成之后，`/tdd` 之前。
