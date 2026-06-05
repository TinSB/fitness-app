# IronPath Diet Companion — 双语 UX 文案规范 (Bilingual Copy Spec)

> 版本 v1.2（去 AI 腔 · 专业精简版）· 2026-06-03 · 状态：P0/P1 已修订
> 适用：iOS 原生「饮食记录 + 食材推荐」App · 英文为主 (en-US)，中文 (zh-Hans) 为次选 locale
> 本文档用中文书写；所有**面向用户的字符串以英文为准**，每条配中文对照供创始人逐条审阅。
> 单位：默认展示美制 (lb / ft-in / oz)，内部公制。

> **v1.2 修订（去 AI 腔，据母语编辑）**：删除六大"安抚性填充"病灶（`totally fine` / `we'll work with it` / `There's no rush` / `Take all the time you need` / `Whenever you're ready` / `steady progress`）；砍并从句与破折号堆砌、删多余铺垫第二句、宣传册腔标题改功能性表述；约 30 条更专业更简洁。安全/门控文案保持非评判支持，只去甜腻、零数字。保留：隐私声明、`Movement is a bonus, not a requirement.`、`Take a break from tracking`、`Logged.`、撤销回执。
> **v1.1 修订**：重写非母语/翻译腔英文；统一支持指代为 "a doctor or dietitian"；安全区去缩略、不含数字；补齐撤销回执、支持路由兜底、权限被拒、删除数据等缺失文案（§11A）。

---

## 0. 写作前置：本规范如何处理"安全文案"

三条贯穿全文的红线：

1. **非评判**：全 App 禁用 `over / exceeded / failed / cheat / 超标 / 失败 / 作弊`。
2. **安全数字不回显**：热量下限、BMI、降幅等安全阈值不写进面向用户的安全/ED 文案；功能性数字（蛋白目标、推荐克数、剩余热量）照常显示。
3. **不承诺、按地区路由**：支持入口用中性语言，不写死热线，不对保密性/流程做绝对保证。

> **v1.2 语气准则**：专业、简洁、克制（对标 Apple / Things / Oura）。短句、动词开头、删填充安抚与多余铺垫。安全文案"去甜腻 ≠ 去善意"——保持支持，但不煽情。

---

## 1. 品牌 Voice & Tone + 术语表

| # | 原则 | 含义 |
|---|---|---|
| 1 | Plain, not clinical | 平实、直接、第二人称；不用 optimal / compliance / deficit 进 UI |
| 2 | Forward-looking | "没达到"只谈下一步；结果以区间与周平均呈现 |
| 3 | Honest about limits | 数据缺失/无解/估算如实说，不做医疗承诺 |
| 4 | Concise & confident | 短句、动词开头，砍不改变意思的词；不啰嗦、不安抚填充 |
| 5 | Supportive, not saccharine | 安全场景非评判、支持，但不煽情、不堆甜腻短语 |

术语表（统一英文，全 App 一致）：calories/energy（热量）· macros: protein/carbs/fat（宏量）· fiber（纤维）· serving（份）· your kitchen（厨房，内部代号 Pantry 不进 UI）· staples（常备）· fresh items（生鲜）· stock level: Plenty/Low/Almost out（档位）· today's picks（推荐）· Use these（采用）· daily target（每日目标）· activity credit（运动加回）· cal left（剩余）· Lose fat / Maintain / Build muscle（目标）· a doctor or dietitian（专业支持，全 App 统一）。算法术语 TDEE/BMR/LP/deficit 一律不进 UI。

---

## 2. Onboarding

