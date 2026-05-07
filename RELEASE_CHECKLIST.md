# IronPath Release Checklist

## 必跑验证命令

```bash
npm run typecheck
npm test
npm run build
```

## 手动验收清单

- Today：打开今日页，确认推荐训练来自系统建议，主按钮可开始训练。
- Focus：完成一组，确认当前动作和当前组稳定推进。
- Focus 替代动作：执行一次替代，确认历史中保留原计划和实际执行。
- Focus 结束训练：未完成主训练时必须出现确认；确认后未完成组仍为未完成。
- Record：打开历史详情，确认 Summary、set logs、替代动作显示一致。
- Plan：生成调整草案、应用实验模板、回滚到原模板，确认当前计划状态同步。
- My 备份：导出备份，再导入 cleaned JSON，失败时不得覆盖当前数据。
- Health import：导入前先分析；取消或解析失败不得污染旧数据。
- DataHealth：暂不处理后当天隐藏，第二天可重新显示。

## 不允许提交

- 完整真实用户 JSON 或完整真实训练导出。
- `node_modules/`
- `dist/`
- `.env`
- `.vercel/`
- 临时日志、调试 dump、未匿名化的健康数据文件。

## 备份和回滚策略

- 导入任何外部数据前，先导出当前 IronPath backup。
- 保留用户提供的 raw JSON 在本地，不提交进仓库。
- 优先导入系统生成的 cleaned JSON。
- 如果导入分析结果为 unsafe，禁止覆盖当前数据。
- 如果导入需要人工复核，先查看修复摘要，再强确认导入 repaired data。
- 发现异常时，使用导入前 backup 回滚，而不是手动拼接历史记录。
