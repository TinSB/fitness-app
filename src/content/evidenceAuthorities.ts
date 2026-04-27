export type EvidenceAuthorityCategory =
  | 'exercise_prescription'
  | 'strength_conditioning'
  | 'public_health_guideline'
  | 'population_dataset'
  | 'nutrition'
  | 'industry_market';

export type EvidenceAuthorityLevel = 'highest' | 'high' | 'professional_standard' | 'contextual' | 'market_only';

export type EvidenceAuthoritySourceType =
  | 'guideline'
  | 'position_stand'
  | 'systematic_review'
  | 'national_survey'
  | 'textbook'
  | 'market_report';

export type EvidenceAuthority = {
  id: string;
  name: string;
  category: EvidenceAuthorityCategory;
  authorityLevel: EvidenceAuthorityLevel;
  sourceType: EvidenceAuthoritySourceType;
  useFor: string[];
  notUseFor: string[];
  caveat: string;
};

export const EVIDENCE_AUTHORITIES: EvidenceAuthority[] = [
  {
    id: 'acsm',
    name: 'ACSM',
    category: 'exercise_prescription',
    authorityLevel: 'highest',
    sourceType: 'position_stand',
    useFor: ['训练处方', '负荷范围', '频率建议', '渐进超负荷', '减量和恢复原则', '风险筛查原则'],
    notUseFor: ['直接替代医疗诊断', '直接决定某一天必须使用的精确重量'],
    caveat: 'ACSM 适合给出训练处方原则和安全边界，个体当天负荷仍需结合记录、RIR、动作质量和恢复状态。',
  },
  {
    id: 'nsca',
    name: 'NSCA',
    category: 'strength_conditioning',
    authorityLevel: 'professional_standard',
    sourceType: 'textbook',
    useFor: ['力量训练', '动作编排', '技术标准', '周期化', '专项体能'],
    notUseFor: ['医疗诊断', '普通健康活动最低标准'],
    caveat: 'NSCA 更适合力量与体能训练实践，不应被当作医疗判断或公共健康最低活动标准。',
  },
  {
    id: 'hhs_paga',
    name: 'HHS Physical Activity Guidelines for Americans',
    category: 'public_health_guideline',
    authorityLevel: 'highest',
    sourceType: 'guideline',
    useFor: ['健康底线', '成年人有氧和肌力训练最低建议', '长期健康习惯目标'],
    notUseFor: ['卧推或深蹲具体重量', '肌肥大专项组数细节'],
    caveat: 'HHS 指南用于健康活动底线，不直接规定力量训练动作、重量、RIR 或肌肥大专项训练量。',
  },
  {
    id: 'cdc_healthy_people_2030',
    name: 'CDC / Healthy People 2030',
    category: 'public_health_guideline',
    authorityLevel: 'high',
    sourceType: 'guideline',
    useFor: ['健康目标', '活动达标 KPI', '长期健康方向'],
    notUseFor: ['个体训练动作处方', 'e1RM 估算'],
    caveat: 'Healthy People 适合解释公共健康目标，不适合直接控制个人训练重量、组数或动作选择。',
  },
  {
    id: 'nhanes',
    name: 'CDC/NCHS NHANES',
    category: 'population_dataset',
    authorityLevel: 'contextual',
    sourceType: 'national_survey',
    useFor: ['人群健康基准', 'BMI/体重/身体指标背景', '营养和实验室指标背景'],
    notUseFor: ['个人训练处方', '当天训练重量'],
    caveat: 'NHANES 是人群数据源，只能提供背景基准，不能把人群均值直接转换成个人训练处方。',
  },
  {
    id: 'brfss',
    name: 'CDC BRFSS',
    category: 'population_dataset',
    authorityLevel: 'contextual',
    sourceType: 'national_survey',
    useFor: ['州级健康行为背景', '健康风险行为趋势'],
    notUseFor: ['个人训练动作建议', '个人训练负荷建议'],
    caveat: 'BRFSS 适合解释健康行为趋势，不用于控制某次训练动作、重量或组数。',
  },
  {
    id: 'nhis',
    name: 'CDC/NCHS NHIS',
    category: 'population_dataset',
    authorityLevel: 'contextual',
    sourceType: 'national_survey',
    useFor: ['长期健康行为趋势', '成人健康和体力活动背景'],
    notUseFor: ['力量训练处方', 'e1RM 或 PR 推进'],
    caveat: 'NHIS 是健康访谈调查，适合背景解释，不提供个人力量训练处方。',
  },
  {
    id: 'atus',
    name: 'BLS American Time Use Survey',
    category: 'population_dataset',
    authorityLevel: 'contextual',
    sourceType: 'national_survey',
    useFor: ['时间使用背景', '训练计划现实性参考', '用户时间预算解释'],
    notUseFor: ['训练效果判断', '肌肥大或力量处方'],
    caveat: 'ATUS 可用于说明时间预算现实性，不能推导某个动作该做几组或用多重。',
  },
  {
    id: 'health_fitness_association_sfia',
    name: 'Health & Fitness Association / SFIA',
    category: 'industry_market',
    authorityLevel: 'market_only',
    sourceType: 'market_report',
    useFor: ['行业趋势', '健身市场背景', '运动参与率趋势'],
    notUseFor: ['训练处方', '训练重量', '有效组', 'RIR', '疼痛或不适处理'],
    caveat: '行业和市场数据只能解释市场背景，不能参与训练处方、负荷推进或疼痛处理。',
  },
];

export const EVIDENCE_AUTHORITY_MAP = EVIDENCE_AUTHORITIES.reduce<Record<string, EvidenceAuthority>>((acc, authority) => {
  acc[authority.id] = authority;
  return acc;
}, {});

export const getEvidenceAuthority = (id: string) => EVIDENCE_AUTHORITY_MAP[id];
