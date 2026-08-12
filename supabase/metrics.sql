-- Rede 产品指标视图（2026-08-12）
--
-- 为什么要有这个：选 Supabase 而不是 CloudKit 的核心理由就是「owner 要能看到数据」。
-- 这个能力一直在，但每次看都得现写 SQL。这里把反复要问的问题固化成视图。
--
-- ⚠️ 安全：全部建在 metrics schema，**不是 public**。
--    Supabase 的 PostgREST 只暴露 public + graphql_public，所以 metrics 不会出现在 API 上。
--    视图默认以 definer 身份执行、绕过 RLS——这正是聚合需要的，但也意味着它一旦落在
--    public 就等于把全体用户的数据暴露给任何一个登录用户。下面额外 revoke 一道保险。
--    只能用 service_role / SQL Editor（postgres 角色）读。
--
-- 幂等：整份可以重复执行。

create schema if not exists metrics;

-- 双保险：即使将来误把视图建进 public，这里也先把 metrics 关死。
revoke all on schema metrics from anon, authenticated;
revoke all on all tables in schema metrics from anon, authenticated;
alter default privileges in schema metrics revoke all on tables from anon, authenticated;

-- ── 1. 用户总览 ──────────────────────────────────────────────────────────
-- 一人一行。回答：谁注册了、练了多少、多久没来、他的引导答案是什么。
create or replace view metrics.users as
select
    u.id                                                    as user_id,
    u.created_at                                            as signed_up_at,
    u.last_sign_in_at                                       as last_sign_in_at,
    count(s.session_id)                                     as sessions,
    min((s.payload->>'date')::date)                         as first_session_on,
    max((s.payload->>'date')::date)                         as last_session_on,
    -- 跨度 vs 场数的落差 = 训练有多稀疏。这两个数放一起才有意义。
    (max((s.payload->>'date')::date) - min((s.payload->>'date')::date))  as span_days,
    (current_date - max((s.payload->>'date')::date))        as days_since_last,
    count(distinct s.device_id)                             as devices,
    max(s.updated_at)                                       as last_upload_at,
    -- 引导答案（真数据；配置缺失时为 null，不猜）
    c.payload->'userProfile'->>'primaryGoal'                as goal,
    c.payload->'userProfile'->>'trainingLevel'              as level,
    c.payload->'userProfile'->>'equipmentScenario'          as equipment,
    c.payload->'userProfile'->>'sex'                        as sex,
    c.payload->'userProfile'->>'locale'                     as locale,
    c.payload->'programTemplate'->>'splitType'              as split_type,
    (c.payload->'programTemplate'->>'daysPerWeek')::int     as planned_days_per_week
from auth.users u
left join public.training_sessions s on s.user_id = u.id
left join public.user_config      c on c.user_id = u.id
group by u.id, u.created_at, u.last_sign_in_at, c.payload;

-- ── 2. 每周活跃 ──────────────────────────────────────────────────────────
-- 留存曲线的原料：每人每个自然周练了几次。
-- 周口径与 App 引擎一致（日历周），见 2026-08 周口径迁移。
create or replace view metrics.weekly as
select
    s.user_id,
    date_trunc('week', (s.payload->>'date')::date)::date as week_start,
    count(*)                                             as sessions,
    count(distinct (s.payload->>'date')::date)           as distinct_days
from public.training_sessions s
group by 1, 2;

-- ── 3. 漏斗 ──────────────────────────────────────────────────────────────
-- 一行看完：注册 → 有配置 → 开练 → 练满一周量 → 最近还活着。
-- 「练满 4 场」是一个粗糙但可用的「真的开始用了」门槛。
create or replace view metrics.funnel as
select
    (select count(*) from auth.users)                                          as signed_up,
    (select count(*) from public.user_config)                                   as has_config,
    (select count(*) from metrics.users where sessions >= 1)                    as trained_1plus,
    (select count(*) from metrics.users where sessions >= 4)                    as trained_4plus,
    (select count(*) from metrics.users where days_since_last <= 7)             as active_7d,
    (select count(*) from metrics.users where days_since_last between 8 and 30) as lapsed_8_30d,
    (select count(*) from metrics.users where days_since_last > 30)             as gone_30dplus;

