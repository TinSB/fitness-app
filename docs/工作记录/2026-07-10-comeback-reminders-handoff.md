# 批次 F 交接件：召回通知（缺席变奏）

> 2026-07-10 ｜ owner 拍板：文案三轮打磨（AI 味 → 教练直陈 → **Apple 风格**）后定稿
> 「使用备选正文，然后可以开始」；行为设计按呈报推荐通过。

## 文案定稿（owner 审定，Apple 风格：完整句/观察式/句号沿通知先例）

| 档 | 触发 | 标题 | 正文 |
|---|---|---|---|
| 1 | 距上次训练 5 天 | 该练{日名}了 | 距上次训练已有 5 天，重量沿用上次即可。 |
| 2 | 12 天 | 继续你的训练 | 距上次训练已有近两周。你的计划保持不变，随时可以继续。 |
| 3 | 21 天 | 重新开始 | 训练循环已重置，首场训练将从较轻的重量开始。 |

英文：Time for {Day} / It's been 5 days since your last session. Pick up right where you left off.
｜ Ready when you are / It's been about two weeks. Your plan hasn't changed — continue anytime.
｜ A fresh start / Your cycle has been reset. Your first session back will start light.

- 档 1 带动态训练日名（排程时轮换投影算）；档 2/3 不带（跨周日名易过期，21 天时循环已重置）。
- 档 3 承诺 = 回归协议真实行为（21 天线同源，comebackRestartGapDays）。

## 行为设计（已批）

- 三档 5/12/21 天各一条，练一场即全部取消重排；三条发完永久安静直到下次训练。
- 发送时刻 = 历史训练开始时段的中位小时（贴个人节奏）；无历史回退 19:00。
- 重排时已过期的档直接跳过（不迟发）。
- 开关：设置通知区新「召回提醒」行，**缺省开（opt-out）**——区别于 restEnd/weekly 的
  opt-in；理由=已授权通知的用户默认受益，未授权系统本来不投递、不骚扰。
- 点开 → 系统默认打开 App 即今日页（处方已按回归协议算好）。

## 工程（沿 RedeNotifications 既有三件套模式）

1. ComebackReminderPolicy（纯函数）：(lastSessionISO, sessionStartHours, nextDayName, comebackEnabled, now) → [ResolvedComebackReminder(id, fireDate, messageCode, dayName?)]；code=comeback_5d/12d/21d。
2. Scheduler.replaceComeback（固定 id 先取消后排，同 replaceWeekly）。
3. NotificationCopy 加 comebackTitle/Body(code:dayName:)（句号沿通知先例——UI 无句号红线不适用于系统通知面，测试注明豁免）。
4. 写闸 applyNotificationPreferences 加 comeback 参数（缺省键=开：读侧 `!= false`）；设置行第三条。
5. 重排触发：现有 weekly 重排同点（练完/启动/开关变更）。
6. 验证：policy 测试（档位数学/过期跳过/中位小时/回退/关=空）+ L10n 断言 + 写读回环 +
   模拟器真 banner 实拍（种 lastSession=now-5天+3分 → fire 3 分钟后 → 授权（computer-use
   点系统弹窗）→ 退后台等 banner）。

## 禁区

- 不加第 4 档不加重发；不做服务端推送（纯本地预排）；不动 restEnd/weekly 行为；
  文案不再改动（owner 三轮定稿）。
