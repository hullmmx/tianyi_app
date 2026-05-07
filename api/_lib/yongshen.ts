/**
 * 用神判定层
 *
 * 第 1 层:关键词分类(查 yongshen-keywords.json)
 *   命中 1 类 → 0.9
 *   命中 ≥2 个关键词同一类 → 0.95
 *   命中 2+ 类 → 0.5(送 Haiku 二次校验)
 *   命中 0 类 → 0.0(送 Haiku)
 *
 * 第 2 层:Haiku 4.5 二次校验(在引擎层 stub,真实调用在 prompt.ts)
 *
 * 用神定位:在六亲数组中找该类别的爻位
 * 用神状态:动/静、化生/化克、上卦/不上卦
 */

import keywordsData from '../../data/yongshen-keywords.json' with { type: 'json' };
import type { Liuqin, LineDetail } from './liuqin.ts';

// ============================================================
// 类型
// ============================================================
export type YongshenCategory = Liuqin | 'self';

export interface KeywordClassifyResult {
  category: YongshenCategory | null;
  confidence: number;        // 0..1
  hits: Record<string, number>;
  needsLLMReview: boolean;
}

export interface YongshenAssessment {
  category: YongshenCategory;
  positions: number[];       // 用神在哪些爻位 1-6,空数组 = 不上卦
  isPresent: boolean;
  isDynamic: boolean;        // 用神是否动
  status: string;            // 文字描述
  verdictHint: '是' | '否' | '缓';
}

// ============================================================
// 第 1 层:关键词分类
// ============================================================
export function classifyByKeyword(question: string): KeywordClassifyResult {
  const hits: Record<string, number> = {};

  for (const [cat, info] of Object.entries(keywordsData.categories)) {
    const matched = (info as any).keywords.filter((k: string) =>
      question.includes(k)
    ).length;
    if (matched > 0) hits[cat] = matched;
  }

  const cats = Object.keys(hits);

  if (cats.length === 0) {
    return { category: null, confidence: 0, hits, needsLLMReview: true };
  }

  if (cats.length === 1) {
    const c = cats[0] as YongshenCategory;
    const conf = hits[c] >= 2 ? 0.95 : 0.9;
    return { category: c, confidence: conf, hits, needsLLMReview: false };
  }

  // 多类命中 — 取最多匹配的,但 confidence 降到 0.5
  const winner = cats.reduce((a, b) => (hits[a] >= hits[b] ? a : b));
  return {
    category: winner as YongshenCategory,
    confidence: 0.5,
    hits,
    needsLLMReview: true,
  };
}

// ============================================================
// 第 2 层 stub:Haiku 4.5 二次校验
// 阶段 A 测试:返回原 category(占位)
// ============================================================
export async function classifyByLLM(
  question: string,
  initial: KeywordClassifyResult
): Promise<KeywordClassifyResult> {
  // TODO: 接入 Haiku 4.5 调用
  // const ans = await haiku.classify(question);
  // return { category: ans, confidence: 0.85, hits: initial.hits, needsLLMReview: false };

  // 占位:0 命中时默认 self,歧义时取关键词最多者
  if (initial.category === null) {
    return { ...initial, category: 'self', confidence: 0.5 };
  }
  return { ...initial, confidence: 0.7 };
}

// ============================================================
// 用神定位 — 在 6 爻中找用神位置
// ============================================================
export function findYongshenPositions(
  category: YongshenCategory,
  lineDetails: LineDetail[]
): number[] {
  if (category === 'self') return [];   // self 不依赖六亲
  return lineDetails
    .filter((l) => l.liuqin === category)
    .map((l) => l.pos);
}

