/**
 * 高危意图分类(LLM 调用前的硬护栏)
 *
 * 5 类高危,任一命中即不进入起卦流程,直接返回静态人文关怀
 */

export type HighRiskType =
  | 'self_harm'
  | 'harm_others'
  | 'medical'
  | 'legal'
  | 'finance';

const PATTERNS: Record<HighRiskType, RegExp[]> = {
  self_harm: [
    /自残|自杀|自尽/,
    /想死|想消失|不想活|活不下去/,
    /结束.*?生命/,
    /跳楼|跳河|烧炭|割腕|轻生/,
  ],
  harm_others: [
    /报复.{0,4}(他|她|他们)/,
    /揍.{0,4}一?顿/,
    /杀.{0,4}人/,
    /害死|放火|下毒/,
    /(打|揍|殴|捅).{0,4}(他|她|TA)/,
    /来.{0,2}一?(拳|脚|刀)/,
    /动.{0,2}(手|刀)/,
    /找.{0,2}(他|她).{0,2}(算账|麻烦)/,
  ],
  medical: [
    /要不要吃.+?药/,
    /要不要做.{0,2}手术/,
    /要不要切.{0,2}除/,
    /要不要打.+?针/,
    /要不要(化|放)疗/,
  ],
  legal: [
    /要不要起诉/,
    /要不要告.{0,2}(他|她|公司|对方)/,
    /要不要签.{0,4}(合同|协议|条约)/,
  ],
  finance: [
    /全仓|梭哈|ALL ?IN|all ?in/i,
    /贷款.{0,4}(投资|炒|买股|买房|买车)/,
    /要不要(押|赌).{0,4}(房|身家|全部)/,
  ],
};

export interface RiskClassifyResult {
  flag: boolean;
  type: HighRiskType | null;
  matchedPattern?: string;
}

export function classifyRisk(question: string): RiskClassifyResult {
  for (const [type, patterns] of Object.entries(PATTERNS) as [HighRiskType, RegExp[]][]) {
    for (const p of patterns) {
      if (p.test(question)) {
        return { flag: true, type, matchedPattern: p.source };
      }
    }
  }
  return { flag: false, type: null };
}

// ============================================================
// 高危处置资源(台北默认)
// ============================================================
export const HIGH_RISK_RESOURCES: Record<
  HighRiskType,
  { hint: string; resources: string[] }
> = {
  self_harm: {
    hint: '这事不该问卦,该寻人。',
    resources: [
      '安心专线 1925(24 小时)',
      '生命线协会 1995',
      '张老师专线 1980',
    ],
  },
  harm_others: {
    hint: '此事老朽不能为你卜算。',
    resources: ['请深呼吸三次,先离开当下情境'],
  },
  medical: {
    hint: '医事不在卦中。',
    resources: ['请咨询专业医师'],
  },
  legal: {
    hint: '法事不在卦中。',
    resources: ['请咨询专业律师'],
  },
  finance: {
    hint: '钱财大事,不可全凭一卦。',
    resources: ['请咨询持证理财顾问'],
  },
};
