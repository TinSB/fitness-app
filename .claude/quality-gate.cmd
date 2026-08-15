#!/usr/bin/env bash
# Rede quality gate — mirrors .github/workflows/rede-ci.yml (job: validate).
# Keep EXPECTED_PACKAGES in sync with the workflow.
set -euo pipefail
cd "$(dirname "$0")/.."

EXPECTED_PACKAGES="RedeDataHealth RedeDomain RedeEntitlements RedeHealthKit RedeL10n RedeLocalSnapshot RedeNotifications RedePersistence RedeSync RedeSyncSupabase RedeTrainingDecision RedeWatchLink RedeWidgetShared"

for name in $EXPECTED_PACKAGES; do
  echo "== swift test: ios/packages/$name =="
  (cd "ios/packages/$name" && swift test)
done

for package in ios/packages/*/; do
  [ -d "$package" ] || continue
  name="$(basename "$package")"
  case " $EXPECTED_PACKAGES " in
    *" $name "*) ;;
    *) echo "ERROR: ios/packages/$name is not in EXPECTED_PACKAGES — register it here and in rede-ci.yml"; exit 1 ;;
  esac
done

# 整面板公理预算检查（设计语言 §12.6，拍板 2026-06-11）：每视图 ForgedCard 用量
# 不得超预算（预算=该文件内互斥状态/分屏的铭牌上限）。新增卡先过设计评审再提预算。
# 注：仅本地门禁；rede-ci.yml 同步属 CI 配置变更，需 owner 单独批准后跟进。
echo "== forged-card budget (one-panel axiom) =="
check_budget() {
  local file="ios/Rede/$1" budget="$2"
  local count
  count=$(grep -cE "ForgedCard ?[({]" "$file" || true)
  if [ "$count" -gt "$budget" ]; then
    echo "ERROR: $1 has $count ForgedCard uses (budget $budget) — 整面板公理 §12，先过设计评审"
    exit 1
  fi
  echo "  $1: $count/$budget"
}
check_budget "TodayTabView.swift" 1      # hero 判断牌
check_budget "TrainTabView.swift" 2      # hero 仪表 + 小结 PR 牌（异屏）
check_budget "ProgressTabView.swift" 0   # 公理样板屏：零卡
check_budget "PlanTabView.swift" 0       # 空态开放式
check_budget "PlanDayEditorView.swift" 0 # 编辑器 sheet：全开放行 + hairline，零卡
check_budget "PlanDaySequenceEditorView.swift" 0 # 顺序编辑器 sheet：全开放行 + hairline，零卡
check_budget "SettingsSheet.swift" 2     # 设备铭牌 + 单题编辑屏题卡（异屏）
check_budget "OnboardingView.swift" 2    # 题卡⇄结果卡（互斥）

# 文案声音守卫（文案基线 §3.4/3.5；铁律 2026-06-15 扩展全语态，2026-08-08 清除例外）。
# 存在的理由：这批规则此前只写在文档里，靠人工翻——结果 RedeStrings 文件头留着
# 2026-06-15 之前的旧规「判断句/收据句保留句号」，后来者照抄，攒出十几处违规，
# 最后要 owner 一条条截图指出来。规则不该靠记性维持，交给机器。
# 检查范围只限文案包的字符串字面量；注释行不算（规则本身要能被写进注释讨论）。
echo "== copy voice (文案基线 §3.4) =="
check_voice() {
  local label="$1" pattern="$2"
  local hits
  hits=$(grep -rnE "$pattern" ios/packages/RedeL10n/Sources/RedeL10n/*.swift 2>/dev/null \
         | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' || true)
  if [ -n "$hits" ]; then
    echo "ERROR: $label — 文案基线 §3.4，见 docs/REDE_PRODUCT_COPY_BASELINE.md"
    echo "$hits"
    exit 1
  fi
  echo "  ok: $label"
}
check_voice "中文句号（全语态一律不收，两拍改用全角空格）" '"[^"]*。'
check_voice "中文破折号挂补语" '"[^"]*——'
check_voice "英文 em-dash 挂补语（行尾不收句点，句间可留单个句点）" '"[^"]* — '
check_voice "禁用词（您/为您/即可/贴心/全方位/开启旅程/释放潜能/打造专属）" \
            '"[^"]*(您|为您|即可|贴心|全方位|开启旅程|释放潜能|打造专属)'

# 目录标签覆盖守卫。
# 存在的理由：ExerciseDetailCopy.detailLabel 对未知码的兜底是「回退原值」——漏一个
# 映射不会崩、不会报错，只会在中文版里安静地露出一个英文码。实证：2026-07-09 子肌群
# 钻取给目录加了 `lats`，标签表没跟上，直到 owner 在动作详情页截图才发现。
# 这个检查跨包（目录在 RedeTrainingDecision，标签在 RedeL10n），所以放门禁而非单包测试。
echo "== catalog label coverage =="
python3 - <<'PYEOF'
import json, re, sys, pathlib
cat_path = pathlib.Path("ios/packages/RedeTrainingDecision/Sources/RedeTrainingDecision/Resources/exercises.json")
src_path = pathlib.Path("ios/packages/RedeL10n/Sources/RedeL10n/ExerciseDetailCopy.swift")
cat = json.loads(cat_path.read_text())
items = cat if isinstance(cat, list) else (cat.get("exercises") or [])
src = src_path.read_text()

def mapped(name):
    m = re.search(r"static let " + name + r".*?\[(.*?)\n    \]", src, re.S)
    return set(re.findall(r'"([a-zA-Z0-9-]+)":', m.group(1))) if m else set()

checks = [
    ("primaryMuscle",    lambda e: [e.get("primaryMuscle")],        "muscleLabels"),
    ("secondaryMuscles", lambda e: e.get("secondaryMuscles") or [], "muscleLabels"),
    ("equipment",        lambda e: [e.get("equipment")],            "equipmentLabels"),
    ("kind",             lambda e: [e.get("kind")],                 "kindLabels"),
    ("movementPattern",  lambda e: [e.get("movementPattern")],      "patternLabels"),
]
bad = False
for field, get, mapname in checks:
    used = {c for e in items if isinstance(e, dict) for c in get(e) if c}
    miss = used - mapped(mapname)
    if miss:
        bad = True
        print(f"ERROR: {field} 有 {len(miss)} 个码在 {mapname} 里没有条目 → 中文版会露英文: {' '.join(sorted(miss))}")
    else:
        print(f"  ok: {field} ({len(used)} 种) → {mapname}")
sys.exit(1 if bad else 0)
PYEOF

echo "== xcodebuild: scheme Rede =="
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination 'generic/platform=iOS Simulator' \
  build

echo "== xcodebuild: subscription + Weekly Coach Review + app update + session draft tests =="
# 2026-07-20 收口：白名单补入 SessionStoreDraftTests（FR-TR14 S1 durable draft，5 条）
# 与周复盘政策测试（MemoPolicy/DatePolicy/LiftSignalPolicy）。保持与 rede-ci.yml 同一份清单。
#
# 显式排除（红测试，不进清单）：
#   StoreKitEntitlementsTests/testLocalCatalogPurchasePendingRestoreRenewalExpirationAndRefund
#   blocker：Xcode 26.6 + iOS 26.5 Simulator 保存 .storekit 配置报 SKInternalErrorDomain
#   Code=3（CHANGELOG 2026-07-18 已登记为发布阻断，非跳过）。解除条件与开闸动作序列见
#   docs/工作记录/2026-07-20-purchase-gate-checklist.md（开闸六项之①，解除时同 PR 进清单）。
REDE_SIMULATOR_ID="$(
  xcrun simctl list devices available |
    awk -F '[()]' '/iPhone/ && $2 ~ /^[0-9A-F-]+$/ { print $2; exit }'
)"
if [ -z "$REDE_SIMULATOR_ID" ]; then
  echo "ERROR: no available iPhone Simulator for RedeTests"
  exit 1
fi
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination "platform=iOS Simulator,id=$REDE_SIMULATOR_ID" \
  -only-testing:RedeTests/StoreKitEntitlementsTests/testProductionConfigurationFailsClosedWithoutApprovedProducts \
  -only-testing:RedeTests/SyncWriteSlotTests \
  -only-testing:RedeTests/StoreKitEntitlementsTests/testDebugPaidFixtureUnlocksFeatureWithoutOpeningPurchaseGate \
  -only-testing:RedeTests/StoreKitEntitlementsTests/testRedeCoachPageContentCoversEntitlementAndLaunchGateMatrix \
  -only-testing:RedeTests/StoreKitEntitlementsTests/testReadyCatalogDoesNotBypassDelayedEntitlementCheck \
  -only-testing:RedeTests/StoreKitEntitlementsTests/testWeeklyReviewFindingScopeCountsWeekDropsAndFailsClosedWhenDateIsUnknown \
  -only-testing:RedeTests/StoreKitEntitlementsTests/testWeeklyReviewMemoPolicyPromotesOneTypedFactAndKeepsTheOtherTwo \
  -only-testing:RedeTests/StoreKitEntitlementsTests/testWeeklyReviewDatePolicyUsesISOWeekYearAndHandlesCrossYearRange \
  -only-testing:RedeTests/StoreKitEntitlementsTests/testWeeklyReviewLiftSignalPolicyDropsCalibratingZeroDelta \
  -only-testing:RedeTests/SessionStoreDraftTests \
  -only-testing:RedeTests/AppUpdateRuntimeTests \
  -only-testing:RedeTests/WatchLoggedSetIntakeTests \
  test

echo "QUALITY GATE: PASS"