// ============================================================
// 用神状态评估 + verdict 提示
//
// 阶段 A 简化版:
//   不上卦 → 否
//   上卦 + 不动 → 是
//   上卦 + 动:看变卦同位的六亲(变化方向)
//     化为同类 → 缓(没有实质变化)
//     化为子孙(我生 / 化吉)→ 是
//     化为官鬼(克我 / 化破)→ 否
//     化为父母(被生 / 文书加持)→ 是
//     化为妻财 / 兄弟 → 缓
// ============================================================
export function assessYongshen(
  category: YongshenCategory,
  benLines: LineDetail[],
  bianLines: LineDetail[],
  movingLines: number[]
): YongshenAssessment {
  // self 类不依赖用神
  if (category === 'self') {
    if (movingLines.length === 0) {
      return {
        category, positions: [], isPresent: false, isDynamic: false,
        status: '静卦,自身决策不躁',
        verdictHint: '是',
      };
    }
    if (movingLines.length >= 4) {
      return {
        category, positions: [], isPresent: false, isDynamic: true,
        status: '乱动,心绪未定',
        verdictHint: '缓',
      };
    }
    return {
      category, positions: [], isPresent: false, isDynamic: true,
      status: '心有所动',
      verdictHint: '是',
    };
  }

  const positions = findYongshenPositions(category, benLines);

  // [1] 不上卦
  if (positions.length === 0) {
    return {
      category, positions, isPresent: false, isDynamic: false,
      status: '用神不上卦,所求之事根基薄',
      verdictHint: '否',
    };
  }

  // [2] 上卦,看是否动
  const dynamicY = positions.filter((p) => movingLines.includes(p));

  if (dynamicY.length === 0) {
    // 用神在卦但不动 — 静而稳
    if (movingLines.length === 0) {
      return {
        category, positions, isPresent: true, isDynamic: false,
        status: '静卦,用神在位',
        verdictHint: '是',
      };
    }
    if (movingLines.length >= 4) {
      return {
        category, positions, isPresent: true, isDynamic: false,
        status: '他爻乱动,用神虽在但被扰',
        verdictHint: '缓',
      };
    }
    return {
      category, positions, isPresent: true, isDynamic: false,
      status: '用神在位不动,稳',
      verdictHint: '是',
    };
  }

  // [3] 用神动 — 看变卦同位的六亲
  const yPos = dynamicY[0];
  const bianYongshen = bianLines[yPos - 1];
  const changedLiuqin = bianYongshen.liuqin;

  if (changedLiuqin === category) {
    // 化为同类(伏吟)
    return {
      category, positions, isPresent: true, isDynamic: true,
      status: `用神动而不变(伏吟)`,
      verdictHint: '缓',
    };
  }

  // 简化的化吉/化破规则
  // 化生(被生 / 自生)→ 是
  // 化克 / 化空 / 化破 → 否
  // 中性变化 → 缓
  const verdictHint = mapChangedLiuqinToHint(category, changedLiuqin);

  return {
    category, positions, isPresent: true, isDynamic: true,
    status: `用神动,化为${changedLiuqin}`,
    verdictHint,
  };
}

// 化为不同六亲对原用神类别的影响(简化判断)
function mapChangedLiuqinToHint(
  original: YongshenCategory,
  changed: Liuqin
): '是' | '否' | '缓' {
  // 自身不可能为 self,但保险起见
  if (original === 'self') return '缓';

  const FAVORABLE_CHANGE: Record<Liuqin, Liuqin[]> = {
    妻财: ['子孙'],         // 子孙生妻财 → 化生
    官鬼: ['妻财'],         // 妻财生官鬼 → 化生
    子孙: ['兄弟'],         // 兄弟生子孙 → 化生
    父母: ['官鬼'],         // 官鬼生父母 → 化生
    兄弟: ['父母'],         // 父母生兄弟 → 化生
  };
  const UNFAVORABLE_CHANGE: Record<Liuqin, Liuqin[]> = {
    妻财: ['兄弟'],         // 兄弟克妻财 → 化破
    官鬼: ['子孙'],         // 子孙克官鬼 → 化破
    子孙: ['父母'],         // 父母克子孙 → 化破
    父母: ['妻财'],         // 妻财克父母 → 化破
    兄弟: ['官鬼'],         // 官鬼克兄弟 → 化破
  };

  if (FAVORABLE_CHANGE[original]?.includes(changed)) return '是';
  if (UNFAVORABLE_CHANGE[original]?.includes(changed)) return '否';
  return '缓';
}
