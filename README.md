# IronPath

## 证据来源与算法边界

IronPath 的训练建议分为三层证据等级：

- Tier A：直接权威依据。来自 ACSM、HHS Physical Activity Guidelines、CDC / Healthy People 2030 等指南或专业立场文件，可用于健康底线、训练处方原则和渐进超负荷边界。
- Tier B：研究支持规则。来自系统综述、专业教材或训练实践共识，可用于周训练量、RIR/RPE、重复次数范围、减量周和动作质量门槛。
- Tier C：产品化辅助规则。用于把训练记录转成 app 内部决策，例如 e1RM、有效组、肌群贡献权重、readinessScore 和 warmupPolicy。它们是训练决策辅助，不是权威机构直接给出的固定公式。

主要来源的使用边界：

- ACSM：用于训练处方、负荷范围、频率建议、渐进超负荷、恢复和风险筛查原则；不直接替代医疗诊断，也不直接决定某一天必须使用的精确重量。
- NSCA：用于力量训练、动作编排、技术标准、周期化和专项体能；不用于医疗诊断或普通健康活动最低标准。
- HHS / CDC / Healthy People 2030：用于健康底线、活动达标 KPI 和长期健康方向；不用于卧推/深蹲具体重量、肌肥大专项组数或 e1RM。
- NHANES / NHIS / BRFSS：用于人群健康基准、健康行为趋势和统计背景；不直接控制个人训练重量、动作选择或组数处方。
- BLS American Time Use Survey：用于时间预算和计划现实性解释；不用于训练效果判断或力量/肌肥大处方。
- Health & Fitness Association / SFIA：只用于行业趋势和运动参与率背景；不得用于训练处方、RIR、有效组、疼痛处理或负荷推进。

实现类型也会被明确标注：

- direct_guideline：指南直接支持。
- research_supported：研究支持。
- product_heuristic：产品化估算。

本系统用于训练决策支持，不是医疗诊断工具。e1RM 是估算，不等于真实 1RM；有效组是训练量估算，不是精确生理刺激测量；readinessScore 是自我调节辅助，不是医学疲劳诊断；疼痛/不适建议只用于训练层面的保守处理，持续疼痛应寻求专业人士评估。

IronPath 是一个本地优先的私人训练系统，基于 React、Vite 和 TypeScript。当前主线是肌肥大训练，并把体态纠偏、功能补丁、周剂量预算、准备度评分、减量判断、训练完成度和训练后总结接成一个闭环。

## 安装

```bash
npm install
```

## 本地运行

```bash
npm run dev
```

默认地址：

```text
http://127.0.0.1:3000/
```

如果端口被占用，Vite 会显示新的可用地址。

## Windows 一键启动

双击 `Start-IronPath.bat` 即可在电脑本地启动 IronPath。脚本会自动进入项目目录，检查 `node` / `npm`，缺少 `node_modules` 时自动执行 `npm install`，然后打开 `http://127.0.0.1:3000/` 并启动 Vite dev server。端口固定为 `3000`，host 固定为 `127.0.0.1`。

如果要用 iPhone Safari 做局域网测试，双击 `Start-IronPath-Mobile.bat`。手机和电脑必须连接同一个 Wi-Fi；脚本会提示运行 `ipconfig` 查看 IPv4 地址。然后在手机 Safari 打开：

```text
http://你的IPv4地址:3000/
```

例如：

```text
http://192.168.1.25:3000/
```

打开后可以通过 Safari 分享按钮选择“添加到主屏幕”。

如果脚本提示 `node` 或 `npm` 未识别，请安装 Node.js LTS：https://nodejs.org/ 。安装完成后需要关闭并重新打开 PowerShell / 终端，再检查：

```bash
node -v
npm -v
```

也可以运行 `Start-IronPath.ps1` 使用 PowerShell 版本启动器，本地模式使用默认参数，手机测试模式使用 `.\Start-IronPath.ps1 -Mobile`。如果 PowerShell 执行策略阻止 `.ps1` 运行，优先使用 `.bat` 文件即可，不需要强制修改执行策略。

## 测试与构建

```bash
npm run typecheck
npm test
npm run build
npm run build:stats
npm run build:size-check
npm run predeploy:check
```

