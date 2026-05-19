# UI-OS R9.1 Bottom Nav Chrome & Real Light Theme Hotfix V1

## Task Identity

UI-OS R9.1 is a UI presentation and theme integration hotfix after the UI-OS remediation archive.

## Why This Exists After R9

UI-OS R9 archived the Interaction OS remediation sequence, but final mobile visual acceptance still found two product issues:

- The mobile bottom navigation left a large black bottom dead zone under the nav.
- The Settings theme selector exposed system / light / dark controls, but the real app shell and surfaces still behaved like a dark-only app.

## Screenshot-Observed Failures

- Large black bottom dead zone below the floating bottom nav.
- Bottom nav felt too high above the home indicator instead of integrated with the safe area.
- Light / dark selector existed, but Today, History, Progress, Settings, cards, and nav did not visibly switch to light mode.

## What Was Fixed

- Bottom nav now uses a native safe-area offset instead of an oversized fixed footer reserve.
- Scroll content keeps enough bottom padding for the nav without drawing a visible artificial footer block.
- Hidden bottom-nav state no longer leaves a fixed black dead zone.
- Theme mode is connected at the app shell level and applied to document/root chrome.
- Light / dark / system theme resolution now affects MobileAppShell, AppTopBar, PageContainer background, BottomNav, GlassCard, SettingsGroupCard, Settings controls, and semantic UI-OS surfaces.
- Focus Mode may remain immersive dark by product rule.
- Theme preference is stored only in the UI namespace `ironpath:ui-theme`; it does not touch AppData, training storage, source-of-truth, routes, or cloud behavior.

## Non-Goals

- No training algorithm change.
- No warmup algorithm change.
- No planning or rotation change.
- No PR, e1RM, effective-set, or equipment-aware calculation change.
- No Data Health detection change.
- No source-of-truth change.
- No AppData schema change.
- No route, cloud, package, script, or lockfile change.

## Recommended Next Task

Recommended next task: UI-OS 10A - Real Gym Use Acceptance & Bug Intake V1.

UI-OS 10A is not started by R9.1.
