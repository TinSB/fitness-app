export type EvidenceSourceType =
  | 'position_stand'
  | 'systematic_review'
  | 'guideline'
  | 'textbook'
  | 'expert_consensus'
  | 'national_survey'
  | 'market_report';

export interface EvidenceSource {
  id: string;
  title: string;
  organization?: string;
  year?: number;
  type: EvidenceSourceType;
  note: string;
  useFor: string[];
  lastReviewedAt: string;
}

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    id: 'acsm_resistance_training_guidance',
    title: 'ACSM resistance training guidance',
    organization: 'ACSM',
    type: 'guideline',
    note: '用于阻力训练频率、负荷、组数、动作顺序、渐进超负荷和风险筛查原则的专业依据。',
    useFor: ['训练处方原则', '渐进超负荷', '负荷和次数范围', '恢复和风险控制'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'nsca_strength_conditioning_reference',
    title: 'NSCA strength and conditioning professional reference',
    organization: 'NSCA',
    type: 'textbook',
    note: '用于力量训练技术标准、动作编排、周期化和专项体能训练实践。',
    useFor: ['力量训练', '动作技术', '动作排序', '周期化'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'hhs_physical_activity_guidelines',
    title: 'Physical Activity Guidelines for Americans',
    organization: 'HHS',
    type: 'guideline',
    note: '用于成年人健康活动底线、肌力训练最低频率和长期健康习惯目标。',
    useFor: ['健康最低活动标准', '成年人肌力训练最低建议', '长期健康习惯'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'cdc_healthy_people_2030',
    title: 'Healthy People 2030 physical activity objectives',
    organization: 'CDC / Healthy People',
    type: 'guideline',
    note: '用于公共健康目标、活动达标 KPI 和长期健康方向，不用于个人负荷处方。',
    useFor: ['公共健康目标', '活动达标 KPI', '长期健康方向'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'hypertrophy_volume_reviews',
    title: 'Hypertrophy volume and effort-control reviews',
    type: 'systematic_review',
    note: '用于肌肥大训练量、训练频率、接近力竭程度和恢复管理的研究支持。',
    useFor: ['肌肥大训练量', 'RIR 努力程度', '周训练量分配', '有效组估算边界'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'rir_effort_reviews',
    title: 'RIR/RPE effort regulation research',
    type: 'systematic_review',
    note: '用于说明接近力竭、RIR/RPE 自我调节和每组不必默认力竭的训练实践。',
    useFor: ['RIR 控制', 'RPE 解释', '非力竭训练', '有效组置信度'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'strength_programming_consensus',
    title: 'Strength training programming consensus',
    type: 'expert_consensus',
    note: '用于较低重复范围、较长休息、技术质量优先和周期化训练实践。',
    useFor: ['力量训练重复范围', '技术质量门槛', '减量周', '顶组与回退组'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'pain_training_boundary_consensus',
    title: 'Pain-aware training boundary consensus',
    type: 'expert_consensus',
    note: '用于训练中不适记录的保守处理边界；不作为医疗诊断依据。',
    useFor: ['不适模式', '动作替代', '疼痛信号保守处理'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'e1rm_estimation_references',
    title: '1RM estimation formulas and field testing references',
    type: 'expert_consensus',
    note: '用于 e1RM 估算的工程实现边界，强调它是估算值而不是真实 1RM 测试。',
    useFor: ['e1RM 估算', '负荷建议校准', 'PR 置信度边界'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'nhanes_population_reference',
    title: 'CDC/NCHS NHANES population reference',
    organization: 'CDC/NCHS',
    type: 'national_survey',
    note: '用于人群健康指标、体重/BMI 和营养背景参考，不用于个人训练负荷。',
    useFor: ['人群健康基准', '身体指标背景', '健康趋势'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'brfss_population_reference',
    title: 'CDC BRFSS health behavior reference',
    organization: 'CDC',
    type: 'national_survey',
    note: '用于州级健康行为和风险行为趋势背景，不用于个体训练处方。',
    useFor: ['州级健康行为背景', '健康风险行为趋势'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'nhis_population_reference',
    title: 'CDC/NCHS NHIS health trend reference',
    organization: 'CDC/NCHS',
    type: 'national_survey',
    note: '用于成人健康、长期健康行为和体力活动背景，不用于力量训练处方。',
    useFor: ['成人健康趋势', '体力活动背景', '长期健康行为'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'atus_time_use_reference',
    title: 'BLS American Time Use Survey reference',
    organization: 'BLS',
    type: 'national_survey',
    note: '用于时间使用背景和训练计划现实性解释，不用于训练效果判断。',
    useFor: ['时间预算背景', '计划现实性解释', '长期习惯可执行性'],
    lastReviewedAt: '2026-04-27',
  },
  {
    id: 'industry_participation_reference',
    title: 'Health & Fitness Association / SFIA participation reference',
    type: 'market_report',
    note: '仅用于行业趋势和运动参与率背景，不参与训练处方、RIR、e1RM 或有效组计算。',
    useFor: ['行业趋势', '健身市场背景', '运动参与率背景'],
    lastReviewedAt: '2026-04-27',
  },
];

export const getEvidenceSource = (id: string) => EVIDENCE_SOURCES.find((source) => source.id === id);
