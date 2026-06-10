#!/usr/bin/env bash
# Rede quality gate — mirrors .github/workflows/rede-ci.yml (job: validate).
# Keep EXPECTED_PACKAGES in sync with the workflow.
set -euo pipefail
cd "$(dirname "$0")/.."

EXPECTED_PACKAGES="RedeDataHealth RedeDomain RedeL10n RedePersistence RedeTrainingDecision RedeWidgetShared"

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

echo "== xcodebuild: scheme Rede =="
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination 'generic/platform=iOS Simulator' \
  build

echo "QUALITY GATE: PASS"
