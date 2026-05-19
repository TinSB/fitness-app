export const UI_OS_TABS = [
  { id: 'today', label: '今日' },
  { id: 'train', label: '训练' },
  { id: 'history', label: '历史' },
  { id: 'progress', label: '进步' },
  { id: 'settings', label: '设置' },
] as const;

export type UiOsTabId = (typeof UI_OS_TABS)[number]['id'];
