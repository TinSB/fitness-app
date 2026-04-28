import type { AppData } from '../models/training-model';

export type ProfileViewModel = {
  sections: string[];
  unitLabel: string;
  healthImportEnabled: boolean;
  backupAvailable: boolean;
};

export const buildProfileViewModel = (data: AppData): ProfileViewModel => ({
  sections: ['个人数据状态', '身体/动作筛查', '单位设置', '健康数据导入', '备份与恢复', 'PWA / 本地数据说明', '关于 IronPath'],
  unitLabel: data.unitSettings?.weightUnit === 'lb' ? 'lb' : 'kg',
  healthImportEnabled: true,
  backupAvailable: true,
});