-- ── 4. 当场换动作 ────────────────────────────────────────────────────────
-- 处方给的是 exerciseId，实际做的是 actualExerciseId。两者不同 = 用户当场换掉了。
-- 这是**引擎选型质量的直接反馈**：某个动作被反复换掉，说明它在那个器械场景下不合适，
-- 或者目录里的替代族排序有问题。
-- 注：exerciseSubstitutions（计划级持久替换）是另一条路径，当前全空，等有数据再开视图。
create or replace view metrics.swaps as
select
    e->>'exerciseId'        as prescribed_id,
    e->>'actualExerciseId'  as actual_id,
    count(*)                as times,
    count(distinct s.user_id) as users
from public.training_sessions s,
     lateral jsonb_array_elements(s.payload->'exercises') e
where e->>'actualExerciseId' is not null
  and e->>'exerciseId' is not null
  and e->>'actualExerciseId' <> e->>'exerciseId'
group by 1, 2
order by times desc;

-- ── 5. 动作使用频次 ──────────────────────────────────────────────────────
-- 哪些动作真的被练到了。目录有 165 个动作，实际被用到的可能只有一小部分——
-- 这个差距直接指向「目录该不该继续扩」。
create or replace view metrics.exercise_usage as
select
    coalesce(e->>'actualExerciseId', e->>'exerciseId') as exercise_id,
    count(*)                                          as times,
    count(distinct s.user_id)                         as users,
    max((s.payload->>'date')::date)                   as last_used_on
from public.training_sessions s,
     lateral jsonb_array_elements(s.payload->'exercises') e
group by 1
order by times desc;

-- 建完再关一次（create view 会把权限重新发给 owner 的默认集合）。
revoke all on all tables in schema metrics from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 第二批（2026-08-12）：把 state 里已经存着、但一直没人看的东西露出来。
-- 全部零 App 改动——这些字段本来就在同步的 config 里。
-- ════════════════════════════════════════════════════════════════════════

-- ── 6. 循环死区风险 ──────────────────────────────────────────────────────
-- App 侧的 PlanReachability 只告诉**用户自己**；这个视图告诉 owner **有多少人中招**。
--
-- ⚠️ 只覆盖显式自定义了 daySequence 的用户。默认序列的长度由引擎从 splitType 推导，
--    在 SQL 里重实现那张映射一定会和引擎漂移（仓库里已有教训：app 层复算轮转必漂移）。
--    所以默认序列的用户这里报 unknown，不猜。
create or replace view metrics.dead_zone_risk as
with cfg as (
    select user_id,
           coalesce((payload->'programTemplate'->>'weeklyCycleRestart')::boolean, false) as weekly_restart,
           jsonb_array_length(payload->'planCustomization'->'daySequence')               as seq_len,
           payload->'planCustomization'->>'daySequence'                                  as day_sequence
    from public.user_config
),
wk as (
    select user_id,
           max(sessions)   as best_week,
           count(*)        as observed_weeks
    from metrics.weekly
    where week_start >= (current_date - 28)
    group by 1
)
select c.user_id,
       c.weekly_restart,
       c.seq_len,
       c.day_sequence,
       w.best_week,
       w.observed_weeks,
       case
           when c.seq_len is null                       then 'unknown'      -- 默认序列，长度不在 config 里
           when not c.weekly_restart                    then 'safe'         -- 顺延永远没有死区
           when coalesce(w.observed_weeks, 0) < 2       then 'insufficient' -- 数据不足以判断
           when w.best_week >= c.seq_len                then 'safe'
           else 'dead_zone'
       end                                              as status,
       -- 轮不到的位数（序列尾部有几天够不到）
       case when c.weekly_restart and c.seq_len is not null and coalesce(w.best_week, 0) < c.seq_len
            then c.seq_len - coalesce(w.best_week, 0) end as unreachable_count
from cfg c
left join wk w on w.user_id = c.user_id;