| 场景 | English | 中文对照 | 备注 |
|---|---|---|---|
| 欢迎标题 | **Build meals from what's in your kitchen.** | 用你厨房里的食材搭配三餐。 | v1.2：弃宣传册腔 "Eat for your goals" |
| 欢迎副标题 | Set your goals and we'll turn them into daily targets, then plan meals around what you already have. | 设好目标，我们据此定出每日目标，再用你已有的食材安排三餐。 | v1.2：拆并从句、去破折号 |
| 主 CTA | Get started | 开始 | — |
| 次 CTA | I already use IronPath | 我已经在用 IronPath | — |
| 单位制问题 | Which units do you prefer? | 你更习惯哪种单位？ | — |
| 选项 | Imperial (lb, ft, oz) / Metric (kg, cm, g) | 美制 / 公制 | 美区默认美制 |
| 单位脚注 | You can change this anytime in Settings. | 随时可在设置中更改。 | — |
| 档案标题 | A little about you | 关于你的一点信息 | — |
| 性别 | Sex (used to calculate your calorie needs) | 生理性别（用于热量计算） | — |
| 出生日期 / 身高 / 体重 | Date of birth / Height / Current weight | 出生日期 / 身高 / 当前体重 | — |
| 体重占位符 | e.g., 165 lb | 例如 165 lb | — |
| 隐私微文案 | Your health data stays on your device. We never use it for ads. | 你的健康数据保存在本机，我们绝不用于广告。 | 保留（已极简） |
| 目标标题 | What are you working toward? | 你想达成什么？ | — |
| 减脂 | **Lose fat** — eat slightly under your target | 减脂——略低于目标进食 | v1.2：弃含糊 "gentle" |
| 保持 | **Maintain** — keep things steady | 保持——维持现状 | — |
| 增肌 | **Build muscle** — eat slightly above your target | 增肌——略高于目标进食 | v1.2：与减脂平行、去 "to grow" |
| 目标脚注 | You can switch goals later. Progress carries over. | 之后可以切换目标，进度会延续。 | — |
| 同步卡 | Sync from IronPath? | 从 IronPath 同步？ | — |
| 同步说明 | We can bring over your goal and workout calories. Nothing changes without your OK. | 我们可以同步你的目标和运动消耗。未经你同意不会更改任何设置。 | v1.2：删 "You stay in control" 空泛安抚 |
| 冲突提示 | IronPath says "Build muscle," but you picked "Maintain." Which should we use? | IronPath 显示"增肌"，而你选了"保持"。用哪个？ | — |
| 冲突选项 | Use IronPath / Keep my choice | 用 IronPath / 保留我的选择 | — |

### 2.3 准入门控（未成年 / 孕期哺乳 / 异常低体重）

| 场景 | English | 中文对照 | 备注 |
|---|---|---|---|
| 未成年标题 | We've set things up a little differently for you | 我们为你做了一些不同的设置 | — |
| 未成年正文 | Because you're under 18, the app won't set weight-loss or calorie-reduction goals. Growing bodies have different needs — those are best guided by a parent or guardian with a doctor or dietitian. | 因为你未满 18 岁，本 App 不会设置减脂或减热量目标。成长中的身体需求不同——这类事最好由家长或监护人，连同医生或营养师一起指导。 | v1.2：拆两句 |
| 未成年可用范围 | You can still use it to learn about balanced meals. | 你仍然可以用它来了解均衡饮食。 | — |
| 未成年 CTA | Continue with general info | 继续（一般信息） | — |
| 孕期设问 | Are you currently pregnant or breastfeeding? | 你目前是否处于孕期或哺乳期？ | — |
| 选项 | Yes / No / Prefer not to say | 是 / 否 / 不想说 | — |
| 孕期正文 | During pregnancy or breastfeeding, nutrition needs are different and weight-loss goals aren't a fit here. We'll keep things general — please check with a doctor or dietitian for guidance that fits you. | 孕期或哺乳期的营养需求不同，减脂目标不适合在这里使用。我们只做一般性内容——请咨询医生或营养师，获取适合你的指导。 | — |
| 孕期 CTA | Continue | 继续 | — |
| 低体重二次确认 | Let's double-check your numbers | 我们再核对一下你填的数字 | — |
| 低体重正文 | The height and weight you entered are outside the usual range. Can you double-check them? | 你填的身高体重超出了常见范围。能再核对一下吗？ | v1.2：去 "a bit" 对冲与铺垫 |
| 低体重确认按钮 | Yes, that's correct / Let me fix it | 填写无误 / 我再改一下 | — |
| 低体重确认后 | Thanks for confirming. Weight-loss goals are off for now. If you'd like support, a doctor or dietitian is a good next step. | 感谢确认。减脂目标暂时关闭。如果你需要支持，医生或营养师是个不错的下一步。 | v1.2：删 "To keep things safe" 铺垫；锁定减脂；无数值 |

