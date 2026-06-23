#!/usr/bin/env bash
# Rede quality gate — mirrors .github/workflows/rede-ci.yml (job: validate).
# Keep EXPECTED_PACKAGES in sync with the workflow.
set -euo pipefail
cd "$(dirname "$0")/.."

EXPECTED_PACKAGES="RedeDataHealth RedeDomain RedeL10n RedeLocalSnapshot RedeNotifications RedePersistence RedeTrainingDecision RedeWidgetShared"

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

echo "== xcodebuild: scheme Rede =="
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination 'generic/platform=iOS Simulator' \
  build

echo "QUALITY GATE: PASS"