`npm run build` 只做普通生产构建，不会因为 chunk 体积门禁失败。`npm run build:stats` 会重新构建并打印 `dist/assets` 文件大小，用于查看体积分布；`npm run build:size-check` 会重新构建并执行严格体积检查，默认单个 JS chunk 超过 500 kB 时失败。`npm run predeploy:check` 会顺序执行 typecheck、test、build 和 size-check，适合上线前最后确认。

## 解释层与计划调整工作流测试

`src/engines/explainabilityEngine.ts` 现在只作为兼容导出层；实际解释逻辑拆到 `src/engines/explainability/`，按训练解释、每周行动解释、计划调整解释、证据解释和 shared helper 分责维护。

计划调整工作流已有 engine 层集成测试保护：从每周行动建议、生成 draft、构建 diff、应用实验模板、记录 session templateId、效果复盘到回滚都走真实函数组合。原模板不会被覆盖，实验模板保留可回滚记录，过期 stale draft 会被阻止应用。

## 性能与代码分割

首屏只保留 App shell、今日页、移动端 Focus Mode 和训练恢复所需核心逻辑。`ProgressView`、`PlanView`、`AssessmentView` 和完整 `TrainingView` 使用 `React.lazy` 延迟加载；计划调整 apply / rollback、调整预览、实验效果复盘和备份恢复在用户触发时动态导入。

项目只保留一个 Vite 配置文件：`vite.config.ts`。React 插件、Tailwind CSS 插件、Vitest 配置、build 配置和 manual chunks 都从这个文件读取，避免 `vite.config.js` / `vite.config.ts` 双配置造成 test 与 build 行为不一致。

`vite.config.ts` 使用 manual chunks 将 React、AJV 校验、分析引擎、计划调整引擎、证据内容、进度页和计划页拆成可读 chunk。Focus Mode 保持轻量，不同步加载 Progress / Plan 等重页面；Progress / Plan 和计划调整相关逻辑按需加载。

## Vercel 上线部署

上线前本地检查：

```bash
npm run typecheck
npm test
npm run build
npm run build:stats
npm run build:size-check
npm run predeploy:check
```

GitHub 提交前确认不要提交：

- `node_modules`
- `dist`
- `.env`
- `.env.*`
- `.vercel`

这些路径已经写入 `.gitignore`。如果未来发现它们已经被 Git 跟踪，不要删除本地文件，先用 `git rm --cached` 从 Git 索引移除，再重新提交。

Vercel 从 GitHub 导入项目时使用：

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

项目根目录包含 `vercel.json`，会把所有路径 rewrite 到 `/index.html`，用于支持 SPA 刷新和未来子路径访问。当前版本不需要环境变量，`.env.example` 只保留说明；不要提交真实 secret。

Vercel 部署后测试：

1. 电脑端打开 Vercel URL。
2. iPhone Safari 打开 Vercel URL。
3. 添加到主屏幕。
4. 在 Focus Mode 完成一组。
5. 刷新页面后确认 `activeSession` 可恢复。
6. 导出 / 导入 JSON 备份。
7. 打开 ProgressView / PlanView，确认懒加载页面正常。

数据默认存储在当前浏览器本地。更换设备、清理 Safari 数据或删除站点数据可能导致本地数据丢失，建议定期导出 JSON 备份。当前版本不包含登录或云同步，上线前不建议临时加入后端。

main 分支可作为 Production 部署来源；feature 分支或 PR 可用于 Vercel Preview Deployments。测试新功能时先查看 Preview URL，再合并到 main。

如果 PWA 出现旧版本缓存，先刷新页面；iPhone 主屏幕版本仍异常时，移除主屏幕图标后重新添加。

## Health Data Import V1

IronPath 当前是 Web/PWA，不是 iOS 原生 App。Safari PWA 不能直接读取 Apple Health / Apple Watch / HealthKit 数据，也不能写入 Apple Health。HealthKit 需要原生 iOS/watchOS App、HealthKit capability、Info.plist 权限说明和用户授权；WorkoutKit 也属于原生 iOS/watchOS 能力，不在当前版本内。

当前版本支持手动导入健康数据文件：