---

## 3. 每日计划页

| 场景 | English | 中文对照 | 备注 |
|---|---|---|---|
| 页标题 | Today | 今天 | — |
| 每日目标卡 | Daily target | 每日目标 | — |
| 热量展示 | 2,180 cal · 1,260 left | 2,180 卡 · 剩余 1,260 | — |
| 目标说明 | A target range, not a hard line. Aim for it across the week — daily numbers will vary. | 这是目标区间，不是死线。按整周去接近——单日有波动很正常。 | v1.2：删 "and that's fine" 安抚 |
| 宏量标签/进度 | Protein / Carbs / Fat · Protein 96 / 128 g | 蛋白 / 碳水 / 脂肪 · 蛋白 96 / 128 g | 单值 + 视觉容差带（UI §0） |
| 纤维 | Fiber 18 / 30 g | 纤维 18 / 30 g | — |
| 纤维提示 | Aim for this much. A bit more is fine. | 够到这个量就好，多一点也无妨。 | v1.2：弃 "reach for / comfortable point" 话痨 |
| 按餐标题 | Your meals | 你的餐次 | — |
| 每餐行 | Lunch · ~640 cal · P38 C70 F18 | 午餐 · 约 640 卡 · 蛋38 碳70 脂18 | — |
| 运动加回卡 | Activity credit | 运动加回 | 中性，无 flame/庆祝（UI P0-1） |
| 加回说明 | You moved more today, so we added 420 cal back to your meals. | 你今天活动量更大，已把 420 卡加回到你的餐次。 | v1.2：去 "remaining" 冗余 |
| 加回主文案 | Movement is a bonus, not a requirement. | 多活动是加分项，不是必须。 | 保留（反 ED 设计立场） |
| 加回为零 | Calories will appear here once your watch logs today's activity. | 等手表记录到今天的活动，热量会显示在这里。 | v1.2：去拟人 "We'll add" |

---

## 4. 推荐结果页

| 场景 | English | 中文对照 | 备注 |
|---|---|---|---|
| 页标题 | Today's picks for Lunch | 午餐推荐 | — |
| 副标题 | Foods you already have, measured to hit this meal's targets. | 用你已有的食材，配好克数来达成这一餐的目标。 | — |
| 清单项 / 生重 | Chicken breast — 140 g · Rice — 75 g (raw) | 鸡胸肉 — 140 g · 大米 — 75 g（生重） | — |
| 偏好入口 | Adjust picks | 调整推荐 | — |
| 加水果 | Add a fruit | 加一份水果 | — |
| 加水果反馈 | Added — one normal serving. | 已加入——一份正常份量。 | v1.2：去 "we kept it to" 拟人 |
| 优先消耗 | Using your spinach first — best eaten soon. | 优先用你的菠菜——尽快吃掉为佳。 | v1.2：去 "it's" |
| 采纳按钮 | Use these | 采用 | — |
| 重新生成 | Show me another option | 换一组 | — |
| 缺口标题 | Close — here's what would balance it out | 接近了——补上这些就齐了 | — |
| 缺口正文 | With what you have, this meal is low on protein. Any of these helps: | 用现有食材，这一餐蛋白偏低。下面任意一种都能补上： | v1.2：去 "a little"，would help→helps |
| 缺口建议 | + 30 g protein: chicken breast, tofu, or Greek yogurt | + 30 g 蛋白：鸡胸肉、豆腐 或 希腊酸奶 | — |
| 缺口 CTA / 次 CTA | Add to shopping list / Use the partial plan for now | 加入购物清单 / 先用这份部分方案 | — |

