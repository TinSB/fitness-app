const TEXT_POLLUTION_PATTERN = /undefined|null|\{[^}]*$/;

export const sanitizeCopy = (text: string) => text.replace(/\s+/g, ' ').trim();

export const hasTextPollution = (text: string) => TEXT_POLLUTION_PATTERN.test(text);

export const buildCoachSentence = ({
  conclusion,
  reason,
  action,
}: {
  conclusion: string;
  reason?: string;
  action?: string;
}) =>
  sanitizeCopy(
    [conclusion, reason ? `原因：${reason}` : '', action ? `处理：${action}` : '']
      .filter(Boolean)
      .join('。')
  );

export const formatLoadGuidance = (loadRange?: string, rirText?: string) => {
  if (!loadRange && !rirText) return '按上次可控重量开始，优先保持动作质量。';
  if (loadRange && rirText) return `建议使用 ${loadRange}，目标 ${rirText}。`;
  if (loadRange) return `建议使用 ${loadRange}，以动作稳定为准。`;
  return `目标 ${rirText}，不要为了重量牺牲动作质量。`;
};

export const formatPrescriptionSummary = ({
  sets,
  repMin,
  repMax,
  restSec,
  rirText,
}: {
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  rirText?: string;
}) => `${sets} 组 x ${repMin}-${repMax} 次，组间休息约 ${restSec} 秒${rirText ? `，目标 ${rirText}` : ''}。`;

export const professionalFallback = '今天按当前计划正常推进，优先保证动作质量、完整幅度和可持续完成度。';
