# IronPath UI/UX Specification

## 1. Product Positioning

IronPath is a mobile-first personal training system. It should feel like a polished professional training app.

## 2. Main Navigation

- 今日
- 训练
- 记录
- 计划
- 我的

## 3. Page Responsibilities

### 今日
Purpose: decide whether to train today, what to train, and where to start.

Should show:
- today decision panel
- training recommendation
- start workout CTA
- short workout preview
- readiness summary
- plan progress

Should not show:
- full history
- long-term statistics
- PR trend charts
- full exercise metadata

### 训练
Purpose: record the current workout.

Includes:
- Focus Mode
- Full workout page
- free logging
- resume unfinished workout

Should not show:
- long-term stats
- calendar
- plan version history

### 记录
Purpose: review historical training.

Default entry: calendar.

Includes:
- calendar
- history list
- workout detail
- PR / e1RM
- statistics
- training record data management

Should not show:
- plan adjustment as primary entry
- unit settings
- health import
- global backup restore

### 计划
Purpose: manage future training.

Includes:
- current template
- cycle
- training day templates
- experimental templates
- adjustment suggestions
- rollback

Should not show:
- full historical workout details
- Focus Mode controls

### 我的
Purpose: settings, screening, data, units, backup.

Includes:
- screening
- unit settings
- health data import
- backup / restore
- PWA / local data explanation
- about

Should not show:
- today training recommendation
- workout logging controls
- calendar as primary view

## 4. Visual Style

- Background: warm light neutral
- Focus Mode: dark, immersive
- Cards: restrained, low shadow, grouped sections
- Buttons: consistent primary / secondary / ghost / destructive
- Badges: short, limited, never overloaded
- Empty states: title + one-sentence explanation + one action
- Dangerous actions: confirmation required

## 5. Mobile Wireframes

Paste the mobile wireframes here.

## 6. Desktop Layouts

Desktop must use:
- left navigation
- main content
- auxiliary sidebar

Never center a narrow mobile column with empty space on the right.

## 7. Focus Mode Detailed Interaction

Paste the Focus Mode rules here.

## 8. Component Inventory

Required components:
- AppShell
- PageHeader
- Card
- MetricCard
- ActionButton
- IconButton
- BottomSheet
- Drawer
- Toast
- ConfirmDialog
- ListItem
- SegmentedControl
- StatusBadge
- EmptyState
- WorkoutActionBar