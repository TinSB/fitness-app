# 批次 G 交接件：去 AI 感第二轮 · 视觉批（N1 热力图 + N2 Hero 卡 + N6 目录修复）

> 2026-07-13 ｜ owner 拍板「N1 + N2 先做，N6 带上，用专业 prompt」
> 源头 = 同日第二轮 AI 感全界面审计（九屏实拍）：残留 AI 感形态 =「满屏均质文字行 +
> 零图形语言」。上轮六大来源已修五件半未回潮。

## N1 · 人形肌群热力图（发展区块）

**目标**：把 10 块肌群等级从「9 行文字列表」升级为「前/后人形分区色块图」——
调研实锤（EVIDENCE_LEDGER：竞品拆解）「展示层热力图零差评」。

- **风格**：锻造钢板人形（直线+斜角切割的分区多边形，贴 Rede 工业风；不做写实肌肉
  线稿不做圆润卡通）。纯 SwiftUI Path 手绘，零外部资产、零依赖。
- **分区**（按解剖可见面）：正面=chest/shoulders/biceps/core/quads/calves；
  背面=back/triceps/glutes/hamstrings/calves（小腿两面都有，取同色）。头/手/脚为
  轮廓留白不着色。
- **着色**：等级→redeEmber 不透明度五档（Lv1-4/5-8/9-12/13-16/17-20）；
  **校准中=细描边无填充**（灰屏语义延续）；着色只表达等级，不做「本周量」双语义
  （防解读混乱，YAGNI）。
- **交互**：点击区块 → 打开该肌群详情 sheet（复用 MuscleDetailSheet 全链）；
  a11y：每区块 accessibilityLabel=「肌群名，等级 N」。
- **布局**：发展区块内「整体级别」行下方，前/后人形并排（各约 40% 宽）；
  其下保留现有文字行列表（热力图是入口增强，不替换文字行——信息完整性红线）。
- **组件**：`MuscleHeatmapView`（app 层新文件，**记得 pbxproj 四处登记**）；
  Path 坐标常量表 + 等级色阶纯函数（可单测——色阶映射/校准态判定放 L10n 无关的
  app 内纯 helper，或下沉包内若零依赖可行）。

## N2 · 今日页下一动作 Hero 化

**目标**：建立页面焦点——「下一个要练的动作」从均质行升级为主卡。

- **Hero 卡内容**：动作名（redeHeadline）+ 大字「重量 × 次数」（练完态总结卡同款
  数字层级）+ 副行「N 组 · 休 Ns · RIR n」+ 上下文行（「上次 85×8 ↑2.5」/「首练」）。
- **判定「下一个」**：无进行中训练 = 列表第一个动作；训练进行中 = 当前动作
  （沿既有橙条指示的同源判定，勿另起口径）。
- 其余动作保持现有行样式；hero 卡点击行为与原行一致（进动作详情）。
- **XS/AccessibilityM 两端字号实拍验证**（大字号下 hero 卡不得截断）。
- ForgedCard 面板预算检查过（hero 卡若用 ForgedCard 需查预算脚本白名单）。

## N6 · 目录双计修复

- arnold-press secondary [triceps, front-delt] → **[triceps, side-delt]**（阿诺德
  旋转轨迹特征=中束参与；front-delt 已是 primary 不得重复）。
- landmine-press secondary [triceps, front-delt] → **[triceps, chest]**（斜上推
  轨迹=上胸参与）。
- **防回潮契约测试**：CatalogContractTests 加全目录断言「primary 不得出现在
  secondary」（此类双计=1.5 倍计数污染 MLE 曝光）。

## 验收（测试+实拍）

1. 热力图：饱满种子（8 周）实拍前/后人形着色梯度；点击胸部区块弹详情 sheet；
   校准中肌群描边态实拍（3 场种子）；a11y 标签。
2. Hero 卡：今日页首动作主卡实拍（含「上次…↑」上下文）；AccessibilityM 不截断；
   其余行不变。
3. N6：契约测试全绿；大块等级零扰动（front-delt/side-delt/chest 同归并逻辑核对
   ——arnold 的 secondary 改 side-delt 仍归 shoulders ✓ 大块不变；landmine 的
   front-delt→chest **大块从 shoulders 变 chest**（0.5 权重迁移）——如实接受，
   这是修正不是回归；goldens 若有波及逐一核对留痕。
4. 全量门禁 exit 0 + workflow 多 lens 并行审查（正确性/设计一致性/回归）。

## 禁区

- 不替换发展块文字行（热力图是增强层）；不做本周量双语义着色；不引入图片资产/
  第三方绘图库；不动均衡度/tier 计算；hero 卡不改处方数据结构（纯展示层）；
  写实肌肉图不做（钢板分区风）。