---

## 5. 库存管理

| 场景 | English | 中文对照 | 备注 |
|---|---|---|---|
| 页标题 | Your kitchen | 你的厨房 | — |
| 常备分区 | Staples (always on hand) | 常备（随时都有） | — |
| 常备说明 | Things like rice, oil, and salt. We assume you always have these, so we don't track amounts. | 像米、油、盐这些。我们默认你一直有，所以不追踪用量。 | v1.2：拆句、去 "you've always got" |
| 生鲜分区 | Fresh items | 生鲜 | — |
| 档位 | Plenty / Low / Almost out | 充足 / 少量 / 快没了 | 始终带文字+图标 |
| 档位提示 | Roughly how much do you have? | 大概还有多少？ | — |
| 精确克数 | Add exact amount (optional) | 填写具体克数（可选） | — |
| 录入方式 | Scan barcode · Take a photo · Pick from list · Scan receipt | 扫条码 · 拍照 · 从列表选 · 扫小票 | — |
| 采纳扣减 | Updated your kitchen — chicken is now Low. | 已更新厨房——鸡胸现在是"少量"。 | — |
| 撤销 / 撤销成功 | Undo · Restored — chicken is back to Plenty. | 撤销 · 已恢复——鸡胸回到"充足"。 | 回执保留（功能必需信息） |
| 补货确认入口 | Quick kitchen check — 30 seconds | 厨房快速核对——30 秒 | — |
| 补货正文 | Tap what you've restocked or used up. | 点一下你补货或用完的食材。 | v1.2：删铺垫首句 |
| 补货完成 | Your kitchen's up to date. | 厨房已是最新。 | v1.2：删 "Thanks —" 客套 |
| 保质期提醒 | Use your tofu in the next day or two. | 你的豆腐最好一两天内吃掉。 | v1.2：被动改主动 |
| 保质期行动 | Use it in today's picks | 用进今天的推荐 | — |

---

## 6. 记录 (Logging)

| 场景 | English | 中文对照 | 备注 |
|---|---|---|---|
| 记录入口 | Log a meal | 记一餐 | — |
| 搜索框 / 份量 | Search foods… / How much? | 搜索食材… / 多少？ | — |
| 记录成功 | Logged. | 已记录。 | 保留（toast 极简） |
| 记录后重排 | We've adjusted your remaining meals to fit. | 已相应调整剩下的餐次。 | — |
| 外食入口 | Eating out or can't weigh it? | 在外面吃 / 没法称重？ | — |
| 快速记录 | Search a dish · Snap a photo · Estimate the size | 搜菜品 · 拍张照 · 估个大小 | — |
| 估份说明 | A rough estimate works fine. | 大致估一下就行。 | v1.2：删 "totally fine / we'll work with it" 双重安抚 |
| 多人共餐 | Log just your share | 只记你吃的那份 | — |
| 条码提示 / 命中 | Point your camera at the barcode · Found it: {product name} | 把相机对准条形码 · 找到了：{产品名} | — |
| 条码未命中 | Can't find that one. Want to scan the nutrition label instead? | 没找到这个。要不要改扫营养成分表？ | — |
| OCR 扫描中 / 确认标题 | Reading the label… · Does this look right? | 正在识别成分表… · 这些对吗？ | — |
| OCR 确认正文 | These numbers came from the label — double-check before saving. Label values are "per serving," which is easy to misread. | 这些数字读自成分表——保存前请核对。成分表按"每份"标注，容易看错。 | v1.2：收紧 |
| OCR 确认 CTA / 失败回退 | Save · Couldn't read it clearly. Enter the numbers yourself? | 保存 · 没能看清。要手动输入数字吗？ | — |

