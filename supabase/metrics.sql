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
