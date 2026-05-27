---
name: global-scan
description: 任何重要改动之前先做一次完整的全仓影响扫描并产出 inventory。读完后调用 `/global-scan`。
---

# Skill: global-scan

## 何时使用（命中以下任一项 → 强制使用）
- 推荐系统
- 训练逻辑（cycles / progression / fineTune / conservative prescription）
- 云同步（sync-on / receipts / conflicts）
- 存储（localStorage / AppData / IndexedDB）
- AppData / TrainingSession schema
- Settings 页
- Focus Mode
- PWA / Service Worker / cache

## 主入口
`.claude/commands/global-scan.md` 是权威定义。
直接使用：在 Claude Code 里输入 `/global-scan`。

## 关键产出
- 扫描范围与搜索关键词（含中英文 UI 文案、schema 字段、storage key）
- Inventory 表：file / symbol / responsibility / input / output / consumer / SoT / 处置
- 冲突：source-of-truth / presentation / dead code
- 数据风险 / UI 风险 / 部署风险

## 硬约束
- **不允许编辑代码**。
- 不允许只搜函数名——必须做语义 + 中文 UI 文案搜索。
- 不允许把扫描浓缩成“没问题”——必须给 inventory 表。
- 发现 SoT 冲突 → 升级到 `/multi-agent-audit`。

## 推荐衔接
通常是高风险改动的第一步，之后接 `/multi-agent-audit` 或 `/diagnose`。