- 支持 `.csv` / `.json`。
- 支持 Apple Health 官方导出的 `export.xml`，但只解析训练恢复相关的关键指标。
- 支持睡眠、静息心率、HRV、心率、步数、活动能量、运动分钟、体重、体脂、VO2max 和外部 workout。
- 导入数据只用于准备度、恢复参考、活动负荷解释和记录页日历背景。
- 外部活动负荷会按过去 24 小时、48 小时和最近 7 天分层；24/48 小时影响当天训练建议更明显，7 天只作为趋势说明。
- Apple Watch workout 会显示为外部活动，例如跑步、羽毛球或骑行；它不会自动变成 IronPath 力量训练 session，也不会参与 PR / e1RM / 有效组。
- 健康数据可在“我的 → 健康数据导入”查看、删除、排除统计，或关闭“用健康数据辅助准备度 / 日历显示外部活动”。

边界说明：

- 健康数据不会覆盖用户主观输入。
- 单次异常指标不会强制 deload。
- 睡眠、HRV、静息心率和活动量只作为训练层面的保守提示，不作医疗诊断。
- 未来如果要做 HealthKit / WorkoutKit 深度同步，需要单独开发 iOS Companion App。

### Apple Health XML 导入

iPhone 健康 App 可以导出 Apple Health 数据，官方导出格式是 XML。IronPath Web/PWA 仍然不能直接读取 HealthKit，本功能只是让用户手动选择 `export.xml` 文件导入。

当前 XML 导入只支持关键恢复数据：

- 静息心率、HRV、心率、步数、活动能量、运动分钟、体重、体脂、VO2max。
- 睡眠片段会按 asleep Core / Deep / REM / Asleep 汇总为每日睡眠时长，并按醒来当天归档；InBed 和 Awake 不计入睡眠。
- Apple Watch Workout 会作为记录日历里的外部活动显示，不会写入 IronPath strength session history。

导入前可以选择最近 7 / 30 / 90 天或全部，也可以选择导入哪些数据类型。大型 XML 建议优先导入最近 30–90 天，避免浏览器处理时间过长。

不支持的 Apple Health 类型会被跳过并显示 warning。导入数据只用于 readiness 和恢复辅助，不会污染 PR、e1RM、有效组或力量训练历史。本系统不是医疗诊断工具。

## iPhone Safari 添加到主屏幕

IronPath 已包含基础 PWA 配置和应用外壳缓存。iPhone 上使用方式：

1. 用 Safari 打开 IronPath。
2. 点击 Safari 分享按钮。
3. 选择“添加到主屏幕”。
4. 之后从主屏幕图标启动 IronPath。

休息计时器使用时间戳恢复。锁屏或切后台后，再回到页面时会根据开始时间和休息时长重新计算剩余时间，但不会发送原生通知。

## 手机训练

训练页包含“极简训练模式”。手机屏幕进入训练时会优先显示当前动作、当前组、目标重量、目标次数、RIR、上次记录、当前策略、大按钮、动作质量、不适标记、替代动作和休息倒计时。

桌面端仍保留完整训练页，适合训练后复盘和细节编辑。

## 数据存储

训练数据默认保存在浏览器本地 `localStorage`，并按 key 拆分存储。数据模型包含 `schemaVersion`、迁移、清洗和 AppData schema 校验。

训练中完成组、更新辅助动作记录、标记不适、修改动作质量和更新计时器后，都会保存当前训练。刷新页面后，未完成的 `activeSession` 会恢复；已完成训练不会被误认为仍在进行。

## 备份与恢复

打开“进度”页，在“数据备份 / 恢复”区域操作：

- 导出完整备份会下载 `ironpath-backup-YYYY-MM-DD.json`。
- 导入备份会先迁移旧版本数据，再校验和清洗，确认后才替换当前本地数据。
- 无效 JSON 或无效训练数据不会覆盖当前数据。

## 内容与术语规范

全站默认语言为简体中文。训练术语统一收敛在 `src/i18n/terms.ts`，常用说明统一收敛在 `src/content/definitions.ts`、`src/content/evidenceRules.ts` 和 `src/content/professionalCopy.ts`。

保留的英文缩写只有：

- RIR：剩余可完成次数
- RPE：主观用力程度
- 1RM：理论单次最大重量
- ROM：动作幅度