---

## 7. 安全与健康守则（非评判支持 · 去甜腻 · 零数字）

| 场景 | English | 中文对照 | 备注 |
|---|---|---|---|
| 触及热量下限 | Your target is set to keep you eating enough to feel good and stay healthy. | 你的目标设在能让你吃得充足、感觉良好、保持健康的水平。 | v1.2：改主语为 target，去 "We have set…to a level that" |
| 下限补充 | We won't set it below a sensible amount of food, even for faster results. | 即使为了更快见效，我们也不会把进食量设到合理范围以下。 | v1.2：删 "To keep things safe and sustainable" 铺垫；无数字 |
| 下降过快标题 | This is happening a bit fast | 进展有点快 | — |
| 过快正文 | Your weight is dropping faster than is usually comfortable. A steadier pace tends to feel better and last longer. | 你的体重下降得比通常舒适的节奏更快。更平稳的节奏往往更舒服、也更持久。 | v1.2：删 "There is no rush" 安抚填充 |
| 过快选项 | Ease the pace / Keep as is | 放慢一些 / 维持现状 | — |
| 暂停追踪入口 | Take a break from tracking | 暂停记录一段时间 | 保留（已极简） |
| 暂停说明 | Tracking can feel like a lot. You can pause anytime — your data stays, and you can pick back up later. | 记录有时会让人觉得累。你随时可以暂停——数据会保留，之后再继续。 | v1.2：去 "whenever you are ready" 填充 |
| 暂停确认 | Tracking paused. Resume whenever you like. | 已暂停记录。随时可以恢复。 | v1.2：删 "Take all the time you need" 甜腻 |
| 专业支持入口 | Talking to someone can help | 找人聊聊会有帮助 | — |
| 支持正文 | If your relationship with food or your body feels hard right now, support is available. A doctor or a support service near you can help. | 如果你此刻觉得和食物或身体的关系有些艰难，是有支持可以寻求的。医生或你附近的支持服务都能帮上忙。 | v1.2：去 "Reaching out…can be a good step" 对冲 |
| 支持 CTA / 副文案 | Find support near me · We'll help you find resources near you. | 查找我附近的支持 · 我们会帮你找到你附近的资源。 | — |
| 支持路由兜底 | We couldn't find a local service to link to. A good next step is to reach out to a doctor or a trusted health line in your country. | 我们没能找到可链接的本地服务。一个不错的下一步是联系医生，或你所在国家可信赖的健康热线。 | — |
| 免责声明 | This app offers general nutrition information, not medical advice. For anything about your health, please talk with a doctor or dietitian. | 本 App 提供一般营养信息，而非医疗建议。任何与你健康相关的问题，请咨询医生或营养师。 | — |
| 不可行处置 | At this calorie level, we can't build a plan that's safe and balanced. | 在这个热量水平下，我们无法搭出既稳妥又均衡的方案。 | v1.2：去 "both" |
| 不可行选项 | Ease the pace · Extend the timeline · Raise calories · Talk to a professional | 放慢节奏 · 延长周期 · 提高热量 · 咨询专业人士 | — |

---

## 8. 空状态 / 加载 / 错误 / 离线

