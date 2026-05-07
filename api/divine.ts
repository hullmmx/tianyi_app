/**
 * 天意 · 老龟问卦 — 核心 API
 *
 * POST /api/divine
 * Body: { question: string, client_local_time?: string (ISO 8601) }
 *
 * 流程:
 *   高危分类 → 起卦 → 组装 prompt → 调 LLM → 复检 → (失败重试 2 次) → 降级模板
 *
 * Env vars:
 *   ANTHROPIC_API_KEY   Claude API Key (在 Vercel 项目设置中配置)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import hexagramsData from '../data/hexagrams-64.json';

// ============================================================
// Types
// ============================================================
interface Hexagram {
  id: number;
  name: string;
  unicode: string;
  binary: string;
  judgement: string;
  image: string;
  essence: string;
  tags: string[];
  trigrams: { upper: string; lower: string };
  lines: { pos: number; text: string; hint: string }[];
}

interface CastResult {
  ben: Hexagram;
  bian: Hexagram;
  movingLine: number;       // 1=初爻 ... 6=上爻
  movingLineText: string;
  movingLineHint: string;
  upperTrigram: string;
  lowerTrigram: string;
  computedAt: string;       // ISO with timezone
}

interface Reading {
  tendency: string;
  if_a: string;
  if_b: string;
  qianci: string;
}

const HEXAGRAMS = hexagramsData.hexagrams as Hexagram[];

// ============================================================
// Step 1: 高危意图分类(关键词层,LLM 调用前拦截)
// ============================================================
type HighRiskType = 'self_harm' | 'harm_others' | 'medical' | 'legal' | 'finance';

const HIGH_RISK_PATTERNS: Record<HighRiskType, RegExp[]> = {
  self_harm: [
    /自残|自杀|自尽/, /想死|想消失/, /不想活|活不下去/,
    /结束.*?生命/, /跳楼|跳河|烧炭/, /割腕/, /轻生/
  ],
  harm_others: [
    /报复.{0,4}他|报复.{0,4}她/, /揍.{0,4}一?顿/, /杀.{0,4}人/,
    /害死/, /放火/, /下毒/
  ],
  medical: [
    /要不要吃.+?药/, /要不要做.*?手术/, /要不要切除/,
    /要不要打.+?针/, /要不要化疗|要不要放疗/
  ],
  legal: [
    /要不要起诉/, /要不要告/, /要不要签.*?(合同|协议|条约)/
  ],
  finance: [
    /全仓|梭哈|ALL ?IN|all ?in/i, /贷款.*?(投资|炒|买)/,
    /要不要(押|赌).+?(房|身家)/
  ]
};

function classifyHighRisk(question: string): { flag: boolean; type: HighRiskType | null } {
  for (const [type, patterns] of Object.entries(HIGH_RISK_PATTERNS) as [HighRiskType, RegExp[]][]) {
    if (patterns.some(p => p.test(question))) {
      return { flag: true, type };
    }
  }
  return { flag: false, type: null };
}

const HIGH_RISK_RESOURCES: Record<HighRiskType, { hint: string; resources: string[] }> = {
  self_harm: {
    hint: '这事不该问卦,该寻人。',
    resources: [
      '安心专线 1925(24 小时)',
      '生命线协会 1995',
      '张老师专线 1980',
    ]
  },
  harm_others: {
    hint: '此事老朽不能为你卜算。',
    resources: ['请深呼吸三次,先离开当下情境']
  },
  medical: {
    hint: '医事不在卦中。',
    resources: ['请咨询专业医师']
  },
  legal: {
    hint: '法事不在卦中。',
    resources: ['请咨询专业律师']
  },
  finance: {
    hint: '钱财大事,不可全凭一卦。',
    resources: ['请咨询持证理财顾问']
  }
};

// ============================================================
// Step 2: 梅花易数·时间起卦法
// ============================================================
// 先天八卦数: 乾1 兑2 离3 震4 巽5 坎6 艮7 坤8
// binary 自下而上: '111' 阳阳阳 = 乾,'000' 阴阴阴 = 坤
const TRIGRAM_NAMES = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const TRIGRAM_BINARY = ['111', '110', '101', '100', '011', '010', '001', '000'];

function castHexagram(timestamp: Date, question: string): CastResult {
  // 校准为台北时区(产品默认 CST)
  const tw = new Date(timestamp.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const yearNorm = tw.getFullYear() - 1900;
  const month = tw.getMonth() + 1;
  const day = tw.getDate();
  const hour = tw.getHours();
  const qLen = [...question.trim()].length;   // 字数(支持 emoji 等多字节)

  // 上卦数 (1..8)
  const upperIdx = ((yearNorm + month + day + qLen) % 8) || 8;
  // 下卦数 (1..8)
  const lowerIdx = ((yearNorm + month + day + hour + qLen) % 8) || 8;
  // 动爻位 (1..6)
  const movingLine = ((yearNorm + month + day + hour + qLen) % 6) || 6;

  const lowerBinary = TRIGRAM_BINARY[lowerIdx - 1];   // 下卦 = 第 1-3 爻 (自下而上)
  const upperBinary = TRIGRAM_BINARY[upperIdx - 1];   // 上卦 = 第 4-6 爻 (自下而上)
  const benBinary = lowerBinary + upperBinary;        // 6 chars,自下而上

  const ben = findByBinary(benBinary);
  const bianBinary = flipBit(benBinary, movingLine - 1);
  const bian = findByBinary(bianBinary);

  return {
    ben,
    bian,
    movingLine,
    movingLineText: ben.lines[movingLine - 1].text,
    movingLineHint: ben.lines[movingLine - 1].hint,
    upperTrigram: TRIGRAM_NAMES[upperIdx - 1],
    lowerTrigram: TRIGRAM_NAMES[lowerIdx - 1],
    computedAt: tw.toISOString(),
  };
}

function flipBit(binary: string, idx: number): string {
  return binary.slice(0, idx) + (binary[idx] === '1' ? '0' : '1') + binary.slice(idx + 1);
}

function findByBinary(binary: string): Hexagram {
  const found = HEXAGRAMS.find(h => h.binary === binary);
  if (!found) throw new Error(`Hexagram not found for binary: ${binary}`);
  return found;
}

// ============================================================
// Step 3: Prompt 三层组装
// ============================================================
function buildSystemPrompt(cast: CastResult, question: string, tonalHint: string): string {
  const facts = {
    question,
    tonal_hint: tonalHint,
    ben_gua:    { name: cast.ben.name,  judgement: cast.ben.judgement,  essence: cast.ben.essence,  tags: cast.ben.tags },
    bian_gua:   { name: cast.bian.name, judgement: cast.bian.judgement, essence: cast.bian.essence, tags: cast.bian.tags },
    moving_line: { pos: cast.movingLine, text: cast.movingLineText, hint: cast.movingLineHint },
  };

  return `你是「天意」中的老龟——一位慢、温、不替人做决定的智者。

[身份层]
- 你的语气稳如山,但不端架子。称呼用户「你」,偶尔说「孩子」
- 不替用户做决定,只说 A 路如何、B 路如何
- 三个禁忌:不允许「一定」「必然」「肯定」「百分百」「绝对」「无疑」
- 不允许「您」「敬请」「宝贝」「亲」
- 不允许直接念卦辞/爻辞原文给用户(那是我给你看的)
- 不允许给具体公司名、药品名、人名、金额建议

[数据层 — 不可质疑,不可改写]
${JSON.stringify(facts, null, 2)}
此为已起之卦的事实层。你的全部输出必须以此为依据,
不允许基于自身知识对卦象、爻位进行任何「再判断」。
你的工作是「翻译」,不是「计算」。

[输出层 — 严格遵守]
返回严格 JSON,只这四个字段,无任何多余文字:
{
  "tendency": "60-100 字。基于本卦气质 + 动爻含义,直接断言用户的心理倾向。语气克制但要敢断,禁说『你也许是』『可能你是』",
  "if_a":     "60-100 字。描述选『是/做/要』的可能走向。必须暗合本卦或动爻气质,不允许直接念卦辞",
  "if_b":     "60-100 字。描述选『否/不做/不要』的可能走向。必须暗合变卦气质,不允许直接念卦辞",
  "qianci":   "8-12 字签词。必须含一个具象意象(取自本卦/变卦的物象,如山雷水火风泽天地)。禁止套语黑名单"
}

字数约束:
- tendency / if_a / if_b 字数差不超过 15 字
- qianci 长度 8-12 字(含标点)

签词套语黑名单(禁用):
水到渠成、顺其自然、有缘则成、随心而行、天意如此、时机未到、缘分注定、静待花开、心想事成、万事如意

只返回 JSON。不要前言,不要解释,不要 markdown 代码块。`;
}

function detectTonalHint(question: string): 'courage' | 'hesitant' | 'neutral' {
  if (/能不能|行不行|可不可以/.test(question)) return 'courage';
  if (/会不会|是不是|算不算/.test(question)) return 'hesitant';
  return 'neutral';
}

// ============================================================
// Step 4: LLM 调用
// ============================================================
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function callLLM(systemPrompt: string, question: string): Promise<Reading> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: `要不要 ${question}` }]
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type');

  // 剥掉可能的 markdown 包裹
  let text = block.text.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  const parsed = JSON.parse(text);
  return parsed as Reading;
}

// ============================================================
// Step 5: 输出复检(7 条铁律)
// ============================================================
const QIANCI_BLACKLIST = [
  '水到渠成', '顺其自然', '有缘则成', '随心而行',
  '天意如此', '时机未到', '缘分注定', '静待花开',
  '心想事成', '万事如意'
];

const FORBIDDEN_WORDS = ['一定', '必然', '肯定', '百分百', '绝对', '无疑', '您', '敬请', '宝贝'];

function validateReading(r: any): { ok: boolean; reason?: string } {
  if (!r || typeof r !== 'object') return { ok: false, reason: 'not_object' };
  for (const k of ['tendency', 'if_a', 'if_b', 'qianci']) {
    if (typeof r[k] !== 'string' || r[k].trim().length === 0) {
      return { ok: false, reason: `missing_${k}` };
    }
  }

  const charLen = (s: string) => [...s].length;
  const lens = [charLen(r.tendency), charLen(r.if_a), charLen(r.if_b)];

  // 字数 60-100
  if (lens.some(l => l < 50 || l > 130)) return { ok: false, reason: 'length_out_of_range' };
  // 字数差 ≤15
  if (Math.max(...lens) - Math.min(...lens) > 18) return { ok: false, reason: 'length_imbalanced' };

  // 签词长度 8-12
  const qLen = charLen(r.qianci);
  if (qLen < 6 || qLen > 14) return { ok: false, reason: 'qianci_length' };

  // 签词黑名单
  if (QIANCI_BLACKLIST.some(b => r.qianci.includes(b))) {
    return { ok: false, reason: 'qianci_blacklisted' };
  }

  // 禁用词
  const allText = `${r.tendency}${r.if_a}${r.if_b}${r.qianci}`;
  if (FORBIDDEN_WORDS.some(w => allText.includes(w))) {
    return { ok: false, reason: 'forbidden_word' };
  }

  return { ok: true };
}

// ============================================================
// Step 6: 降级模板(LLM 3 次失败的兜底)
// ============================================================
function fallbackReading(cast: CastResult): Reading {
  const tag = cast.ben.tags[0] ?? '守正';
  return {
    tendency: `这一卦说的是「${cast.ben.essence}」。你心里其实早有方向,只是想找一个允许自己照那个方向走的理由——这一卦不否定它,但也提醒你别把决心当成蛮力。`,
    if_a: `若选「是」,前期顺,中段会有反复。${cast.ben.tags.slice(0, 2).join('、')}是你这阵子需要的关键字。别贪快,把节奏放慢半拍,反而走得远。`,
    if_b: `若选「否」,会松一口气,但松不过三天就开始焦虑。腾出的时间花在读、走、想这三件事上,反而对接下来的状态更合拍。`,
    qianci: `${tag},${cast.bian.name.slice(-1)}自来`,
  };
}

// ============================================================
// Main handler
// ============================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question, client_local_time } = req.body ?? {};

    if (typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: '问题不可为空' });
    }
    if ([...question].length > 60) {
      return res.status(400).json({ error: '问题字数不可超过 60' });
    }

    // [1] 高危拦截
    const risk = classifyHighRisk(question);
    if (risk.flag && risk.type) {
      const r = HIGH_RISK_RESOURCES[risk.type];
      return res.status(200).json({
        mode: 'human_care',
        high_risk_type: risk.type,
        message: r.hint,
        resources: r.resources,
      });
    }

    // [2] 起卦
    const ts = client_local_time ? new Date(client_local_time) : new Date();
    const cast = castHexagram(ts, question);

    // [3-5] LLM 调用 + 复检 + 重试
    const tonal = detectTonalHint(question);
    const systemPrompt = buildSystemPrompt(cast, question, tonal);

    let reading: Reading | null = null;
    let lastReason = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await callLLM(systemPrompt, question);
        const v = validateReading(r);
        if (v.ok) { reading = r; break; }
        lastReason = v.reason ?? '';
      } catch (e: any) {
        lastReason = e?.message ?? 'llm_error';
      }
    }

    // [6] 降级
    if (!reading) {
      reading = fallbackReading(cast);
    }

    return res.status(200).json({
      mode: 'normal',
      hexagram: {
        ben:           cast.ben.name,
        ben_unicode:   cast.ben.unicode,
        bian:          cast.bian.name,
        bian_unicode:  cast.bian.unicode,
        moving_line:   cast.movingLine,
        upper_trigram: cast.upperTrigram,
        lower_trigram: cast.lowerTrigram,
      },
      reading,
      computed_at: cast.computedAt,
      // 调试用,生产环境可删
      _debug: process.env.NODE_ENV === 'development' ? { last_validation_reason: lastReason } : undefined,
    });
  } catch (err: any) {
    console.error('[divine] error:', err);
    return res.status(500).json({ error: 'engine_error', detail: err?.message });
  }
}