保留这些缩写是因为它们在训练记录和处方中非常常见，中文全称会让训练中记录变慢。首次出现或说明区域应提供中文解释。

训练建议遵循保守、可执行的循证训练思路：优先看每周有效训练量、动作质量、RIR、恢复状态和不适模式；不因为单次状态好就盲目加重；不把纠偏和功能补丁做成抢主训练容量的独立计划。

IronPath 只提供训练决策支持，不是医疗工具。疼痛或不适相关提示只用于训练层面的保守调整，不提供医疗诊断。

## 训练数据专业度

IronPath 不再把所有完成组都等同为高质量训练数据。系统会区分：

- 完成组数：用户实际完成并记录的组。
- 有效组数：排除热身组、明显太轻、动作质量较差或出现不适后，仍满足训练刺激要求的工作组。
- 有效分：介于完成组和有效组之间的加权分数，用于反映“这组有多少训练价值”。

e1RM 是根据最近同动作高质量工作组估算的理论单次最大重量。当前默认使用 Epley 公式，并根据动作质量、不适标记、RIR、重复次数范围和最近记录稳定性给出低 / 中 / 高置信度。历史数据不足时，系统不会输出看似精确的公斤建议，而是提示按目标次数和 RIR 选择可控重量。

系统会区分当前 e1RM 和历史最佳 e1RM：

- 当前 e1RM：优先来自最近 3-5 次同动作高质量记录，用于当天负荷建议。
- 历史最佳 e1RM：来自历史最高可信记录，只用于进度回看。
- 同一替代链只作为动作模式参考；不同器械或变式不会直接共享精确 e1RM 或高质量 PR。只有相同动作 ID 或显式 `canonicalExerciseId` 相同，才允许合并记录池。

当前 e1RM 使用近期稳定估算，默认采用最近高质量记录的中位数，避免一次超常表现把训练推荐突然抬高。历史最佳仍会保留在进度页，但不会直接作为当天推荐重量。

训练中可以记录“推荐重量偏轻 / 合适 / 偏重”。这个反馈只作为校准信号：连续偏重会让后续建议更保守，连续偏轻且动作质量良好时可允许小幅积极推进；它不会直接篡改 e1RM 或历史最佳记录。

最佳记录分为普通记录、高质量记录和低置信记录。动作质量较差、出现不适、RIR 明显偏高或数据来源不完整的记录不会被标记为高质量 PR；它们仍会保留在历史中，但不会作为激进加重的主要依据。

周训练量使用“加权有效组”估算。动作如果提供 `muscleContribution`，系统会按贡献权重分配到相关肌群；如果没有，则主要肌群按 1.0、辅助肌群按 0.5 估算。这是训练量估算，不是精确生理刺激测量。

每周教练行动建议会把肌群训练量、完成度、推荐重量反馈、不适模式、当前 e1RM 和周期阶段合并成下周建议。建议会明确写出问题、处理方式、原因和置信度，例如补 2-4 组背部训练量、维持胸部当前训练量、减少腿部辅助动作、或先提高动作质量而不是继续加组。计划调整只生成预览，不会自动修改模板；需要真正应用时，应先复制模板并二次确认。

`src/content/evidenceSources.ts` 保存更具体的证据来源描述，包括用途、来源类型和最后审阅日期；`src/content/evidenceRules.ts` 保存结构化证据规则。每条规则包含实践总结、适用范围、置信度和适用边界，用于解释训练建议，而不是伪造精确医学结论或文献 DOI。

如果持续疼痛、麻木、放射痛或明显功能受限，应停止相关动作并寻求专业人士评估。

## 交付说明

不要打包以下目录或文件：

- `node_modules`
- `dist`
- `.vite`
- `.vitest`
- `coverage`
- `logs`
- `*.log`

保留源码、`package.json`、`package-lock.json`、`index.html`、Vite 配置和 `public` 里的 PWA 资源。

## 当前 PWA 限制

- iOS Safari 需要手动“添加到主屏幕”。
- 休息计时依赖时间戳恢复，不等同于原生通知。
- 数据默认只在本地保存，建议定期导出备份。
- Web/PWA 不能直接读取 HealthKit；健康数据支持 CSV / JSON / Apple Health export.xml 手动导入。