| 场景 | English | 中文对照 |
|---|---|---|
| 空-库存 / 副 | Your kitchen's empty for now · Add a few fresh items and we'll start suggesting meals. | 你的厨房目前是空的 · 加几样生鲜，我们就能开始推荐了。 |
| 空-记录 / 推荐 | Nothing logged yet today · Add some food to your kitchen first | 今天还没有记录 · 先往厨房里加点食材 |
| 加载-计划 / 推荐 | Building your plan… · Finding the best mix from your kitchen… | 正在生成你的计划… · 正在从你的厨房里找最合适的组合… |
| 错误-通用 / 副 | Something went wrong on our end · Try again in a moment. | 我们这边出了点问题 · 稍等片刻再试。 |
| 错误-重试 | Try again | 重试 |
| 离线横幅 | You're offline — core features still work | 当前离线——核心功能仍可用 |
| 离线-条码 | Scanning new products needs a connection. Enter it by hand for now. | 扫描新商品需要联网。先手动输入。 |
| 离线-同步 | We'll sync with IronPath once you're back online. | 联网后我们会与 IronPath 同步。 |
| 无数据食材 / 选项 | We don't have nutrition data for this one yet · Pick a similar food · Enter it myself | 我们暂时没有这个食材的营养数据 · 选一个相近的 · 自己填 |

---

## 9. 关键通知 & 推送（短、有信息量、不制造焦虑）

| 场景 | English | 中文对照 | 备注 |
|---|---|---|---|
| 晨间计划就绪 | Your plan for today is ready 🍳 | 今天的计划好了 🍳 | — |
| 运动加回 | You moved more today — calories added back to your meals. | 你今天活动更多——已把这些热量加回到你的餐次。 | v1.2：压缩 |
| 保质期临近 | A couple of fresh items are best used soon | 有几样生鲜适合尽快吃掉 | — |
| 补货提醒 | Quick 30-second kitchen check when you have a sec | 有空时做个 30 秒厨房核对 | — |
| 周度趋势 | Your week at a glance | 一周概览 | v1.2：删 "steady progress" 空泛加油 |
| 周度趋势(无下降) | Your week at a glance | 一周概览 | v1.2：删废话尾巴 |
| 温和回归 | Your kitchen's here when you want it | 你的厨房一直都在 | v1.2：去 "Whenever you're ready" 填充 |
| 通知设置 | You can turn any of these off in Settings. | 这些都可以在设置里关掉。 | — |

---

## 10. 设置项关键文案

Units（单位）· Goal（目标）· 切目标提示「After switching, it takes about 2–3 weeks for your plan to re-tune to the new goal. / 切换后约 2–3 周计划会重新校准到新目标。」· Meals per day（每日餐数）· Day starts at（一天的起点，默认 4:00 AM）· IronPath sync · Apple Health & activity · 健康数据用途「We use your activity to adjust calories. We never use health data for ads. / 我们用你的活动量来调整热量。绝不将健康数据用于广告。」· Take a break from tracking（暂停记录）· Your data & privacy · Delete my data · About & disclaimer。

---

## 11A. 补充文案（系统态 / 权限 / 破坏性操作）

| 场景 | English | 中文对照 |
|---|---|---|
| 相机权限被拒 | Camera access is off. Turn it on in Settings, or enter foods by hand. | 相机权限已关闭。可在设置中开启，或手动输入食材。 |
| 健康权限被拒 | Without Apple Health, we can't add activity calories — everything else still works. | 没有 Apple 健康授权，我们无法加入运动热量——其它功能仍可正常使用。 |
| 通知权限被拒 | Notifications are off. Turn them on in Settings for reminders. | 通知已关闭。如需提醒，请在设置中开启。 |
| 删除数据二次确认 | This permanently deletes your data and can't be undone. | 这将永久删除你的数据，且无法恢复。 |
| 删除确认 / 完成 | Delete everything / Cancel · Your data has been deleted. | 全部删除 / 取消 · 你的数据已删除。 |
| 暂停态主屏 / 恢复 | Tracking is paused. Your numbers and targets are hidden for now. · Resume tracking | 记录已暂停。你的数字和目标暂时隐藏。 · 恢复记录 |

---

## 11. 开放问题与风险（文案层面）

1. 支持路由兜底已补（§7）；仍需产品确认各地区资源数据来源。
2. 是否提供"隐藏数字 / 只看进度环"模式（ED 友好）。
3. 中文安全文案建议独立母语审校。
4. 门控"被拒感"需可用性测试验证。
