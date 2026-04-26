export type EvidenceSourceType = 'position_stand' | 'systematic_review' | 'guideline' | 'textbook' | 'expert_consensus';

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
    note: '用于一般成年人阻力训练频率、强度、组数和循序渐进原则的通用参考。',
    useFor: ['训练频率', '渐进超负荷', '休息时间', '阻力训练处方原则'],
    lastReviewedAt: '2026-04-26',
  },
  {
    id: 'hypertrophy_volume_reviews',
    title: 'Hypertrophy volume and effort-control reviews',
    type: 'systematic_review',
    note: '用于肌肥大训练量、接近力竭程度、训练频率和恢复管理的综合性证据参考。',
    useFor: ['肌肥大训练量', 'RIR 努力程度', '周剂量分配', '恢复管理'],
    lastReviewedAt: '2026-04-26',
  },
  {
    id: 'strength_programming_consensus',
    title: 'Strength training programming consensus',
    type: 'expert_consensus',
    note: '用于较低重复范围、较长休息、技术质量优先和渐进超负荷的实践性原则。',
    useFor: ['力量训练重复范围', '技术质量闸门', '减量周', '顶组与回退组'],
    lastReviewedAt: '2026-04-26',
  },
  {
    id: 'pain_training_boundary_consensus',
    title: 'Pain-aware training boundary consensus',
    type: 'expert_consensus',
    note: '用于训练中不适信号的保守处理边界；不作为医疗诊断依据。',
    useFor: ['不适模式', '动作替代', '疼痛信号保守处理'],
    lastReviewedAt: '2026-04-26',
  },
];

export const getEvidenceSource = (id: string) => EVIDENCE_SOURCES.find((source) => source.id === id);
