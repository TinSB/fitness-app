---
name: zoom-out
description: 在改代码前先画出更大的系统图，防止隧道视野。读完后调用 `/zoom-out`。
---

# Skill: zoom-out

## 何时使用
- 怀疑只盯着一个文件改 bug 会漏掉副作用。
- 不确定问题是 local bug 还是 architecture / state / storage / sync / PWA 层面的问题。
- 多个 surface 显示同一数据但行为不一致。

## 主入口
`.claude/commands/zoom-out.md` 是权威定义。
直接使用：在 Claude Code 里输入 `/zoom-out`。

## 关键产出
- System Impact Map（modules / surfaces / tests）
- Before/After dataflow
- bug class 分类
- risk surfaces（会跟着变 + 不应该变但风险高）

## 硬约束
- 不允许在画图阶段改代码。
- 必须明确每个文件的角色，不只是“相关文件”。
- 命中训练 / 推荐 / 云同步 / 存储 / AppData / Settings / Focus Mode / PWA → 升级到 `/multi-agent-audit`。

## 推荐衔接
`/diagnose` ↔ `/zoom-out` 双向；之后到 `/grill-with-docs` 或 `/to-issues`。