-- ── 7. 计划调整提案 ──────────────────────────────────────────────────────
-- 引擎提了什么、用户理没理。planAdjustment 非空 = 有一条待处理提案挂着。
-- 「提了但一直没被采纳」本身就是信号：要么提案不对，要么用户没看见。
create or replace view metrics.proposals as
select u.user_id,
       c.payload->'planAdjustment'->>'kind'                as kind,
       (c.payload->'planAdjustment'->>'fromDaysPerWeek')::int as from_days,
       (c.payload->'planAdjustment'->>'toDaysPerWeek')::int   as to_days,
       (c.payload->'programTemplate'->>'daysPerWeek')::int    as current_days,
       -- 现行天数已经等于建议值 = 大概率已经采纳过
       ((c.payload->'programTemplate'->>'daysPerWeek')::int
         = (c.payload->'planAdjustment'->>'toDaysPerWeek')::int) as looks_adopted,
       u.sessions,
       u.days_since_last
from metrics.users u
join public.user_config c on c.user_id = u.user_id
where c.payload->'planAdjustment' is not null
  and jsonb_typeof(c.payload->'planAdjustment') = 'object';

-- ── 8. 教练动作被划掉的次数 ──────────────────────────────────────────────
-- coachState.dismissed 里本来就在记 actionKey → 累计 dismiss 次数。
-- 跨用户聚合 = 哪一类教练动作最不受欢迎。actionKey 形如 "volumeBoost:2026-06-22"，
-- 冒号前是动作类型，后面是那一周——按类型归并才有统计意义。
create or replace view metrics.coach_dismissals as
select split_part(d->>'actionKey', ':', 1)   as action_type,
       sum((d->>'count')::int)               as dismissals,
       count(distinct c.user_id)             as users
from public.user_config c,
     lateral jsonb_array_elements(c.payload->'coachState'->'dismissed') d
where jsonb_typeof(c.payload->'coachState'->'dismissed') = 'array'
group by 1
order by dismissals desc;

-- ── 9. 临时换天 ──────────────────────────────────────────────────────────
-- rotationOffset 每被「今天换一天练」用一次就 −1（FR-TR12 抵消轮转推进）。
-- 绝对值 = 累计换天次数。数值偏大 = 有人在持续躲某个训练日，
-- 那通常说明那一天本身有问题（太长、器械不对、动作不喜欢）。
create or replace view metrics.day_overrides as
select user_id,
       abs(coalesce((payload->>'rotationOffset')::int, 0)) as override_count,
       payload->'oneTimeDayOverride'                       as pending_override
from public.user_config
where coalesce((payload->>'rotationOffset')::int, 0) <> 0
   or payload->'oneTimeDayOverride' is not null;

-- ── 10. 通知开关 ─────────────────────────────────────────────────────────
-- 哪些提醒被关掉了。召回提醒缺省开，被关 = 用户嫌吵，是文案或频率的信号。
create or replace view metrics.notification_optout as
select count(*)                                                                as configs,
       count(*) filter (where (payload->'notifications'->>'restEndEnabled')::boolean)  as rest_end_on,
       count(*) filter (where (payload->'notifications'->>'weeklyEnabled')::boolean)   as weekly_on,
       count(*) filter (where (payload->'notifications'->>'comebackEnabled')::boolean) as comeback_on,
       count(*) filter (where payload->'notifications' is null)                        as never_configured
from public.user_config;

-- ── 11. 计划级持久替换 ───────────────────────────────────────────────────
-- exerciseSubstitutions 是"从此以后都用 B 代替 A"，比当场换（metrics.swaps）更强的信号：
-- 用户不是这次不想练，是根本不要这个动作。
create or replace view metrics.substitutions_persisted as
select key            as original_id,
       value #>> '{}' as replacement_id,
       count(*)       as users
from public.user_config,
     lateral jsonb_each(payload->'exerciseSubstitutions')
where jsonb_typeof(payload->'exerciseSubstitutions') = 'object'
group by 1, 2
order by users desc;

revoke all on all tables in schema metrics from anon, authenticated;
